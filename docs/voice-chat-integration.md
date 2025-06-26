# Voice Chat Integration

## Overview

The app now supports real-time voice chat with the AI assistant using OpenAI's GPT-4o Realtime API. Users can speak to the AI and receive audio responses, while maintaining access to all invoice management functions.

## Architecture

### Core Components

1. **VoiceService** (`services/voiceService.ts`)
   - Manages WebSocket connection to OpenAI Realtime API
   - Handles audio recording and playback
   - Processes real-time audio streaming
   - Manages function calls for invoice operations

2. **VoiceChatButton** (`components/VoiceChatButton.tsx`)
   - UI component for voice interaction
   - Visual feedback for recording/playing states
   - Animated pulse effect during recording
   - Handles permission requests

3. **useVoiceChat Hook** (`hooks/useVoiceChat.ts`)
   - State management for voice chat
   - Abstracts VoiceService complexity
   - Provides clean interface for components

### Integration Points

- **AI Screen**: Primary integration point with voice button in input area
- **AssistantService**: Model switched to `gpt-4o-realtime-preview`
- **Invoice Functions**: Same functions used for both text and voice interactions

## Features

### Voice Input
- Real-time speech recognition via WebSocket
- Automatic transcription display
- Voice Activity Detection (VAD) for natural conversation flow
- Support for continuous conversation

### Voice Output
- Streaming audio responses
- Natural voice synthesis
- Multiple voice options (currently using 'alloy')
- Real-time audio playback

### Function Calling
- Voice commands can trigger invoice operations:
  - "Create an invoice for John Doe"
  - "Show me my recent invoices"
  - "List all clients"
- Same business logic as text chat
- Results spoken back to user

## Technical Implementation

### Audio Configuration
```typescript
// Recording settings optimized for OpenAI Realtime API
{
  sampleRate: 24000,
  numberOfChannels: 1,
  bitRate: 128000,
  format: 'pcm16' // Required by OpenAI
}
```

### WebSocket Protocol
- Connection: `wss://api.openai.com/v1/realtime`
- Authentication: Bearer token in headers
- Session configuration with tools and voice settings
- Real-time bidirectional audio streaming

### Permissions
- **iOS**: `NSMicrophoneUsageDescription` in Info.plist
- **Android**: `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions
- Runtime permission requests handled by expo-av

## Usage

### Basic Voice Chat
1. Tap the microphone button in the AI chat screen
2. Speak your message
3. Release when finished (or wait for VAD detection)
4. Receive audio response

### Voice Commands
- "Create an invoice for [client name] with [items]"
- "Show me invoices from last month"
- "Mark invoice [number] as paid"
- "Add a new client named [name]"

## Configuration

### Environment Variables
```env
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
```

### Model Settings
- Model: `gpt-4o-realtime-preview`
- Voice: `alloy` (configurable)
- Temperature: 0.7
- Max tokens: 4096

## Error Handling

### Common Issues
1. **Permission Denied**: Microphone access required
2. **Connection Failed**: Check API key and network
3. **Audio Playback Issues**: Ensure expo-av is properly configured
4. **Function Call Errors**: Same error handling as text chat

### Error Recovery
- Automatic reconnection on WebSocket disconnect
- Graceful fallback to text-only mode
- User-friendly error messages
- Retry mechanisms for transient failures

## Performance Considerations

### Optimizations
- Efficient audio buffering
- Minimal logging in production
- Connection pooling for WebSocket
- Audio compression for faster streaming

### Resource Usage
- Real-time processing requires stable internet
- Higher battery usage during voice sessions
- Memory management for audio buffers

## Future Enhancements

### Planned Features
1. **Voice Settings**
   - Voice selection (alloy, echo, fable, etc.)
   - Speech rate adjustment
   - Audio quality settings

2. **Advanced Voice Commands**
   - Multi-step invoice creation
   - Batch operations
   - Voice shortcuts

3. **Accessibility**
   - Voice-only navigation
   - Audio descriptions
   - Hearing impaired support

### Technical Improvements
- Background processing
- Offline voice recognition fallback
- Enhanced noise cancellation
- Multi-language support

## Testing

### Manual Testing
1. Test microphone permissions
2. Verify audio recording quality
3. Test WebSocket connection stability
4. Validate function calling works
5. Test error scenarios

### Automated Testing
- Unit tests for VoiceService
- Integration tests for AI screen
- Mock WebSocket for testing
- Audio playback verification

## Troubleshooting

### Common Problems

**Voice button not responding**
- Check microphone permissions
- Verify OpenAI API key is set
- Check network connectivity

**No audio playback**
- Ensure device volume is up
- Check expo-av configuration
- Verify WebSocket connection

**Function calls not working**
- Check function call handler setup
- Verify invoice functions are available
- Check error logs for details

**Poor audio quality**
- Check microphone hardware
- Verify sample rate settings
- Test network stability

### Debug Mode
Enable verbose logging by setting:
```typescript
console.log('[VoiceService]', message);
```

## Security Considerations

- API keys stored securely in environment variables
- Audio data transmitted over secure WebSocket (WSS)
- No persistent storage of voice recordings
- User consent required for microphone access