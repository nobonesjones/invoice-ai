import OpenAI from 'openai';
import { supabase } from '@/config/supabase';
import * as FileSystem from 'expo-file-system';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key not found in environment variables');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function transcribeAudioAndStore(audioUri: string, meetingId: string, duration: number): Promise<void> {
  try {
    console.log('Starting transcription for meeting:', meetingId);
    
    // 1. Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }
    
    // 2. Read the audio file
    console.log('Reading audio file...');
    const audioContent = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 3. Create form data for OpenAI
    console.log('Preparing form data for OpenAI...');
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    // 4. Send to OpenAI
    console.log('Sending to OpenAI for transcription...');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Received transcription from OpenAI');

    // 5. Store transcript in database
    console.log('Storing transcript in database...');
    // Get current user id from supabase.auth
    const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : null;
    const user_id = user ? user.id : null;
    if (!user_id) {
      throw new Error('No authenticated user found. Please sign in again.');
    }
    const { data: transcriptData, error: insertError } = await supabase
      .from('transcripts')
      .insert({
        meeting_id: meetingId,
        user_id,
        content: data.text,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      if (insertError.code === '23503') {
        throw new Error('Meeting not found. The meeting may have been deleted.');
      } else if (insertError.code === '42501') {
        throw new Error('Permission denied. You may not have access to create transcripts.');
      }
      throw new Error(`Failed to store transcript: ${insertError.message}`);
    }

    // 6. Update meeting status and transcript URL
    console.log('Updating meeting status and transcript URL...');
    
    // Convert duration from milliseconds (as passed in) to seconds for storage
    const durationInSeconds = Math.round(duration / 1000);

    const { error: updateError } = await supabase
      .from('meetings')
      .update({ 
        status: 'transcribed',
        transcript_url: `/api/transcripts/${transcriptData.id}`, // Add transcript URL
        duration: durationInSeconds, // Save duration in seconds
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Failed to update meeting status:', updateError);
      // Don't throw here as the transcript was already saved
    }

    console.log('Successfully transcribed and stored audio for meeting:', meetingId);
  } catch (error) {
    console.error('Error in transcribeAudioAndStore:', error);
    throw error;
  }
}
