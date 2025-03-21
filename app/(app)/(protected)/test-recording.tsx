import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTestRecorder } from '@/lib/hooks/use-test-recorder';
import { transcribeAudioAndStore } from '@/lib/services/transcribe-audio';
import { supabase } from '@/config/supabase';

interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
  meeting_id: string | null;
}

export default function TestRecordingScreen() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const fetchTranscriptsFromDb = async () => {
    try {
      console.log('Attempting to fetch transcripts from database');

      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('id, content, timestamp, meeting_id')
        .order('timestamp', { ascending: false });

      if (transcriptsError) {
        console.error('Database fetch error:', transcriptsError);
        throw transcriptsError;
      }

      console.log('Successfully fetched transcripts:', transcriptsData);

      const transcripts: TranscriptItem[] = transcriptsData.map(transcript => ({
        id: transcript.id,
        text: transcript.content,
        timestamp: new Date(transcript.timestamp * 1000).toLocaleTimeString(),
        meeting_id: transcript.meeting_id
      }));

      setTranscripts(transcripts);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      if (error instanceof Error) {
        Alert.alert('Database Error', `Failed to fetch transcripts: ${error.message}`);
      } else {
        Alert.alert('Database Error', 'Failed to fetch transcripts from database');
      }
    }
  };

  const deleteTranscript = async (id: string) => {
    try {
      console.log('Attempting to delete transcript:', id);

      const { error: deleteError } = await supabase
        .from('transcripts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        throw deleteError;
      }

      console.log('Successfully deleted transcript:', id);

      setTranscripts(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transcript:', error);
      if (error instanceof Error) {
        Alert.alert('Database Error', `Failed to delete transcript: ${error.message}`);
      } else {
        Alert.alert('Database Error', 'Failed to delete transcript from database');
      }
    }
  };

  useEffect(() => {
    fetchTranscriptsFromDb();
  }, []);

  const { 
    isRecording, 
    isProcessing,
    startRecording, 
    stopRecording 
  } = useTestRecorder({
    onRecordingComplete: async (uri) => {
      try {
        setIsTranscribing(true);
        console.log('Starting transcription for:', uri);
        
        // Create a test meeting first
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .insert({
            name: 'Test Meeting ' + new Date().toLocaleString(),
            status: 'recording',
            duration: 0 // Set initial duration
          })
          .select()
          .single();

        if (meetingError) {
          throw new Error(`Failed to create test meeting: ${meetingError.message}`);
        }

        // Use the same transcription service as the main app
        await transcribeAudioAndStore(uri, meeting.id);
        
        // Refresh transcripts
        await fetchTranscriptsFromDb();
        
        console.log('Transcription completed successfully');
      } catch (error) {
        console.error('Error in transcription:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to transcribe audio');
      } finally {
        setIsTranscribing(false);
      }
    },
    onError: (error) => {
      Alert.alert('Recording Error', error);
    }
  });

  const handleRecordingPress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Test Recording & Transcription',
        headerShown: false 
      }} />
      
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.push('/')} 
          style={styles.backButton}
        >
          <Text>
            <ChevronLeft size={24} color="white" />
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>Test Recording & Transcription</Text>
        <View style={{ width: 24 }} /> {/* Spacer for centering */}
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title={isRecording ? 'Stop Recording' : 'Start Recording'} 
          onPress={handleRecordingPress}
          disabled={isProcessing || isTranscribing}
          color={isRecording ? '#E53935' : '#2196F3'}
        />
      </View>

      <Text style={styles.statusText}>
        {isRecording ? 'Recording...' : 
         isProcessing ? 'Processing...' : 
         isTranscribing ? 'Transcribing...' : 
         'Ready'}
      </Text>

      <ScrollView style={styles.transcriptsList}>
        {transcripts.map((transcript) => (
          <View key={transcript.id} style={styles.transcriptItem}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.timestampText}>{transcript.timestamp}</Text>
              <TouchableOpacity
                onPress={() => deleteTranscript(transcript.id)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.transcriptText}>{transcript.text}</Text>
            <Text style={styles.meetingIdText}>Meeting ID: {transcript.meeting_id || 'None'}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2c2c2c',
  },
  backButton: {
    padding: 8,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    padding: 20,
  },
  statusText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  transcriptsList: {
    padding: 20,
  },
  transcriptItem: {
    backgroundColor: '#2c2c2c',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestampText: {
    color: '#888',
    fontSize: 12,
  },
  transcriptText: {
    color: 'white',
    marginBottom: 8,
  },
  meetingIdText: {
    color: '#888',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#E53935',
    padding: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
  },
});
