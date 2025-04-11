import OpenAI from 'openai';
import { supabase } from '@/config/supabase';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
});

async function extractAndSaveActionItems(minutes: string, meetingId: string) {
  try {
    console.log('Starting action items extraction for meeting:', meetingId);

    // Find the action items section with more flexible pattern matching
    // This handles both "Main Action Items:" and "Action Items:" formats
    const actionItemsMatch = minutes.match(/(?:Main\s+)?Action\s+Items:?\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|\s*$)/i);
    
    if (!actionItemsMatch || !actionItemsMatch[1] || actionItemsMatch[1].trim() === 'No action items agreed') {
      console.log('No action items found for meeting:', meetingId);
      
      // Even if no action items found, we'll create a placeholder to indicate we checked
      const { error } = await supabase
        .from('action_items')
        .upsert([{
          meeting_id: meetingId,
          content: 'No action items identified',
          completed: false,
          created_at: new Date().toISOString()
        }], { onConflict: 'meeting_id,content' })
        .select();
        
      if (error) {
        console.error('Error creating placeholder action item:', error);
      }
      return;
    }

    // Split into individual items and clean them up
    const actionItems = actionItemsMatch[1]
      .split(/\n/)
      .map(item => item.trim().replace(/^[•\-\*]\s*/, '')) // Remove bullet points
      .filter(item => item && item !== 'No action items agreed' && item.length > 3);

    console.log(`Extracted ${actionItems.length} action items:`, actionItems);

    // Delete any existing action items for this meeting to avoid duplicates
    const { error: deleteError } = await supabase
      .from('action_items')
      .delete()
      .eq('meeting_id', meetingId);
      
    if (deleteError) {
      console.error('Error deleting existing action items:', deleteError);
    }

    // Save action items in a batch
    if (actionItems.length > 0) {
      const actionItemsToInsert = actionItems.map(content => ({
        meeting_id: meetingId,
        content,
        completed: false,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('action_items')
        .insert(actionItemsToInsert)
        .select();

      if (error) {
        console.error('Error saving action items:', error);
      } else {
        console.log(`Successfully saved ${actionItemsToInsert.length} action items`);
      }
    } else {
      // If no valid action items were found after filtering, create a placeholder
      const { error } = await supabase
        .from('action_items')
        .upsert([{
          meeting_id: meetingId,
          content: 'No action items identified',
          completed: false,
          created_at: new Date().toISOString()
        }], { onConflict: 'meeting_id,content' })
        .select();
        
      if (error) {
        console.error('Error creating placeholder action item:', error);
      }
    }
  } catch (error) {
    console.error('Error extracting action items:', error);
  }
}

export async function generateAndStoreMeetingMinutes(meetingId: string): Promise<void> {
  try {
    console.log('Starting minutes generation for meeting:', meetingId);
    
    // 1. Fetch transcripts for the meeting
    const { data: transcripts, error: transcriptError } = await supabase
      .from('transcripts')
      .select('content')
      .eq('meeting_id', meetingId)
      .order('timestamp', { ascending: true });

    if (transcriptError) throw transcriptError;
    if (!transcripts?.length) {
      console.log('No transcripts found for meeting:', meetingId);
      return;
    }

    // 2. Combine all transcripts
    const fullTranscript = transcripts.map(t => t.content).join('\n');
    
    // Limit transcript length if it's too long
    const maxLength = 8000; // Characters
    const truncatedTranscript = fullTranscript.length > maxLength 
      ? fullTranscript.substring(0, maxLength) + "... [transcript truncated due to length]"
      : fullTranscript;

    console.log(`Transcript length: ${fullTranscript.length} characters, using ${truncatedTranscript.length} characters`);

    // 3. Generate minutes using OpenAI - using a faster model
    const prompt = `Please analyze this meeting transcript and create concise meeting minutes with the following structure:

Meeting Summary:
[A concise 2-3 sentence overview of the key points discussed]

Meeting Minutes:
[Convert the discussion into clear bullet points, with each point representing a distinct topic or decision]

Main Action Items:
[List specific tasks or actions agreed upon, with each on a new line starting with a bullet point]

Here's the transcript:
${truncatedTranscript}`;

    console.log('Sending request to OpenAI...');
    const startTime = Date.now();
    
    // Use gpt-3.5-turbo instead of gpt-4 for faster response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // Using the latest 3.5 model which is much faster
      messages: [
        {
          role: "system",
          content: "You are a professional meeting minutes creator. Create clear, concise minutes with bullet points for easy readability. Be brief but comprehensive."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5, // Lower temperature for more consistent results
      max_tokens: 1000, // Limit response size
    });

    const endTime = Date.now();
    console.log(`OpenAI response received in ${(endTime - startTime) / 1000} seconds`);

    const minutes = completion.choices[0].message.content || '';
    if (!minutes) {
      console.log('No minutes generated for meeting:', meetingId);
      return;
    }

    // 4. Store minutes in the meetings table
    console.log('Storing minutes in database...');
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ 
        minutes_text: minutes,
        has_minutes: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting with minutes:', updateError);
      throw updateError;
    } else {
      console.log('Successfully stored minutes for meeting:', meetingId);
    }

    // 5. Extract and save action items
    await extractAndSaveActionItems(minutes, meetingId);

    console.log('Successfully generated and stored minutes for meeting:', meetingId);
  } catch (error) {
    console.error('Error generating minutes:', error);
    throw error;
  }
}
