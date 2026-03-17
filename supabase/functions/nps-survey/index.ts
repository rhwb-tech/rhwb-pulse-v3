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

    console.log('[NPS] Step 1 - JWT valid, userEmail:', userEmail)

    // 2. Parse request body
    const { action, season, responses } = await req.json()
    console.log('[NPS] Step 2 - action:', action, 'season:', season)

    if (!action || !season) {
      return new Response(
        JSON.stringify({ error: 'action and season are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Service client for privileged queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Verify role is runner/athlete (not coach/admin)
    const { data: roleData } = await supabase
      .from('v_pulse_roles')
      .select('role')
      .eq('email_id', userEmail)
      .single()

    const role = roleData?.role || 'runner'
    console.log('[NPS] Step 4 - Role:', role)

    if (role !== 'runner' && role !== 'athlete' && role !== 'hybrid') {
      return new Response(
        JSON.stringify({ error: 'Survey is only available for runners' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Map email → runner_id
    const { data: profile } = await supabase
      .from('runners_profile')
      .select('runner_id')
      .eq('email_id', userEmail)
      .single()

    if (!profile?.runner_id) {
      console.log('[NPS] No runner_id found for email:', userEmail)
      return new Response(
        JSON.stringify({ error: 'Runner profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const runnerId = profile.runner_id
    console.log('[NPS] Step 5 - runner_id:', runnerId)

    // 6. Route by action
    if (action === 'check') {
      return await handleCheck(supabase, userEmail, runnerId, season)
    } else if (action === 'submit') {
      return await handleSubmit(supabase, userEmail, runnerId, season, responses)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "check" or "submit"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    console.error('[NPS] Edge Function unhandled error:', error?.message || error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  userEmail: string,
  runnerId: string,
  season: string
) {
  console.log('[NPS] CHECK - email:', userEmail, 'season:', season)

  // TODO: Uncomment Meso 3 check after testing
  // const { data: meso3Data } = await supabase
  //   .from('v_quantitative_scores')
  //   .select('meso')
  //   .eq('email_id', userEmail)
  //   .eq('season', season)
  //   .eq('meso', 'Meso 3')
  //   .limit(1)
  // const hasMeso3 = (meso3Data && meso3Data.length > 0) || false

  const hasMeso3 = true // TESTING: bypass Meso 3 check
  console.log('[NPS] CHECK - hasMeso3:', hasMeso3)

  // Check if already submitted in Supabase
  const { data: existingResponse } = await supabase
    .from('nps_survey_responses')
    .select('id')
    .eq('runner_id', runnerId)
    .eq('season', season)
    .limit(1)

  const alreadySubmitted = (existingResponse && existingResponse.length > 0) || false
  console.log('[NPS] CHECK - alreadySubmitted:', alreadySubmitted)

  // Get runner metadata from runner_season_info
  const seasonNo = parseInt(season.replace(/\D/g, ''), 10)
  const { data: seasonInfo } = await supabase
    .from('runner_season_info')
    .select('coach, segment, race_distance')
    .eq('email_id', userEmail)
    .eq('season_no', seasonNo)
    .single()

  const info = seasonInfo || {}
  console.log('[NPS] CHECK - seasonInfo:', JSON.stringify(info))

  // Look up coach email from rhwb_coaches by coach name
  let coachEmail: string | null = null
  if (info.coach) {
    const { data: coachData } = await supabase
      .from('rhwb_coaches')
      .select('email_id')
      .eq('coach', info.coach)
      .single()
    coachEmail = coachData?.email_id || null
  }
  console.log('[NPS] CHECK - coachEmail:', coachEmail)

  // Lite runner: no runner_season_info record OR segment is 'Lite'
  const isLiteRunner = !seasonInfo || (info.segment || '').toLowerCase() === 'lite'
  console.log('[NPS] CHECK - isLiteRunner:', isLiteRunner)

  return new Response(
    JSON.stringify({
      hasMeso3,
      alreadySubmitted,
      metadata: {
        program: info.segment || null,
        race_type: info.race_distance || null,
        coach_email: coachEmail,
        coach_name: info.coach || null,
        is_lite_runner: isLiteRunner,
      }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleSubmit(
  supabase: ReturnType<typeof createClient>,
  userEmail: string,
  runnerId: string,
  season: string,
  responses: Record<string, unknown>
) {
  console.log('[NPS] SUBMIT - email:', userEmail, 'season:', season)

  if (!responses) {
    return new Response(
      JSON.stringify({ error: 'responses object is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get runner metadata
  const seasonNo = parseInt(season.replace(/\D/g, ''), 10)
  const { data: seasonInfo } = await supabase
    .from('runner_season_info')
    .select('coach, segment, race_distance')
    .eq('email_id', userEmail)
    .eq('season_no', seasonNo)
    .single()

  const info = seasonInfo || {}

  // Look up coach email from rhwb_coaches by coach name
  let coachEmail: string | null = null
  if (info.coach) {
    const { data: coachData } = await supabase
      .from('rhwb_coaches')
      .select('email_id')
      .eq('coach', info.coach)
      .single()
    coachEmail = coachData?.email_id || null
  }

  const isLiteRunner = !seasonInfo || (info.segment || '').toLowerCase() === 'lite'

  // For Lite runners: map lite fields into existing columns
  // recommendation → lite_rating, comments → "LITE_REASONS: ...\nLITE_COMMENTS: ..."
  // Coach-specific ratings stay null
  const surveyData = {
    runner_id: runnerId,
    email_id: userEmail,
    coach_email: coachEmail,
    season,
    feedback_quality: isLiteRunner ? null : (responses.feedback_quality ?? null),
    communication: isLiteRunner ? null : (responses.communication ?? null),
    relationship: isLiteRunner ? null : (responses.relationship ?? null),
    recommendation: isLiteRunner ? (responses.lite_rating ?? null) : (responses.recommendation ?? null),
    comments: isLiteRunner
      ? [
          responses.lite_reasons?.length ? `LITE_REASONS: ${(responses.lite_reasons as string[]).join('; ')}` : null,
          responses.lite_comments ? `LITE_COMMENTS: ${responses.lite_comments}` : null,
        ].filter(Boolean).join('\n') || null
      : (responses.comments || null),
    rhwb_effectiveness: responses.rhwb_effectiveness ?? null,
    rhwb_knowledge_depth: responses.rhwb_knowledge_depth ?? null,
    rhwb_recommendation: responses.rhwb_recommendation ?? null,
    rhwb_comments: responses.rhwb_comments || null,
    pulse_experience: responses.pulse_experience || null,
    program: info.segment || null,
    are_you_a_new_or_return_runner_to_rhwb: null,
    race_type: info.race_distance || null,
  }

  // 1. Write to Cloud Run (HIPAA primary store) — 8s timeout so it never blocks Supabase write
  const cloudRunUrl = Deno.env.get('CLOUD_RUN_URL')!
  const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')!

  try {
    const cloudRunController = new AbortController()
    const cloudRunTimeout = setTimeout(() => cloudRunController.abort(), 8000)

    const cloudRunResponse = await fetch(`${cloudRunUrl}/submit-nps-survey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cloudRunApiKey,
      },
      body: JSON.stringify(surveyData),
      signal: cloudRunController.signal,
    })

    clearTimeout(cloudRunTimeout)

    if (!cloudRunResponse.ok) {
      const body = await cloudRunResponse.text().catch(() => '')
      console.error('[NPS] Cloud Run error:', cloudRunResponse.status, body, '| email:', userEmail)
    } else {
      console.log('[NPS] SUBMIT - Cloud Run write successful | email:', userEmail)
    }
  } catch (cloudRunError: any) {
    if (cloudRunError?.name === 'AbortError') {
      console.error('[NPS] Cloud Run timed out (>8s) | email:', userEmail)
    } else {
      console.error('[NPS] Cloud Run write failed:', cloudRunError?.message, '| email:', userEmail)
    }
    // Continue with Supabase write even if Cloud Run fails
  }

  // 2. Dual-write to Supabase (for coach portal views)
  const { error: supabaseError } = await supabase
    .from('nps_survey_responses')
    .upsert(surveyData, { onConflict: 'runner_id,season' })

  if (supabaseError) {
    console.error('[NPS] Supabase write error | email:', userEmail, '| code:', supabaseError.code, '| message:', supabaseError.message, '| details:', supabaseError.details)
    return new Response(
      JSON.stringify({ error: 'Failed to save survey response' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('[NPS] SUBMIT - Supabase write successful | email:', userEmail)

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
