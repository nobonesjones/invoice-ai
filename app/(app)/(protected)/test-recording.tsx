import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTestRecorder } from '@/lib/hooks/use-test-recorder';
import { transcribeAudio } from '@/lib/services/openai';
import { supabase } from '@/config/supabase';

// Use environment variable
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
}

export default function TestRecordingScreen() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const saveTranscriptToDb = async (text: string) => {
    try {
      console.log('Attempting to save transcript:', {
        content: text,
        timestamp: Math.floor(Date.now() / 1000)
      });

      const { data, error: insertError } = await supabase
        .from('transcripts')
        .insert({
          content: text,
          timestamp: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          created_at: new Date().toISOString(),
          meeting_id: null // This field is required but can be null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      console.log('Successfully saved transcript:', data);
    } catch (error) {
      console.error('Error saving transcript:', error);
      if (error instanceof Error) {
        Alert.alert('Database Error', `Failed to save transcript: ${error.message}`);
      } else {
        Alert.alert('Database Error', 'Failed to save transcript to database');
      }
    }
  };

  const fetchTranscriptsFromDb = async () => {
    try {
      console.log('Attempting to fetch transcripts from database');

      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('id, content, timestamp')
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
        if (!OPENAI_API_KEY) {
          Alert.alert('Configuration Error', 'OpenAI API key is not set');
          return;
        }

        setIsTranscribing(true);
        console.log('Starting transcription for:', uri);
        
        const result = await transcribeAudio(uri, OPENAI_API_KEY);
        
        if (result.error) {
          Alert.alert('Transcription Error', result.error);
        } else {
          // Save to database
          await saveTranscriptToDb(result.text);

          // Add to local state
          const newTranscript: TranscriptItem = {
            id: Date.now().toString(),
            text: result.text,
            timestamp: new Date().toLocaleTimeString(),
          };
          setTranscripts(prev => [newTranscript, ...prev]);
          console.log('Transcription:', result.text);
        }
      } catch (error) {
        console.error('Error in transcription:', error);
        Alert.alert('Error', 'Failed to transcribe audio');
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
        <Text style={styles.headerText}>OpenAI Transcription Test</Text>
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

      <View style={styles.statusContainer}>
        {isProcessing && <Text style={styles.statusText}>Processing recording...</Text>}
        {isTranscribing && <Text style={styles.statusText}>Transcribing audio...</Text>}
      </View>
      
      <ScrollView style={styles.transcriptionContainer}>
        {transcripts.length > 0 ? (
          transcripts.map(transcript => (
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
              <Text style={styles.transcriptionText}>{transcript.text}</Text>
            </View>
          ))
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              Record something to see the transcription
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  transcriptionContainer: {
    flex: 1,
    marginTop: 15,
    paddingHorizontal: 20,
  },
  transcriptItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timestampText: {
    color: '#888',
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    color: '#ff4444',
    fontSize: 14,
  },
  transcriptionText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  }
});
