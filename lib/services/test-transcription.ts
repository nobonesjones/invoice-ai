import { transcribeAudio } from './openai';
import * as FileSystem from 'expo-file-system';

// Test function
export const testTranscription = async () => {
  try {
    // Get the API key from environment
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }

    // Create a small test audio file (or use an existing one)
    const testAudioUri = FileSystem.documentDirectory + 'test-audio.m4a';
    
    // Test the transcription
    console.log('Starting transcription test...');
    console.log('Using audio file:', testAudioUri);
    
    const result = await transcribeAudio(testAudioUri, apiKey);
    
    if (result.error) {
      console.error('Transcription failed:', result.error);
    } else {
      console.log('Transcription successful!');
      console.log('Transcribed text:', result.text);
    }
    
    return result;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
};
