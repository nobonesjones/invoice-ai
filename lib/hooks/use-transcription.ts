import { useState } from 'react';
import { transcribeAudioAndStore } from '../services/transcribe-audio';

interface UseTranscription {
  transcribeAudio: (audioUri: string, meetingId: string) => Promise<void>;
  isTranscribing: boolean;
  error: string | null;
}

export function useTranscription(): UseTranscription {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribeAudio = async (audioUri: string, meetingId: string) => {
    try {
      setIsTranscribing(true);
      setError(null);
      await transcribeAudioAndStore(audioUri, meetingId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    transcribeAudio,
    isTranscribing,
    error
  };
}
