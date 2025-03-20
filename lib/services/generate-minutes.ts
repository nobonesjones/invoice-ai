import OpenAI from 'openai';
import { supabase } from '@/config/supabase';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

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
    const prompt = `please give me precise meeting minutes for the below transcription. Format the output exactly like this:

Meeting Summary:
[1 sentence brief summary]

Main Action Items:
[list action items here, or "No action items agreed"]

Meeting Minutes:
[detailed minutes in plain direct language]

Transcription:
${fullTranscript}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });

    const minutes = completion.choices[0]?.message?.content;
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

    console.log('Successfully generated and stored minutes for meeting:', meetingId);
  } catch (error) {
    console.error('Error generating minutes:', error);
    throw error;
  }
}
