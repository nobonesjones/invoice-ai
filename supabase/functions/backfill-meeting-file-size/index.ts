// supabase/functions/backfill-meeting-file-size/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "backfill-meeting-file-size" up and running!`)

// Utility function to parse bucket and path from Supabase storage URL
function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObject = new URL(url)
    // Example URL: https://<project_ref>.supabase.co/storage/v1/object/public/<bucket_name>/<path/to/file>
    const pathSegments = urlObject.pathname.split('/')
    // Expected indices: 0:'', 1:'storage', 2:'v1', 3:'object', 4:'public', 5:bucket_name, 6+:path
    if (pathSegments.length > 6 && pathSegments[5]) {
      const bucket = pathSegments[5]
      const path = pathSegments.slice(6).join('/')
      console.log(`Parsed URL: bucket='${bucket}', path='${path}'`); // Added logging
      return { bucket, path }
    }
    console.warn(`Could not parse expected structure from URL path: ${urlObject.pathname}`); // Added logging
    return null
  } catch (error) {
    console.error('Error parsing URL:', url, error)
    return null
  }
}


serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged-in user.
    // Note: Edge functions have service_role access by default,
    // but using Auth context can be useful for row-level security checks
    // if needed. For admin tasks like this, service_role is fine.
    const supabaseAdmin = createClient(
      // Supabase API URL - env var exported by default when deploying.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase Service Role Key - env var exported by default when deploying.
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      // Pass Auth header for potential RLS (though service role bypasses it)
      // Use service role key directly for admin tasks if preferred
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } } 
    )

    console.log("Fetching meetings needing file size update...");

    // Fetch meetings with missing file size and existing audio URL
    const { data: meetings, error: fetchError } = await supabaseAdmin
      .from('meetings')
      .select('id, audio_url')
      .or('file_size.is.null,file_size.eq.0') // Fetch if file_size is null or 0
      .not('audio_url', 'is', null)
      .eq('is_deleted', false) // Only consider active meetings

    if (fetchError) {
      console.error("Error fetching meetings:", fetchError)
      throw fetchError
    }

    if (!meetings || meetings.length === 0) {
      console.log("No meetings found needing file size update.")
      return new Response(JSON.stringify({ message: 'No meetings needed updating.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Found ${meetings.length} meetings to process.`);
    let updatedCount = 0;
    let errorCount = 0;
    const updatePromises = [];

    for (const meeting of meetings) {
      if (!meeting.audio_url) {
        console.warn(`Meeting ${meeting.id} has null audio_url, skipping.`);
        continue;
      }

      const parsedUrl = parseSupabaseUrl(meeting.audio_url);

      if (!parsedUrl) {
        console.error(`Could not parse audio_url for meeting ${meeting.id}: ${meeting.audio_url}`);
        errorCount++;
        continue;
      }

      try {
        console.log(`Getting metadata for: bucket=${parsedUrl.bucket}, path=${parsedUrl.path}`);
        // Use the Admin client's storage access
        const { data: metadata, error: metaError } = await supabaseAdmin.storage
          .from(parsedUrl.bucket)
          .getMetadata(parsedUrl.path)

        if (metaError) {
           // Handle specific 'Not found' error potentially differently
          if (metaError.message?.includes('Not found')) { 
              console.warn(`Storage object not found for meeting ${meeting.id} (bucket: ${parsedUrl.bucket}, path: ${parsedUrl.path}). Setting size to 0.`);
              // Still attempt update to 0 to mark as processed
              updatePromises.push(
                 supabaseAdmin
                  .from('meetings')
                  .update({ file_size: 0 })
                  .eq('id', meeting.id)
              );
              updatedCount++; 
          } else {
              console.error(`Error getting metadata for meeting ${meeting.id} (path: ${parsedUrl.path}):`, metaError.message)
              errorCount++;
          }
          continue; // Skip to next meeting on error
        }

        const fileSize = metadata?.size ?? 0;
        console.log(`Meeting ${meeting.id}: Found file size = ${fileSize}`);

        // Add update operation to promise list
        updatePromises.push(
           supabaseAdmin
            .from('meetings')
            .update({ file_size: fileSize })
            .eq('id', meeting.id)
        );
        updatedCount++; // Assume success for now, errors handled below

      } catch (e) {
        console.error(`Unexpected error processing meeting ${meeting.id}:`, e)
        errorCount++;
      }
    }

    // Wait for all updates to complete
    console.log(`Attempting to update ${updatedCount} meeting records...`);
    const results = await Promise.allSettled(updatePromises);

    let successfulUpdates = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
         // Check if the update itself had an error reported by Supabase
         if (result.value.error) {
             console.error(`Error updating meeting record ${meetings[index]?.id}:`, result.value.error.message);
             errorCount++;
             updatedCount--; // Decrement count as it failed
         } else {
            successfulUpdates++;
         }
      } else {
        console.error(`Failed to execute update for meeting ${meetings[index]?.id}:`, result.reason);
        errorCount++;
        updatedCount--; // Decrement count as it failed
      }
    });

    const message = `Backfill complete. Successfully updated: ${successfulUpdates}. Errors/Skipped: ${errorCount}.`;
    console.log(message);

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Unhandled error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
