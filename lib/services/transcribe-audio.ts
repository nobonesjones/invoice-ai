import OpenAI from 'openai';
import { supabase } from '@/config/supabase';
import * as FileSystem from 'expo-file-system';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function transcribeAudioAndStore(audioUri: string, meetingId: string): Promise<void> {
  try {
    // 1. Read the audio file
    const audioContent = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Create form data for OpenAI
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('model', 'whisper-1');

    // 3. Send to OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Transcription failed');

    // 4. Store transcript in database
    const { error: insertError } = await supabase
      .from('transcripts')
      .insert({
        meeting_id: meetingId,
        content: data.text,
        timestamp: Math.floor(Date.now() / 1000),
        created_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    console.log('Successfully transcribed and stored audio for meeting:', meetingId);
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}
