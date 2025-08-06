// Test Edge Function for AI Chat
// This is a safe test that won't break your existing setup

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI key from environment (will be set in Supabase dashboard)
    const openaiKey = Deno.env.get('EXPO_PUBLIC_OPENAI_API_KEY')
    
    // For testing, let's first check if the key exists
    if (!openaiKey) {
      console.log('🔴 TEST: OpenAI key not found in environment')
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI key not configured in Edge Function',
          test: true,
          message: 'Please add OPENAI_API_KEY to your Supabase Edge Function secrets'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Get the request body
    const { messages, temperature = 0.7, functions, test = false } = await req.json()
    
    // If this is just a test call, return success without calling OpenAI
    if (test) {
      console.log('🟢 TEST: Edge Function is working! Key is configured.')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Edge Function test successful! OpenAI key is configured.',
          keyPrefix: openaiKey.substring(0, 10) + '...' // Show key prefix for verification
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Real OpenAI call (same as your current code)
    console.log('🤖 Making real OpenAI API call...')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: 1000,
        ...(functions && { functions, function_call: 'auto' })
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ Edge Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})