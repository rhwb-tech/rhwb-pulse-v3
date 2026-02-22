import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // 1. Extract and validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with the user's JWT to validate identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userEmail = user.email
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'No email in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[QUAL] Step 1 - JWT valid, userEmail:', userEmail)

    // 2. Parse request body
    const { season, runnerEmail } = await req.json()
    console.log('[QUAL] Step 2 - Request body:', { season, runnerEmail })
    if (!season) {
      return new Response(
        JSON.stringify({ error: 'season is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Service client for privileged queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Resolve user's role
    const { data: roleData } = await supabase
      .from('v_pulse_roles')
      .select('role')
      .eq('email_id', userEmail)
      .single()

    let role = roleData?.role || 'runner'
    console.log('[QUAL] Step 4 - Role resolved:', role, 'roleData:', JSON.stringify(roleData))

    // Fallback: email pattern matching
    if (!roleData) {
      if (userEmail.includes('@admin')) role = 'admin'
      else if (userEmail.includes('@coach')) role = 'coach'
      else if (userEmail.includes('@hybrid')) role = 'hybrid'
    }

    // 5. Determine authorized runner email(s) based on role
    let authorizedEmails: string[] = []

    if (role === 'runner' || role === 'athlete') {
      // Athletes can only see their own data
      authorizedEmails = [userEmail]
    } else if (role === 'admin') {
      // Admin can query any runner passed in runnerEmail
      if (runnerEmail) {
        authorizedEmails = [runnerEmail]
      } else {
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (role === 'coach') {
      // Coach: get assigned runners
      const seasonNo = parseInt(season.replace(/\D/g, ''), 10)
      const { data: coachData } = await supabase
        .from('rhwb_coaches')
        .select('coach')
        .eq('email_id', userEmail)
        .single()

      if (coachData?.coach) {
        const { data: runners } = await supabase
          .rpc('fetch_runners_for_coach', {
            season_no_parm: seasonNo,
            coach_name_parm: coachData.coach,
          })
        authorizedEmails = (runners || []).map((r: { email_id: string }) => r.email_id)
      }

      // If runnerEmail specified, verify it's in the authorized list
      if (runnerEmail) {
        if (authorizedEmails.includes(runnerEmail)) {
          authorizedEmails = [runnerEmail]
        } else {
          return new Response(
            JSON.stringify({ data: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } else if (role === 'hybrid') {
      // Hybrid: own data + assigned runners
      if (!runnerEmail || runnerEmail === userEmail) {
        // Requesting own data
        authorizedEmails = [userEmail]
      } else {
        // Requesting another runner's data — verify coach assignment
        const seasonNo = parseInt(season.replace(/\D/g, ''), 10)
        const { data: coachData } = await supabase
          .from('rhwb_coaches')
          .select('coach')
          .eq('email_id', userEmail)
          .single()

        if (coachData?.coach) {
          const { data: runners } = await supabase
            .rpc('fetch_runners_for_coach', {
              season_no_parm: seasonNo,
              coach_name_parm: coachData.coach,
            })
          const assignedEmails = (runners || []).map((r: { email_id: string }) => r.email_id)
          if (assignedEmails.includes(runnerEmail)) {
            authorizedEmails = [runnerEmail]
          } else {
            return new Response(
              JSON.stringify({ data: [] }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }

    console.log('[QUAL] Step 5 - authorizedEmails:', JSON.stringify(authorizedEmails))

    if (authorizedEmails.length === 0) {
      console.log('[QUAL] EARLY EXIT - no authorized emails')
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Map email(s) → runner_id(s)
    const { data: profiles } = await supabase
      .from('runners_profile')
      .select('email_id, runner_id')
      .in('email_id', authorizedEmails)

    console.log('[QUAL] Step 6 - profiles from runners_profile:', JSON.stringify(profiles))

    const runnerIds = (profiles || [])
      .filter((p: { runner_id: string | null }) => p.runner_id)
      .map((p: { runner_id: string }) => p.runner_id)

    console.log('[QUAL] Step 6 - runnerIds:', JSON.stringify(runnerIds))

    if (runnerIds.length === 0) {
      console.log('[QUAL] EARLY EXIT - no runner_ids found')
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Call Cloud Run service
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_URL')!
    const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')!

    const cloudRunResponse = await fetch(`${cloudRunUrl}/get-qual-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cloudRunApiKey,
      },
      body: JSON.stringify({ runner_ids: runnerIds, season }),
    })

    if (!cloudRunResponse.ok) {
      console.error('Cloud Run error:', cloudRunResponse.status, await cloudRunResponse.text())
      return new Response(
        JSON.stringify({ data: [], error: 'Failed to fetch qual scores' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await cloudRunResponse.json()
    console.log('[QUAL] Step 7 - Cloud Run returned', (result.data || []).length, 'rows')

    return new Response(
      JSON.stringify({ data: result.data || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(
      JSON.stringify({ data: [], error: 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
