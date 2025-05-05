// supabase/functions/test-hello/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

console.log('Hello function started!');

serve(async (req: Request) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  const data = {
    message: `Hello from test-hello Edge Function! Method: ${req.method}`,
    timestamp: new Date().toISOString(),
  };

  return new Response(
    JSON.stringify(data),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
