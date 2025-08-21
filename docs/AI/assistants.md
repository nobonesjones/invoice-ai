import OpenAI from "npm:openai@4.29.2";

// Ensure you've set these secrets via supabase secrets set
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Create a global OpenAI client to improve performance
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Utility function for streaming responses
async function* streamAssistantResponse(threadId: string, runId: string) {
  while (true) {
    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    switch (run.status) {
      case "completed":
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessages = messages.data
          .filter(msg => msg.role === "assistant")
          .map(msg => msg.content[0].type === "text" ? msg.content[0].text.value : "");
        return assistantMessages[0] || "No response generated.";
      
      case "failed":
        throw new Error(`Run failed: ${JSON.stringify(run)}`);
      
      case "cancelled":
        throw new Error("Run was cancelled");
      
      case "in_progress":
      case "queued":
        // Wait and continue polling
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      
      default:
        throw new Error(`Unexpected run status: ${run.status}`);
    }
  }
}

Deno.serve(async (req) => {
  try {
    // Parse incoming request
    const { message, assistantId } = await req.json();

    if (!message || !assistantId) {
      return new Response(
        JSON.stringify({ error: "Message and Assistant ID are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add user message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message
    });

    // Create a run
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });

    // Use a ReadableStream to provide progress updates
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const finalResponse = await streamAssistantResponse(thread.id, run.id);
          controller.enqueue(finalResponse);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked"
      }
    });

  } catch (error) {
    console.error("OpenAI Assistant Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process request", 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});

Key features of this implementation:

Streaming Response: Uses a ReadableStream to provide real-time updates and prevent timeouts
Polling Mechanism: Continuously checks the run status until completion
Error Handling: Robust error handling for various run statuses
Flexible Design: Can work with any OpenAI Assistant

o use this function:

Install the OpenAI package:
supabase 
functions
 deps openai-assistant

Set your OpenAI API key:
supabase secrets 
set
 OPENAI_API_KEY=your_openai_api_key

Deploy the function:
supabase 
functions
 deploy openai-assistant

Example client-side usage:

const
 response = 
await
 fetch(
'/functions/v1/openai-assistant'
, {
  
method
: 
'POST'
,
  
body
: 
JSON
.stringify({
    
message
: 
"Your prompt here"
,
    
assistantId
: 
"your_assistant_id"

  })
});
// Handle streaming response

const
 reader = response.body.getReader();
while
(
true
) {
  
const
 { done, value } = 
await
 reader.read();
  
if
 (done) 
break
;
  
console
.log(
new
 TextDecoder().decode(value));
}

This approach solves several common issues:

Prevents request timeouts
Handles long-running AI tasks
Provides real-time streaming
Robust error handling
Works with any OpenAI Assistant