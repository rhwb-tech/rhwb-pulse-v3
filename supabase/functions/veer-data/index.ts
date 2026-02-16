import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // 1. Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401)
    }

    const userEmail = user.email
    if (!userEmail) {
      return jsonResponse({ error: 'No email in token' }, 401)
    }

    // 2. Parse request body
    const body = await req.json()
    const { action } = body

    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400)
    }

    // 3. Service client for privileged queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Map email → runner_id (needed for feedback actions that go to Cloud SQL)
    const { data: profile, error: profileError } = await supabase
      .from('runners_profile')
      .select('runner_id')
      .eq('email_id', userEmail)
      .single()

    if (profileError || !profile?.runner_id) {
      return jsonResponse({ data: [], error: 'Runner profile not found' })
    }

    const runnerId = profile.runner_id

    // 5. Cloud Run config (for feedback actions)
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_URL')!
    const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')!

    // 6. Route by action
    if (action === 'get-workouts') {
      // veer_user_workouts is a Supabase view — query it directly
      const { dates } = body
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return jsonResponse({ error: 'dates array is required' }, 400)
      }

      const { data: workouts, error: workoutsError } = await supabase
        .from('veer_user_workouts')
        .select('*')
        .eq('email_id', userEmail)
        .in('workout_date', dates.slice(0, 7))

      if (workoutsError) {
        console.error('Error fetching workouts:', workoutsError)
        return jsonResponse({ data: [], error: 'Failed to fetch workouts' })
      }

      return jsonResponse({ data: workouts || [] })
    }

    if (action === 'upsert-feedback') {
      const { message_id, feedback, user_question, assistant_response } = body
      if (!message_id || !feedback) {
        return jsonResponse({ error: 'message_id and feedback are required' }, 400)
      }

      const cloudRes = await fetch(`${cloudRunUrl}/upsert-veer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cloudRunApiKey,
        },
        body: JSON.stringify({
          message_id,
          runner_id: runnerId,
          feedback,
          user_question: user_question || null,
          assistant_response: assistant_response || null,
        }),
      })

      if (!cloudRes.ok) {
        console.error('Cloud Run error (upsert-feedback):', cloudRes.status, await cloudRes.text())
        return jsonResponse({ success: false, error: 'Failed to upsert feedback' })
      }

      return jsonResponse({ success: true })
    }

    if (action === 'delete-feedback') {
      const { message_id } = body
      if (!message_id) {
        return jsonResponse({ error: 'message_id is required' }, 400)
      }

      const cloudRes = await fetch(`${cloudRunUrl}/delete-veer-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cloudRunApiKey,
        },
        body: JSON.stringify({ message_id, runner_id: runnerId }),
      })

      if (!cloudRes.ok) {
        console.error('Cloud Run error (delete-feedback):', cloudRes.status, await cloudRes.text())
        return jsonResponse({ success: false, error: 'Failed to delete feedback' })
      }

      return jsonResponse({ success: true })
    }

    if (action === 'update-feedback-comment') {
      const { message_id, comment } = body
      if (!message_id || !comment) {
        return jsonResponse({ error: 'message_id and comment are required' }, 400)
      }

      const cloudRes = await fetch(`${cloudRunUrl}/update-veer-feedback-comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cloudRunApiKey,
        },
        body: JSON.stringify({ message_id, runner_id: runnerId, comment }),
      })

      if (!cloudRes.ok) {
        console.error('Cloud Run error (update-feedback-comment):', cloudRes.status, await cloudRes.text())
        return jsonResponse({ success: false, error: 'Failed to update comment' })
      }

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)

  } catch (error) {
    console.error('Edge Function error:', error)
    return jsonResponse({ data: [], error: 'Internal server error' })
  }
})
