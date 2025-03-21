import OpenAI from 'openai';
import { supabase } from '@/config/supabase';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

async function extractAndSaveActionItems(minutes: string, meetingId: string) {
  try {
    console.log('Starting action items extraction for meeting:', meetingId);
    console.log('Minutes content:', minutes);

    // Find the action items section
    const actionItemsMatch = minutes.match(/Main Action Items:\n([\s\S]*?)(?=\n\n|$)/);
    console.log('Action items match:', actionItemsMatch);

    if (!actionItemsMatch || actionItemsMatch[1].trim() === 'No action items agreed') {
      console.log('No action items found for meeting:', meetingId);
      return;
    }

    // Split into individual items and clean them up
    const actionItems = actionItemsMatch[1]
      .split('\n')
      .map(item => item.trim())
      .filter(item => item && item !== 'No action items agreed');

    console.log('Extracted action items:', actionItems);

    // Save each action item to the database
    for (const content of actionItems) {
      console.log('Attempting to save action item:', content);
      const { data, error } = await supabase
        .from('action_items')
        .insert({
          meeting_id: meetingId,
          content,
          completed: false,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error saving action item:', error);
      } else {
        console.log('Successfully saved action item:', data);
      }
    }

    console.log(`Saved ${actionItems.length} action items for meeting:`, meetingId);
  } catch (error) {
    console.error('Error extracting action items:', error);
  }
}

export async function generateAndStoreMeetingMinutes(meetingId: string): Promise<void> {
  try {
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

    // 3. Generate minutes using OpenAI
    const prompt = `Please analyze this meeting transcript and create detailed meeting minutes with the following structure:

Meeting Summary:
[A concise 2-3 sentence overview of the key points discussed]

Meeting Minutes:
[Convert the discussion into clear bullet points, with each point representing a distinct topic or decision. Format as:
• Point 1
• Point 2
• Point 3
etc.]

Main Action Items:
[List specific tasks or actions agreed upon, with each on a new line starting with a bullet point:
• Action item 1
• Action item 2
• Action item 3
etc.]

Here's the transcript:
${fullTranscript}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional meeting minutes creator. Create clear, well-structured minutes with bullet points for easy readability."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const minutes = completion.choices[0].message.content || '';
    if (!minutes) {
      console.log('No minutes generated for meeting:', meetingId);
      return;
    }

    // 4. Store minutes in the meetings table
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ minutes_text: minutes })
      .eq('id', meetingId);

    if (updateError) throw updateError;

    // 5. Extract and save action items
    await extractAndSaveActionItems(minutes, meetingId);

    console.log('Successfully generated and stored minutes for meeting:', meetingId);
  } catch (error) {
    console.error('Error generating minutes:', error);
    throw error;
  }
}
