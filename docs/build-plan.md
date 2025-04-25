Type 'string | null' is not assignable to type 'string | undefined'.
Type 'null' is not assignable to type 'string | undefined'.# MeetingMind: Meeting Recorder App Implementation Plan

## Project Phases

### Phase 1: Foundation & Authentication 
- Development environment setup
- Splash screen implementation
- Authentication screens (Sign in/Sign up)
- Supabase connections established

### Phase 2: Core UI & Home Experience
- Milestone 2.1: Home Screen Implementation
  - Create the home screen layout with welcome header
  - Implement meeting cards with avatar icons
  - Add date/time and duration formatting
  - Build gradient "Start" button
  - Implement empty state for first-time users

- Milestone 2.2: Navigation Structure
  - Set up Expo Router configuration
  - Create navigation paths between all screens
  - Implement proper back navigation
  - Build transitions between screens

- Milestone 2.3: Account Screen
  - Create account/profile screen
  - Implement user settings options
  - Add theme toggle functionality
  - Build logout process

### Phase 3: Recording Functionality
- Milestone 3.1: Audio Recording Framework
  - Set up Expo AV for audio recording
  - Implement audio file management
  - Create audio visualization component
  - Build recording state management

- Milestone 3.2: Meeting Objectives Modal
  - Build modal overlay with text input
  - Implement objectives storage
  - Create timer and audio visualization
  - Connect "Confirm" action

- Milestone 3.3: Active Recording Experience
  - Implement recording screen with live visualization
  - Create reminder card component for objectives
  - Build reminder timing system
  - Implement "End Call" functionality

### Phase 4: Meeting Processing & Storage
- Milestone 4.1: Backend Integration
  - Complete Supabase schema implementation
  - Set up storage buckets for audio files
  - Create API services for data operations
  - Implement proper error handling

- Milestone 4.2: Audio Processing
  - Implement audio compression
  - Build audio upload to Supabase storage
  - **Best Practice:** Use `FormData` for uploading audio from React Native/Expo to Supabase Storage. Directly uploading `Blob` objects created via `fetch(fileUri)` or `fetch(dataUri)` can sometimes result in 0-byte files being stored. Using `FormData` ensures reliable file content transfer:
    ```typescript
    const formData = new FormData();
    const file = { uri: localFileUri, name: 'audio.m4a', type: 'audio/m4a' };
    formData.append('file', file as any);
    await supabase.storage.from('meetings').upload(path, formData, { contentType: 'audio/m4a', upsert: true });
    ```
  - Create processing status management
  - Add loading/progress indicators

### Phase 5: AI & Transcription 
- Milestone 5.1: OpenAI Whisper Integration 
  - Set up OpenAI API connection
  - Implement audio transcription service
  - Create transcript formatting and storage
  - Build error handling for transcription

- Milestone 5.2: Meeting Minutes Generation 
  - Implement Gemini Pro API connection (switched from GPT-4)
  - Create prompt engineering for minutes extraction
  - Build storage for minutes data
  - Add progress indicators for AI processing

  Prompt; 
  please give me precise meeting minutes for the below transcription. use direct language and use as little words as possible without loosing the meaning and context of the minutes.  I want a very high level summary of the meeting (1 sentence) first then the main action items and sub action items (if any) below.  
  if there are no action items, then just put No action items agreed.
  Then the miutes below that.

### Phase 6: Meeting Details Experience
- Milestone 6.1: Meeting Details Screen 
  - Implement meeting header with gradient
  - Create tab navigation system
  - Build audio playback controls
  - Implement basic playback functionality

- Milestone 6.2: Minutes & Transcript Implementation 
  - Create minutes display component
  - Build transcript view with timestamps
  - Implement search functionality
  - Connect transcript to audio position
  - Add real-time subscriptions for transcripts and action items
  - Implement polling mechanism for immediate data loading
  - Add manual refresh functionality

- Milestone 6.3: Chat Functionality
  - Create chat interface
  - Implement message history
  - Build Gemini 2.0 Flash connection for Q&A (switched from OpenAI)
  - Create context management for relevant responses

### Phase 7: Polish & Finalization
- Milestone 7.1: UX Refinement 
  - Add animations and transitions
  - Refine loading states and indicators
  - Implement error handling across the app
  - Create helpful empty states
  - Add processing overlay with step-by-step status messages
  - Implement swipe-to-delete for action items
  - Add haptic feedback for interactions

- Milestone 7.2: Testing & Optimization 
  - Perform end-to-end testing
  - Optimize audio processing and storage
  - Reduce API usage where possible
  - Implement performance improvements

- Milestone 7.3: Final Delivery
  - Final bug fixes
  - Documentation updates
  - Prepare for app store submission
  - Create onboarding experience for new users

## Current Status
- Phase 1: Completed
- Phase 2: Completed
- Phase 3: Completed
- Phase 4: Completed
- Phase 5: Completed
- Phase 6: Completed
- Phase 7: Completed

## App Overview
MeetingMind is a React Native (Expo) mobile application designed to help users record, transcribe, and interact with their meetings. The app captures audio recordings, transcribes them using OpenAI's Whisper API, generates meeting minutes, and enables users to chat with their meeting content using AI. The app features a clean, intuitive interface that allows users to manage recordings, set meeting objectives, and receive timely on-screen prompts to help them stay focused on their goals.

## Technical Stack
- Frontend: React Native Expo
- Navigation: Expo Router
- Authentication: Supabase Authentication
- Database: Supabase
- AI Integration: 
  - OpenAI API (Whisper for transcription)
  - Google Gemini Pro (for minutes generation)
  - Google Gemini 2.0 Flash (for chat functionality)
- State Management: React Context API

## Application Screens

### 1. Authentication Screens
#### 1.1. Login Screen
- Email and password input fields
- "Login" button
- "Forgot Password" link
- "Register" link

#### 1.2. Registration Screen
- Name, email, and password input fields
- "Register" button
- "Already have an account? Login" link

#### 1.3. Forgot Password Screen
- Email input field
- "Reset Password" button
- "Back to Login" link

### 2. Main Application Flow

#### 2.1. Home Screen (Recordings List)
- App header with welcome text and profile icon
- "My Meetings" section header with subtitle
- List of recorded meetings with:
  - Meeting name
  - Date and time
  - Duration
  - Avatar icon for each meeting
- "Start" gradient button at bottom
- Empty state for no recordings

#### 2.2. Meeting Objectives Modal
- Appears after pressing "Start" on home screen
- Text input for entering meeting objectives
- Recording timer already running (circular display)
- Audio visualization
- "Confirm" button to save objectives

#### 2.3. Active Recording Screen
- Recording status indicator with green dot
- Reminder cards showing objectives at appropriate times
- Large circular audio visualization
- "End Call" gradient button at bottom

#### 2.4. Meeting Details Screen
- Meeting header with name, date, and duration
- Tab navigation for Minutes/Transcript/Chat
- Content area showing selected tab information
- Audio playback controls at bottom
- Back button and account icon in header
- Real-time data updates with subscriptions
- Manual refresh functionality

#### 2.5. Profile/Account Screen
- User information (name, email)
- App settings (theme toggle)
- Logout button
- Account management options

## State Management (React Context API)

### 1. Authentication Context
- State:
  - user: Current user object or null
  - isLoading: Boolean indicating authentication status check
  - isAuthenticated: Boolean indicating if user is authenticated
- Actions:
  - login(email, password): Log in with credentials
  - register(name, email, password): Register new user
  - logout(): Log out current user
  - resetPassword(email): Send password reset email
  - updateUserProfile(data): Update user profile information

### 2. Theme Context
- State:
  - theme: Current theme ('light' or 'dark')
  - systemTheme: Boolean to follow system theme
- Actions:
  - toggleTheme(): Switch between light and dark themes
  - setSystemTheme(boolean): Enable/disable system theme following

### 3. Recordings Context
- State:
  - recordings: Array of recording objects
  - currentRecording: Current recording object or null
  - isRecording: Boolean indicating if recording is active
  - recordingTime: Current recording duration
  - isProcessing: Boolean indicating if recording is being processed
- Actions:
  - startRecording(name, objectives): Start a new recording
  - stopRecording(): Stop the current recording
  - pauseRecording(): Pause the current recording
  - resumeRecording(): Resume a paused recording
  - deleteRecording(id): Delete recording by ID
  - updateRecordingName(id, name): Update recording name
  - addObjective(id, objective): Add an objective to a recording
  - removeObjective(id, objectiveId): Remove an objective from a recording

## Database Schema (Supabase)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (managed by Supabase Auth)
-- Note: This extends the auth.users table that Supabase automatically creates

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    duration INTEGER, -- duration in seconds
    date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'error'
    audio_url TEXT,
    transcript_json JSONB, -- Store the full transcript with timestamps
    minutes_json JSONB, -- Store the generated minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id for faster querying
CREATE INDEX IF NOT EXISTS meetings_user_id_idx ON public.meetings(user_id);

-- Objectives Table
CREATE TABLE IF NOT EXISTS public.objectives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    displayed_at INTEGER, -- timestamp in seconds when this was shown during recording
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on meeting_id for faster querying
CREATE INDEX IF NOT EXISTS objectives_meeting_id_idx ON public.objectives(meeting_id);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_user BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on meeting_id for faster querying
CREATE INDEX IF NOT EXISTS chat_messages_meeting_id_idx ON public.chat_messages(meeting_id);

-- Storage Buckets Configuration
-- Execute this in the SQL editor or set up through Supabase UI

-- Create a storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meetings', 'meetings', false)
ON CONFLICT (id) DO NOTHING;

-- Set up row level security policies
-- For Profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- For Meetings table
CREATE POLICY "Users can view their own meetings" 
ON public.meetings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meetings" 
ON public.meetings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meetings" 
ON public.meetings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meetings" 
ON public.meetings FOR DELETE 
USING (auth.uid() = user_id);

-- For Objectives table
CREATE POLICY "Users can select objectives for meetings they own" 
ON public.objectives FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = objectives.meeting_id 
    AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can insert objectives for meetings they own" 
ON public.objectives FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = objectives.meeting_id 
    AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can update objectives for meetings they own" 
ON public.objectives FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = objectives.meeting_id 
    AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can delete objectives for meetings they own" 
ON public.objectives FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = objectives.meeting_id 
    AND meetings.user_id = auth.uid()
));

-- For Chat Messages table
CREATE POLICY "Users can select chat messages for meetings they own" 
ON public.chat_messages FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = chat_messages.meeting_id 
    AND meetings.user_id = auth.uid()
));

CREATE POLICY "Users can insert chat messages for meetings they own" 
ON public.chat_messages FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = chat_messages.meeting_id 
    AND meetings.user_id = auth.uid()
));

-- For Storage
CREATE POLICY "Users can upload their own meetings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'meetings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own meetings"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'meetings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own meetings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'meetings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own meetings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'meetings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

## Database Structure Overview

#### 1. Profiles Table
- Extends Supabase Auth users
- Stores user preferences and profile information
- id: UUID (primary key, linked to auth.users)
- email: Text (unique)
- name: Text
- avatar_url: Text
- theme: Text (default 'light')
- created_at: Timestamp
- updated_at: Timestamp

#### 2. Meetings Table
- Stores information about each meeting recording
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- name: Text
- duration: Integer (seconds)
- date: Timestamp (when the meeting occurred)
- status: Text (processing status)
- audio_url: Text (Supabase storage URL)
- transcript_json: JSONB (full transcript with timestamps)
- minutes_json: JSONB (generated minutes)
- created_at: Timestamp
- updated_at: Timestamp

#### 3. Objectives Table
- Stores meeting objectives for each meeting
- id: UUID (primary key)
- meeting_id: UUID (foreign key to Meetings)
- description: Text
- display_order: Integer
- displayed_at: Integer (timestamp when shown during recording)
- created_at: Timestamp

#### 4. Chat Messages Table
- Stores conversation history for each meeting
- id: UUID (primary key)
- meeting_id: UUID (foreign key to Meetings)
- content: Text
- is_user: Boolean
- created_at: Timestamp

#### 5. Storage
- meetings bucket: Stores audio files
- File path structure: {user_id}/{meeting_id}.m4a

## OpenAI API Integration

### 1. Audio Transcription (Whisper API)
- Implementation:
  - Upload recording audio to Supabase storage
  - Send audio file URL to OpenAI Whisper API
  - Process and store returned transcript
  - Function: transcribeAudio(audioUrl)

### 2. Meeting Minutes Generation (Gemini Pro API)
- Implementation:
  - Send full transcript to Gemini Pro API with prompt to generate minutes
  - Process and store returned minutes
  - Include extraction of key points and action items
  - Function: generateMinutes(transcript, objectives)

### 3. Chat Integration (Gemini 2.0 Flash API)
- Implementation:
  - Send user question along with meeting transcript context to Gemini 2.0 Flash API
  - Display returned response to user
  - Maintain context through conversation
  - Function: generateChatResponse(message, transcript, chatHistory)

### 4. Objective Prompting System
- Implementation:
  - Analyze transcript in real-time during recording
  - Determine appropriate times to display objective reminders
  - Display on-screen prompts at calculated intervals
  - Function: calculatePromptTiming(objectives, ongoingTranscript)

## Technical Constraints and Boundaries

### 1. Supported Libraries and Components
- Expo SDK: Limited to compatible libraries and APIs
- UI Components: React Native Paper or React Native Elements
- Storage: Supabase Storage for audio files and generated content
- Authentication: Supabase Authentication only
- State Management: React Context API only (no Redux or other state managers)

### 2. Performance Constraints
- Maximum recording duration: 3 hours
- Maximum file size: 100MB
- Transcription processing time expectations: 1-2 minutes per 10 minutes of recording
- Optimized data loading with parallel fetching and real-time subscriptions

### 3. Feature Boundaries
- No video recording capability
- No real-time transcription (processing occurs after recording is complete)
- No multi-user collaboration features
- No offline recording (internet connection required)
- No automatic speaker identification (unless specifically supported by Whisper API)

### 4. Security Requirements
- All API keys must be stored securely (not in client code)
- User data must be isolated and protected
- Audio files must be stored securely in Supabase storage
- Authentication tokens must be handled securely

## Development Guidelines
- Use functional components with hooks
- Implement proper error handling throughout the app
- Include loading states for all asynchronous operations
- Ensure responsive design for different device sizes
- Follow accessibility best practices
- Implement proper form validation
- Use async/await for asynchronous operations
- Document all components and functions

## Detailed Screen Implementation Plans

### Home Screen Implementation

#### Design Reference
![Home Screen](https://i.imgur.com/placeholder.jpg)

1. UI Components
   - Header Section:
     - App icon/logo on left side
     - "Welcome Back" text
     - User avatar/profile button on right side
   
   - Meetings Header:
     - "My Meetings" title
     - "Stay on top of your meetings" subtitle in lighter text
   
   - Recordings List:
     - Dark-themed cards with rounded corners
     - Each card displays:
       - Colorful avatar icon on left (different for each meeting)
       - Meeting name in bold
       - Date (DD/MM/YYYY format)
       - Duration in minutes
     - No visible swipe actions in this design
     - Cards have subtle depth effect
   
   - Start Button:
     - Large gradient button at bottom (purple to blue gradient)
     - Centered "Start" text
     - Full width with rounded corners

2. Colors & Styling
   - Dark mode theme (black background)
   - Card background: Dark gray (#222222)
   - Text: White and light gray for primary/secondary text
   - Accent colors: Gradient buttons and avatar backgrounds
   - Typography: Clean sans-serif font family

3. State & Data
   - Fetch recordings from Supabase on component mount
   - Sort recordings by date (newest first)
   - Handle loading, error, and empty states

4. Interactions
   - Tapping recording card navigates to Meeting Overview
   - "Start" button navigates to Pre-Recording screen
   - Profile icon navigates to Profile/Settings screen

### Meeting Objectives Modal Implementation

#### Design Reference
![Meeting Objectives Modal](https://i.imgur.com/placeholder.jpg)

1. UI Components
   - Modal Container:
     - Semi-transparent overlay on the Active Call screen
     - Dark gray modal card with rounded corners
   
   - Header Section:
     - "Set Objectives For Meeting" title
     - "Never forget something important, be reminded if you go off track" subtitle
   
   - Audio Visualization:
     - Purple audio waveform visualization
   
   - Confirm Button:
     - Gray button with "Confirm" text
   
   - Timer Display:
     - Large circular timer showing elapsed time (00:40)
     - Outer ring in purple showing progress
   
   - Objectives Input Area:
     - Text area with "Notes...... objectives and things that are important" placeholder
     - Dark input field with lighter text

   - Question Display (in background):
     - "Question 1" label
     - "What does your business do?" question text
     - Appears to be part of the active call screen behind the modal

   - Alert Label (in background):
     - "Alert" text visible in the background screen

2. Colors & Styling
   - Dark theme consistent with the home screen
   - Modal background: Dark gray with slight transparency
   - Text: White and light gray for primary/secondary text
   - Accent color: Purple for timer ring and audio visualization
   - Typography: Same clean sans-serif font family

3. State & Data
   - Store objectives text input
   - Track if modal is open/closed
   - Connect to active recording session
   - Save objectives to database when confirmed

4. Interactions
   - Modal appears after clicking "Start" on home screen
   - User can type objectives in the text area
   - "Confirm" button saves objectives and closes modal
   - Modal should be dismissible (though not shown in design)
   - Objectives will be used during the meeting to provide reminders

5. Implementation Notes
   - This modal appears over the Active Call screen
   - The timer indicates recording has already started when setting objectives
   - This suggests recording begins immediately after pressing "Start" on home screen
   - Objectives added here will be used for the prompting system during the meeting

### Active Recording Screen Implementation

#### Design Reference
![Active Recording Screen](https://i.imgur.com/placeholder.jpg)

1. UI Components
   - Header Section:
     - Back button (< arrow) on left side
     - "Recording" status indicator with green dot
   
   - Reminder Card:
     - Purple bell icon on left
     - "Reminder" label in light purple/blue
     - Reminder text: "Check how much the deposit is."
     - Dark gray card with rounded corners
   
   - Audio Visualization:
     - Large circular container for audio visualization
     - Purple outer ring glowing effect
     - Audio waveform visualization in center (light purple)
     - Black circular background
   
   - End Call Button:
     - Gradient button (purple to blue) at bottom
     - "End Call" text centered
     - Same gradient style as Start button on home screen

2. Colors & Styling
   - Dark theme consistent with previous screens
   - Background: Black
   - Reminder card: Dark gray (#222222)
   - Text: White and light colors for contrast
   - Accent colors: Purple/blue for visualization and buttons
   - Typography: Same clean sans-serif font family

3. State & Data
   - Track recording status and time
   - Manage audio recording process
   - Cycle through objectives as reminders
   - Handle background processing for audio
   - Determine when to show objective reminders

4. Interactions
   - Back button (potentially pauses recording or confirms exit)
   - "End Call" button stops recording and navigates to processing screen
   - Automatic display of objective reminders at appropriate times
   - Audio visualization reacts to actual audio input

5. Implementation Notes
   - The reminder card displays objectives set earlier
   - Reminder cards should appear at strategic times based on conversation
   - Audio visualization should reflect actual audio input levels
   - Recording continues in the background even if user navigates away
   - May need intelligent timing for when to show each objective reminder

### Meeting Details Screen Implementation

#### Design Reference
![Meeting Details Screen](https://i.imgur.com/placeholder.jpg)

1. UI Components
   - Header Section:
     - Back button (< arrow) on left side
     - Account/profile icon on right side (not a notification bell)
   
   - Meeting Info Card:
     - Gradient card (blue to pink) with rounded corners
     - Meeting name: "Coffee Business"
     - Date and time: "14/03/2025 11:30"
     - Duration: "7 minutes, 15 seconds"
   
   - Tab Navigation:
     - Three tabs: "Minutes", "Transcript", "Chat"
     - Purple active indicator for selected tab
     - Currently showing "Minutes" tab content
   
   - Content Area:
     - Dark gray background
     - Text content with meeting minutes or transcript
     - Multiple paragraphs of text content
     - Good spacing between paragraphs
   
   - Playback Controls:
     - Bottom playback bar (currently shown blank in the design)
     - Needs implementation for audio playback functionality

2. Colors & Styling
   - Dark theme consistent with previous screens
   - Meeting card: Gradient blue to pink/purple
   - Tab background: Dark gray
   - Active tab indicator: Purple
   - Text: White and light gray for contrast
   - Typography: Same clean sans-serif font family

3. State & Data
   - Fetch meeting details, transcript, and minutes from Supabase
   - Manage tab selection state
   - Handle audio playback state (playing, paused, position)
   - Track current position in transcript during playback

4. Tab Content
   - Minutes Tab: 
     - AI-generated summary of the meeting
     - Key points and action items
     - Currently displayed in the screenshot
     - Real-time updates with database changes
   
   - Transcript Tab:
     - Full verbatim transcript with timestamps
     - Possibly speaker identification
     - Optimized loading with polling and subscriptions
   
   - Chat Tab:
     - Conversation interface for asking questions about the meeting
     - Input field for questions
     - AI responses based on meeting content using Gemini 2.0 Flash

5. Audio Playback Functionality
   - Audio player controls (play/pause, seek, speed control)
   - Visual timeline indicator
   - Transcript highlighting synchronized with audio playback
   - Volume control

6. Interactions
   - Tab switching to view different content types
   - Back button to return to home screen
   - Account icon to access profile/settings
   - Playback controls to navigate through the recording
   - Potential interaction to highlight specific sections of text/transcript

### Minutes Tab Implementation
1. UI Components
   - MinutesView: Formatted display of AI-generated minutes
   - KeyPointsList: Highlighted key takeaways
   - ActionItemsList: Tasks identified from meeting
   - ShareButton: Export/share functionality

2. State & Data
   - Fetch minutes from Supabase
   - Handle loading and error states

3. Interactions
   - Copy text selections
   - Share entire minutes
   - Navigate to specific points in transcript

### Transcript Tab Implementation
1. UI Components
   - TranscriptView: Full text with timestamps
   - SearchBar: Text search functionality
   - TranscriptLine: Individual line with timestamp
   - ShareButton: Export/share functionality

2. State & Data
   - Fetch transcript from Supabase
   - Implement search functionality
   - Handle loading and error states

3. Interactions
   - Search within transcript
   - Copy text selections
   - Share entire transcript

### Chat Tab Implementation
1. UI Components
   - ChatContainer: Main chat interface
   - MessageList: Display of conversation history
   - MessageBubble: Individual message component
   - MessageInput: Text input with send button
   - TypingIndicator: Shows when AI is generating response

2. State & Data
   - Store chat history locally and in Supabase
   - Manage message sending state
   - Handle API integration for responses

3. Interactions
   - Send messages to AI
   - Display AI responses
   - Scroll through chat history

### Profile Screen Implementation
1. UI Components
   - UserInfo: Display and edit user details
   - ThemeToggle: Switch between light/dark modes
   - SettingsList: Various app settings
   - LogoutButton: Authentication signout

2. State & Data
   - Fetch user profile from Supabase
   - Manage theme preferences

3. Interactions
   - Edit profile information
   - Toggle theme
   - Sign out functionality

## Action Items Implementation
1. UI Components
   - ActionItemsList: Display of all action items across meetings
   - ActionItemCard: Individual action item with checkbox
   - MeetingHeader: Grouping action items by meeting
   - DateSection: Organizing items chronologically (Today, Yesterday, by date)
   - SwipeableRow: Swipe-to-delete functionality

2. State & Data
   - Fetch action items from Supabase
   - Group by meeting and date
   - Track completion status
   - Handle optimistic UI updates

3. Interactions
   - Check/uncheck to mark items as complete
   - Swipe to delete items
   - Haptic feedback for interactions
   - Automatic closing of other open swipeables