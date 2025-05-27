// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

console.log("Supabase Edge Function 'upload-logo' is ready.");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { fileName, fileType, base64 } = await req.json();

    if (!fileName || !fileType || !base64) {
      return new Response(JSON.stringify({ error: "Missing fields: fileName, fileType, and base64 are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Decode base64 to Uint8Array
    const fileBuffer = base64Decode(base64);

    // Create Supabase client
    // Ensure EXPO_PUBLIC_API_URL and SERVICE_KEY are set in your Edge Function's environment variables
    const supabase = createClient(
      Deno.env.get("EXPO_PUBLIC_API_URL")!,
      Deno.env.get("SERVICE_KEY")!
    );

    const filePath = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { data, error } = await supabase.storage
      .from("businesslogos")
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: true,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return new Response(JSON.stringify({ error: error.message, details: error.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data: urlData } = supabase.storage
      .from("businesslogos")
      .getPublicUrl(filePath);

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error('Error processing request:', e);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
