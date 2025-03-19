export interface Meeting {
  id: string;
  user_id: string;
  name: string;
  duration: number;
  status: string;
  created_at: string;
  updated_at: string;
  audio_url?: string;
  transcript_url?: string;
  summary?: string;
}

export interface Objective {
  id: string;
  meeting_id: string;
  description: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  sound: any;
  duration: string;
  file: string;
}
