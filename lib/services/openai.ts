import * as FileSystem from 'expo-file-system';

interface TranscriptionResponse {
  text: string;
  error?: string;
}

export const transcribeAudio = async (
  audioUri: string,
  apiKey: string
): Promise<TranscriptionResponse> => {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a'
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    // Make request to OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return { text: data.text };
  } catch (error) {
    console.error('Transcription error:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Failed to transcribe audio'
    };
  }
};
