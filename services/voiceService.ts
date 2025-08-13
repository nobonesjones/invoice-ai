import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface VoiceMessage {
  id: string;
  type: 'user' | 'assistant';
  audioUri?: string;
  transcript?: string;
  timestamp: Date;
}

export class VoiceService {
  private static recording: Audio.Recording | null = null;
  private static isRecording = false;
  private static websocket: WebSocket | null = null;

  // Initialize audio permissions
  static async initialize(): Promise<boolean> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          console.error('[VoiceService] Audio permission denied');
          return false;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      console.log('[VoiceService] Audio initialized successfully');
      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to initialize audio:', error);
      return false;
    }
  }

  // Start recording audio
  static async startRecording(): Promise<boolean> {
    try {
      if (this.isRecording) {
        console.warn('[VoiceService] Already recording');
        return false;
      }

      // Initialize recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      this.recording = recording;
      this.isRecording = true;

      console.log('[VoiceService] Recording started');
      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to start recording:', error);
      return false;
    }
  }

  // Stop recording and return audio data
  static async stopRecording(): Promise<{ uri: string; base64?: string } | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.warn('[VoiceService] Not currently recording');
        return null;
      }

      // Check recording duration before stopping
      const status = await this.recording.getStatusAsync();
      const duration = status.durationMillis || 0;
      
      console.log(`[VoiceService] Recording duration: ${duration}ms`);
      
      // Require minimum 500ms of recording
      if (duration < 500) {
        console.log('[VoiceService] Recording too short, ignoring...');
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
        this.isRecording = false;
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.isRecording = false;
      this.recording = null;

      if (!uri) {
        console.error('[VoiceService] No recording URI available');
        return null;
      }

      console.log('[VoiceService] Recording stopped, URI:', uri);
      
      // Convert audio file to base64 and send to WebSocket
      try {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        
        // For OpenAI Realtime API, we need to extract PCM data from WAV file
        // Skip WAV header (44 bytes) to get raw PCM16 data
        const pcmData = arrayBuffer.slice(44);
        
        // Check if we have enough audio data (at least 500ms at 24kHz, 16-bit, mono = 24000 bytes)
        if (pcmData.byteLength < 24000) {
          console.warn('[VoiceService] Audio too short:', pcmData.byteLength, 'bytes');
          return { uri };
        }
        
        const base64Audio = this.arrayBufferToBase64(pcmData);
        
        // Send the PCM audio data to the realtime API
        this.sendAudioData(pcmData);
        console.log('[VoiceService] PCM audio data sent to WebSocket, size:', pcmData.byteLength);
        
        return { uri, base64: base64Audio };
      } catch (audioError) {
        console.error('[VoiceService] Failed to process audio file:', audioError);
        return { uri };
      }
    } catch (error) {
      console.error('[VoiceService] Failed to stop recording:', error);
      return null;
    }
  }

  // Function call handler
  private static onFunctionCall: ((name: string, args: any) => Promise<any>) | null = null;

  // Set function call handler
  static setFunctionCallHandler(handler: (name: string, args: any) => Promise<any>): void {
    this.onFunctionCall = handler;
  }

  // Connect to OpenAI Realtime API
  static async connectRealtime(onMessage: (message: any) => void): Promise<boolean> {
    try {
      if (this.websocket) {
        this.websocket.close();
      }

      // Note: Realtime API requires direct WebSocket connection to OpenAI
      // For production, consider implementing WebSocket proxy via edge function
      const wsUrl = `${process.env.EXPO_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://')}/functions/v1/ai-realtime`;
      
      this.websocket = new WebSocket(wsUrl, undefined, {
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ANON_KEY}`,
          'apikey': process.env.EXPO_PUBLIC_ANON_KEY!,
        },
      });
      
      // Configure WebSocket event handlers
      this.websocket.onopen = () => {
        console.log('[VoiceService] Realtime WebSocket connected');
        
        // Send session configuration with auth
        this.sendRealtimeMessage({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful AI assistant for invoice management. Be concise and friendly.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            tools: [
              {
                type: 'function',
                name: 'create_invoice',
                description: 'Create a new invoice with line items and client information',
                parameters: {
                  type: 'object',
                  properties: {
                    client_name: { type: 'string' },
                    client_email: { type: 'string' },
                    line_items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          description: { type: 'string' },
                          quantity: { type: 'number' },
                          rate: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              },
              {
                type: 'function',
                name: 'get_invoices',
                description: 'Get a list of invoices with optional filters',
                parameters: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue'] },
                    limit: { type: 'number' }
                  }
                }
              },
              {
                type: 'function',
                name: 'get_clients',
                description: 'Get a list of clients',
                parameters: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number' }
                  }
                }
              }
                         ],
            tool_choice: 'auto',
            temperature: 0.7,
            max_response_output_tokens: 4096
          }
        });
             };

      this.websocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[VoiceService] Received message:', message.type);
          
          // Handle function calls
          if (message.type === 'response.function_call_arguments.done' && this.onFunctionCall) {
            try {
              const result = await this.onFunctionCall(message.name, JSON.parse(message.arguments));
              
              // Send function result back
              this.sendRealtimeMessage({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: message.call_id,
                  output: JSON.stringify(result)
                }
              });
              
              // Trigger response generation
              this.sendRealtimeMessage({
                type: 'response.create'
              });
            } catch (error) {
              console.error('[VoiceService] Function call error:', error);
              
              // Send error back
              this.sendRealtimeMessage({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: message.call_id,
                  output: JSON.stringify({ error: 'Function call failed' })
                }
              });
            }
          }
          
          onMessage(message);
        } catch (error) {
          console.error('[VoiceService] Failed to parse message:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[VoiceService] WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        console.log('[VoiceService] WebSocket closed');
        this.websocket = null;
      };

      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to connect to realtime API:', error);
      return false;
    }
  }

  // Send message to realtime API
  static sendRealtimeMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    } else {
      console.error('[VoiceService] WebSocket not connected');
    }
  }

  // Send audio data to realtime API
  static sendAudioData(audioData: ArrayBuffer): void {
    console.log(`[VoiceService] Sending audio data: ${audioData.byteLength} bytes`);
    
    this.sendRealtimeMessage({
      type: 'input_audio_buffer.append',
      audio: this.arrayBufferToBase64(audioData)
    });
    
    // Add a small delay then commit the buffer
    setTimeout(() => {
      console.log('[VoiceService] Committing audio buffer');
      this.commitAudioInput();
    }, 100);
  }

  // Commit audio input (trigger processing)
  static commitAudioInput(): void {
    this.sendRealtimeMessage({
      type: 'input_audio_buffer.commit'
    });
  }

  // Send text message to realtime API
  static sendTextMessage(text: string): void {
    this.sendRealtimeMessage({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    });

    // Trigger response
    this.sendRealtimeMessage({
      type: 'response.create'
    });
  }

  // Play audio from base64 data
  static async playAudio(base64Audio: string): Promise<boolean> {
    try {
      console.log('[VoiceService] Playing audio, size:', base64Audio.length);
      
      // For PCM16 audio from OpenAI, we need to create a proper WAV file
      const wavData = this.createWavFromPCM16(base64Audio);
      const audioUri = `data:audio/wav;base64,${wavData}`;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      await sound.playAsync();
      console.log('[VoiceService] Audio playback started');
      
      // Cleanup after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('[VoiceService] Audio playback finished');
          sound.unloadAsync();
        }
      });

      return true;
    } catch (error) {
      console.error('[VoiceService] Failed to play audio:', error);
      return false;
    }
  }

  // Create WAV file from PCM16 base64 data
  private static createWavFromPCM16(base64PCM: string): string {
    const pcmData = atob(base64PCM);
    const pcmBytes = new Uint8Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      pcmBytes[i] = pcmData.charCodeAt(i);
    }

    // WAV header for 24kHz, 16-bit, mono
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = pcmBytes.length;
    const fileSize = 36 + dataSize;

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, fileSize, true);
    view.setUint32(8, 0x45564157, true); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // byte rate
    view.setUint16(32, numChannels * bitsPerSample / 8, true); // block align
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, dataSize, true);

    // Combine header and data
    const wavBuffer = new Uint8Array(44 + dataSize);
    wavBuffer.set(new Uint8Array(header), 0);
    wavBuffer.set(pcmBytes, 44);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < wavBuffer.length; i++) {
      binary += String.fromCharCode(wavBuffer[i]);
    }
    return btoa(binary);
  }

  // Utility: Convert ArrayBuffer to base64
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Utility: Convert base64 to ArrayBuffer
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Disconnect from realtime API
  static disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // Check if currently recording
  static get isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Check if connected to realtime API
  static get isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }
} 