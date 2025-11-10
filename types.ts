export interface Voice {
  name: string;
  displayName: string;
  gender: 'Male' | 'Female' | 'Neutral';
}

export interface VoiceCategory {
  [categoryName: string]: Voice[];
}

export interface CharacterMap {
  [characterName: string]: {
    voice: string;
  };
}

export interface Job {
  id: number;
  fileName: string;
  fileContent: string;
  status: 'queued' | 'detecting' | 'processing' | 'completed' | 'failed';
  characterMap: CharacterMap;
  audioUrl?: string;
  error?: string;
  progressMessage?: string;
}
