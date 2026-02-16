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

    if (action === 'chat') {
      const { message, conversationHistory, useRhwbSources: useRhwb, priorityInstruction, weatherData: clientWeather } = body
      if (!message) {
        return jsonResponse({ error: 'message is required' }, 400)
      }

      // Fetch workouts for today/tomorrow (view includes profile fields)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const fmtDate = (d: Date) => d.toISOString().split('T')[0]

      const { data: workouts } = await supabase
        .from('veer_user_workouts')
        .select('*')
        .eq('email_id', userEmail)
        .in('workout_date', [fmtDate(today), fmtDate(tomorrow)])

      // Build user context from server-side data (PHI stays server-side)
      const contextLines: string[] = ['--- CURRENT USER CONTEXT ---']
      if (workouts && workouts.length > 0) {
        const first = workouts[0]
        const skipKeys = new Set([
          'id', 'created_at', 'updated_at', 'workout_name', 'description',
          'planned_distance', 'workout_date',
          'email_id', 'first_name', 'last_name', 'runner_name',
          'zip', 'gender', 'coach_email', 'phone_no', 'address',
          'city', 'state', 'country', 'dob', 'runner_id',
          'profile_picture', 'referred_by', 'referred_by_email_id',
        ])

        const labelMap: Record<string, string> = {
          fitness_level: 'Fitness Level', goals: 'Current Goal',
          subscription_tier: 'Subscription Tier', season: 'Season',
          meso: 'Meso', week_number: 'Week', activity: 'Activity Type',
          group_name: 'Group', program: 'Program', level: 'Level',
          pace_zone: 'Pace Zone', target_pace: 'Target Pace',
          race_distance: 'Race Distance', program_type: 'Program Type',
          coach_name: 'Coach',
        }

        for (const [key, value] of Object.entries(first)) {
          if (skipKeys.has(key) || value === null || value === undefined || value === '') continue
          const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          contextLines.push(`${label}: ${value}`)
        }

        const todayStr = fmtDate(today)
        const tomorrowStr = fmtDate(tomorrow)
        const todayWorkouts = workouts.filter((w: any) => w.workout_date === todayStr)
        const tomorrowWorkouts = workouts.filter((w: any) => w.workout_date === tomorrowStr)

        if (todayWorkouts.length > 0) {
          contextLines.push('', "Today's Workouts:")
          todayWorkouts.forEach((w: any, i: number) => {
            contextLines.push(`  ${i + 1}. ${w.workout_name} (${w.activity})`)
            if (w.planned_distance) contextLines.push(`     Distance: ${w.planned_distance} mi`)
            if (w.description) {
              const cleaned = (w.description as string).replace(/https?:\/\/[^\s]+/g, '').trim()
              if (cleaned) contextLines.push(`     Details: ${cleaned.substring(0, 200)}`)
            }
          })
        }

        if (tomorrowWorkouts.length > 0) {
          contextLines.push('', "Tomorrow's Workouts:")
          tomorrowWorkouts.forEach((w: any, i: number) => {
            contextLines.push(`  ${i + 1}. ${w.workout_name} (${w.activity})`)
            if (w.planned_distance) contextLines.push(`     Distance: ${w.planned_distance} mi`)
            if (w.description) {
              const cleaned = (w.description as string).replace(/https?:\/\/[^\s]+/g, '').trim()
              if (cleaned) contextLines.push(`     Details: ${cleaned.substring(0, 200)}`)
            }
          })
        }
      }

      // Weather from client (not PHI, just temperature/conditions)
      if (clientWeather?.today) {
        contextLines.push('')
        contextLines.push(`Today's Weather: ${clientWeather.today.temp}\u00B0F, ${clientWeather.today.conditions}, wind ${clientWeather.today.wind} mph`)
      }
      if (clientWeather?.tomorrow) {
        contextLines.push(`Tomorrow's Forecast: ${clientWeather.tomorrow.temp}\u00B0F, ${clientWeather.tomorrow.conditions}, wind ${clientWeather.tomorrow.wind} mph`)
      }

      contextLines.push('----------------------------')
      const userContext = '\n\n' + contextLines.join('\n')

      // Build system instruction
      let systemText: string
      if (!useRhwb) {
        systemText = 'You are Veer, a helpful running assistant. Answer questions about running, training, nutrition, and fitness using your general knowledge.' + userContext
      } else {
        systemText = `You are Veer, a helpful running assistant for RHWB (Run Happy With Bhumika).

CRITICAL RULE: When a coach profile has an [Image Source] field containing a URL, you MUST include it as the FIRST line of your response using this exact markdown syntax:
![Coach Name](the_exact_image_url)

The source documents use three formats:

1) Coach profiles have fields: [Role], [Coach Name], [Profile Description], [Image Source], [Profile URL]
2) YouTube transcripts have fields: Video Title, Video URL, Video ID, Description, TRANSCRIPT START/END
3) Blog posts have fields: Title, Description, URL, Image URL (optional), Blog Text Start/End

Rules for each source type:

PERSON QUERIES:
When the user asks about a specific person:
1. FIRST, find and present their coach profile (image, description, profile link) as described below
2. THEN, search for that person's name across ALL other sources (blog posts, YouTube videos) and include any additional content where they are mentioned or featured
3. Present the additional content after the profile summary, grouped by type

COACH PROFILES:
- ALWAYS include the image first: ![Coach Name](image_url) using the exact [Image Source] URL
- If [Image Source] is empty, skip the image
- Summarize [Profile Description] in 2-3 sentences
- Link to profile: [View Profile](profile_url)

YOUTUBE VIDEOS:
- Include the video link on its own line: [Video Title](video_url)
- Summarize the key points, do NOT quote the raw transcript

BLOG POSTS:
- If the blog post has an [Image URL] field, include the image FIRST: ![Title](image_url)
- If [Image URL] is empty or missing, skip the image
- Summarize the key points, do NOT quote the full blog text
- Include a link: [Read More](blog_url)

URLS:
- Any URL found in the source documents (blog URLs, video URLs, profile URLs, or any other link) MUST be included as a clickable markdown link in the response
- Use the format [descriptive text](url) so the user can click through to the original content
- Never omit a URL that appears in a source document you are referencing

Format all responses with clear markdown.` + userContext
      }

      if (priorityInstruction && useRhwb) {
        systemText += `\n\nPriority instruction for this query: ${priorityInstruction}`
      }

      // Build full prompt with conversation history
      const fullPrompt = conversationHistory
        ? `${conversationHistory}\n\nUser: ${message}\n\nAssistant:`
        : message

      // Call Cloud Run /veer-chat → Vertex AI (HIPAA-compliant, covered by GCP BAA)
      const chatRes = await fetch(`${cloudRunUrl}/veer-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cloudRunApiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          systemInstruction: { parts: [{ text: systemText }] },
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      })

      if (!chatRes.ok) {
        const errText = await chatRes.text()
        console.error('Cloud Run error (chat):', chatRes.status, errText)
        return jsonResponse({ error: 'Chat service error' }, 502)
      }

      const chatResult = await chatRes.json()
      const responseText = chatResult.candidates?.[0]?.content?.parts?.[0]?.text || ''

      if (!responseText) {
        console.error('Empty Vertex AI response:', JSON.stringify(chatResult))
        return jsonResponse({ error: 'No response from AI' }, 502)
      }

      return jsonResponse({ data: { response: responseText } })
    }

    if (action === 'format-descriptions') {
      const { descriptions } = body
      if (!descriptions || typeof descriptions !== 'object') {
        return jsonResponse({ error: 'descriptions object is required' }, 400)
      }

      const prompt = `Format each workout description below into a clean, concise summary (1-2 sentences max). Remove URLs. Return ONLY valid JSON object mapping keys to formatted strings, nothing else.\n\n${JSON.stringify(descriptions)}`

      const fmtRes = await fetch(`${cloudRunUrl}/veer-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cloudRunApiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: 'Return only valid JSON. No markdown, no explanation.' }] },
          generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
        }),
      })

      if (!fmtRes.ok) {
        console.error('Cloud Run error (format-descriptions):', fmtRes.status, await fmtRes.text())
        return jsonResponse({ data: {} })
      }

      const fmtResult = await fmtRes.json()
      const fmtText = fmtResult.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const cleaned = fmtText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

      try {
        const parsed = JSON.parse(cleaned)
        return jsonResponse({ data: parsed })
      } catch {
        console.warn('Could not parse formatted descriptions:', cleaned)
        return jsonResponse({ data: {} })
      }
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)

  } catch (error) {
    console.error('Edge Function error:', error)
    return jsonResponse({ data: [], error: 'Internal server error' })
  }
})
