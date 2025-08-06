// Secure Transcription Edge Function
// Handles audio transcription through OpenAI Whisper API

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🎤 TRANSCRIBE: Request received, method:', req.method)
    console.log('🎤 TRANSCRIBE: Request headers:', Object.fromEntries(req.headers.entries()))
    
    // Get OpenAI key from environment
    const openaiKey = Deno.env.get('EXPO_PUBLIC_OPENAI_API_KEY')
    
    if (!openaiKey) {
      console.log('🔴 TRANSCRIBE: OpenAI key not found in environment')
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI key not configured in Edge Function',
          message: 'Please add EXPO_PUBLIC_OPENAI_API_KEY to your Supabase Edge Function secrets'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('🎤 TRANSCRIBE: OpenAI key found, parsing form data...')

    // Get the form data from the request (audio file)
    const formData = await req.formData()
    const audioFile = formData.get('file') as File
    const model = formData.get('model') as string || 'whisper-1'
    const language = formData.get('language') as string || 'en'
    
    console.log('🎤 TRANSCRIBE: Form data parsed:', {
      hasAudioFile: !!audioFile,
      audioFileName: audioFile?.name,
      audioFileSize: audioFile?.size,
      model,
      language
    })
    
    if (!audioFile) {
      console.log('🔴 TRANSCRIBE: No audio file in form data')
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('🎤 Transcribing audio file:', audioFile.name, audioFile.size, 'bytes')

    // Create form data for OpenAI
    const openaiFormData = new FormData()
    openaiFormData.append('file', audioFile)
    openaiFormData.append('model', model)
    openaiFormData.append('language', language)

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ OpenAI Whisper API error:', response.status, errorData)
      throw new Error(`OpenAI Whisper API error: ${response.status} - ${errorData}`)
    }

    const transcriptionData = await response.json()
    console.log('✅ Transcription successful:', transcriptionData.text?.substring(0, 100) + '...')
    
    return new Response(
      JSON.stringify(transcriptionData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ Transcription Edge Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})