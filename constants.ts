import type { VoiceCategory } from './types';

export const NARRATOR_KEY = 'Người dẫn chuyện';

export const DEFAULT_MALE_VOICE = 'Puck';
export const DEFAULT_FEMALE_VOICE = 'Kore';
export const DEFAULT_NEUTRAL_VOICE = 'Kore';

export const VOICE_CATEGORIES: VoiceCategory = {
  "MC / Phát thanh viên": [
    { name: 'Kore', displayName: 'Kore', gender: 'Female' },
    { name: 'Puck', displayName: 'Puck', gender: 'Male' },
  ],
  "Truyền cảm / Thân thiện": [
    { name: 'Zephyr', displayName: 'Zephyr', gender: 'Female' },
  ],
  "Kinh dị / Giọng trầm": [
    { name: 'Fenrir', displayName: 'Fenrir (Trầm)', gender: 'Male' },
    { name: 'Charon', displayName: 'Charon (Trầm)', gender: 'Male' },
  ],
  "Kịch tính / Chiến tranh": [
    { name: 'Charon', displayName: 'Charon (Nghiêm túc)', gender: 'Male' },
    { name: 'Fenrir', displayName: 'Fenrir (Nghiêm túc)', gender: 'Male' },
  ],
  "Giọng nữ": [
    { name: 'Kore', displayName: 'Kore', gender: 'Female' },
    { name: 'Zephyr', displayName: 'Zephyr', gender: 'Female' },
  ],
  "Giọng nam": [
     { name: 'Puck', displayName: 'Puck', gender: 'Male' },
     { name: 'Charon', displayName: 'Charon', gender: 'Male' },
     { name: 'Fenrir', displayName: 'Fenrir', gender: 'Male' },
  ]
};