import { useState, useRef, useCallback } from 'react';
import { generateAndStoreMeetingMinutes } from '../services/generate-minutes';

interface UseMinutesGeneration {
  generateMinutes: (meetingId: string) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useMinutesGeneration(): UseMinutesGeneration {
  // Ref to track meeting IDs currently being processed to prevent duplicates
  const processingMeetingIds = useRef<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMinutes = useCallback(async (meetingId: string) => {
    // Prevent duplicate calls for the same meeting ID
    if (processingMeetingIds.current.has(meetingId)) {
      console.warn(`[LOG MINUTES HOOK] Skipping duplicate generateMinutes call for meetingId: ${meetingId}`);
      return;
    }

    try {
      processingMeetingIds.current.add(meetingId);
      console.log(`[LOG MINUTES HOOK] Starting generateMinutes for meetingId: ${meetingId}`);
      setIsGenerating(true);
      setError(null);
      await generateAndStoreMeetingMinutes(meetingId);
      console.log(`[LOG MINUTES HOOK] Finished generateMinutes successfully for meetingId: ${meetingId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate minutes';
      setError(errorMessage);
      console.error(`[LOG MINUTES HOOK] Error in generateMinutes for meetingId: ${meetingId}`, err);
      throw err;
    } finally {
      setIsGenerating(false);
      processingMeetingIds.current.delete(meetingId);
      console.log(`[LOG MINUTES HOOK] Cleaned up processing state for meetingId: ${meetingId}`);
    }
  }, []); // useCallback dependency array is empty as it doesn't depend on external state/props

  return {
    generateMinutes,
    isGenerating,
    error
  };
}
