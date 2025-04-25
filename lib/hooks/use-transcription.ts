import { useState, useRef } from 'react';
import { transcribeAudioAndStore } from '../services/transcribe-audio';

interface UseTranscription {
  transcribeAudio: (audioUri: string, meetingId: string) => Promise<void>;
  isTranscribing: boolean;
  error: string | null;
}

export function useTranscription(): UseTranscription {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref to track URIs currently being processed to prevent double calls (e.g., from StrictMode)
  const processingUris = useRef(new Set<string>());

  const transcribeAudio = async (audioUri: string, meetingId: string) => {
    console.log(`[LOG TRANSCRIPTION HOOK ${new Date().toISOString()}] ENTERING hook's transcribeAudio. URI: ${audioUri}, MeetingID: ${meetingId}`);

    // Guard against double invocation
    if (processingUris.current.has(audioUri)) {
      console.warn(`[LOG TRANSCRIPTION HOOK ${new Date().toISOString()}] Skipping duplicate transcribeAudio call for URI: ${audioUri}`);
      return;
    }

    try {
      // Add URI to processing set
      processingUris.current.add(audioUri);

      setIsTranscribing(true);
      setError(null);
      console.log(`[LOG TRANSCRIPTION HOOK ${new Date().toISOString()}] BEFORE calling transcribeAudioAndStore. URI: ${audioUri}, MeetingID: ${meetingId}`);
      await transcribeAudioAndStore(audioUri, meetingId);
      console.log(`[LOG TRANSCRIPTION HOOK ${new Date().toISOString()}] AFTER calling transcribeAudioAndStore. URI: ${audioUri}, MeetingID: ${meetingId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMessage);
      throw err;
    } finally {
      // Remove URI from processing set
      processingUris.current.delete(audioUri);
      setIsTranscribing(false);
    }
  };

  return {
    transcribeAudio,
    isTranscribing,
    error
  };
}
