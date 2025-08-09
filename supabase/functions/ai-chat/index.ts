// Secure AI Edge Function for both Chat Completions and Assistants API
// Handles OpenAI API calls securely on the server side

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI key from environment
    const openaiKey = Deno.env.get('EXPO_PUBLIC_OPENAI_API_KEY')
    
    if (!openaiKey) {
      console.log('🔴 AI: OpenAI key not found in environment')
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

    // Get the request body and determine API type
    const body = await req.json()
    const { api_type, test = false } = body
    
    // Handle test calls
    if (test) {
      console.log('🟢 AI: Edge Function test successful')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Edge Function test successful! OpenAI key is configured.',
          keyPrefix: openaiKey.substring(0, 10) + '...'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate OpenAI API based on api_type
    if (api_type === 'assistants') {
      return await handleAssistantsAPI(body, openaiKey)
    } else {
      return await handleChatCompletions(body, openaiKey)
    }
    
  } catch (error) {
    console.error('❌ AI Edge Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Handle Chat Completions API calls (existing functionality)
async function handleChatCompletions(body: any, openaiKey: string) {
  const { messages, temperature = 0.7, functions } = body
  
  console.log('🤖 Making Chat Completions API call...')
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
    throw new Error(`OpenAI Chat Completions API error: ${response.status} - ${errorData}`)
  }

  const data = await response.json()
  
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handle Assistants API calls (new functionality)
async function handleAssistantsAPI(body: any, openaiKey: string) {
  const { action, data: requestData } = body
  
  console.log('🤖 Making Assistants API call:', action)
  
  let url = ''
  let method = 'GET'
  let requestBody = null
  
  // Route different assistant actions
  switch (action) {
    case 'create_assistant':
      url = 'https://api.openai.com/v1/assistants'
      method = 'POST'
      requestBody = requestData
      break
      
    case 'create_thread':
      url = 'https://api.openai.com/v1/threads'
      method = 'POST'
      requestBody = requestData || {}
      break
      
    case 'add_message':
      const { thread_id, ...messageData } = requestData
      url = `https://api.openai.com/v1/threads/${thread_id}/messages`
      method = 'POST'
      requestBody = messageData
      break
      
    case 'create_run':
      const { thread_id: runThreadId, ...runData } = requestData
      url = `https://api.openai.com/v1/threads/${runThreadId}/runs`
      method = 'POST'
      requestBody = runData
      break
      
    case 'get_run':
      const { thread_id: getRunThreadId, run_id } = requestData
      url = `https://api.openai.com/v1/threads/${getRunThreadId}/runs/${run_id}`
      method = 'GET'
      break
      
    case 'submit_tool_outputs':
      const { thread_id: submitThreadId, run_id: submitRunId, ...submitData } = requestData
      url = `https://api.openai.com/v1/threads/${submitThreadId}/runs/${submitRunId}/submit_tool_outputs`
      method = 'POST'
      requestBody = submitData
      break
      
    case 'list_messages':
      const { thread_id: listThreadId, ...queryParams } = requestData
      const queryString = new URLSearchParams(queryParams).toString()
      url = `https://api.openai.com/v1/threads/${listThreadId}/messages${queryString ? '?' + queryString : ''}`
      method = 'GET'
      break
      
    case 'cancel_run':
      const { thread_id: cancelThreadId, run_id: cancelRunId } = requestData
      url = `https://api.openai.com/v1/threads/${cancelThreadId}/runs/${cancelRunId}/cancel`
      method = 'POST'
      break
      
    case 'list_runs':
      const { thread_id: listRunsThreadId, ...runQueryParams } = requestData
      const runQueryString = new URLSearchParams(runQueryParams).toString()
      url = `https://api.openai.com/v1/threads/${listRunsThreadId}/runs${runQueryString ? '?' + runQueryString : ''}`
      method = 'GET'
      break
      
    default:
      throw new Error(`Unsupported assistant action: ${action}`)
  }
  
  // Make the OpenAI API request
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    ...(requestBody && { body: JSON.stringify(requestBody) })
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`OpenAI Assistants API error: ${response.status} - ${errorData}`)
  }

  const data = await response.json()
  
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}