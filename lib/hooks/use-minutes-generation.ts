import { useState } from 'react';
import { generateAndStoreMeetingMinutes } from '../services/generate-minutes';

interface UseMinutesGeneration {
  generateMinutes: (meetingId: string) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useMinutesGeneration(): UseMinutesGeneration {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMinutes = async (meetingId: string) => {
    try {
      setIsGenerating(true);
      setError(null);
      await generateAndStoreMeetingMinutes(meetingId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate minutes';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateMinutes,
    isGenerating,
    error
  };
}
