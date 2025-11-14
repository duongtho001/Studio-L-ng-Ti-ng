import type { Voice, VoiceCategory } from './types';

export const NARRATOR_KEY = 'Người dẫn chuyện';

export const DEFAULT_MALE_VOICE = 'Puck';
export const DEFAULT_FEMALE_VOICE = 'Kore';
export const DEFAULT_NEUTRAL_VOICE = 'Kore';

// --- Voice Definitions ---
// These are the base voice objects. We can create variants with different display names for different contexts.

// Female Voices
const KORE: Voice = { name: 'Kore', displayName: 'Kore', gender: 'Female' };
const ZEPHYR: Voice = { name: 'Zephyr', displayName: 'Zephyr', gender: 'Female' };

// Male Voices
const PUCK: Voice = { name: 'Puck', displayName: 'Puck', gender: 'Male' };
const CHARON_GENERIC: Voice = { name: 'Charon', displayName: 'Charon', gender: 'Male' };
const FENRIR_GENERIC: Voice = { name: 'Fenrir', displayName: 'Fenrir', gender: 'Male' };

// --- Voice Variants for Context ---

// For horror, mystery, deep voice contexts
const CHARON_DEEP: Voice = { ...CHARON_GENERIC, displayName: 'Charon (Trầm)' };
const FENRIR_DEEP: Voice = { ...FENRIR_GENERIC, displayName: 'Fenrir (Trầm)' };

// For war, drama, serious contexts
const CHARON_SERIOUS: Voice = { ...CHARON_GENERIC, displayName: 'Charon (Nghiêm túc)' };
const FENRIR_SERIOUS: Voice = { ...FENRIR_GENERIC, displayName: 'Fenrir (Nghiêm túc)' };


// --- Voice Groupings ---
const ALL_FEMALE_VOICES: Voice[] = [KORE, ZEPHYR];
const ALL_MALE_VOICES: Voice[] = [PUCK, CHARON_GENERIC, FENRIR_GENERIC];

// For Themes
const ANNOUNCER_VOICES: Voice[] = [KORE, PUCK]; // Clear, neutral voices for news, facts, products
const INSPIRATIONAL_VOICES: Voice[] = [ZEPHYR]; // Warm, friendly voice for poems, meditation
const HORROR_VOICES: Voice[] = [CHARON_DEEP, FENRIR_DEEP]; // Deep, menacing voices
const DRAMA_VOICES: Voice[] = [CHARON_SERIOUS, FENRIR_SERIOUS]; // Serious, impactful voices

// For Countries (assignments are for organizational purposes)
const VIETNAM_VOICES: Voice[] = [...ALL_FEMALE_VOICES, ...ALL_MALE_VOICES];
const USA_VOICES: Voice[] = [KORE, ZEPHYR, PUCK];
const UK_VOICES: Voice[] = [PUCK, FENRIR_SERIOUS];
const FRANCE_VOICES: Voice[] = [ZEPHYR];
const RUSSIA_VOICES: Voice[] = [CHARON_DEEP, FENRIR_DEEP];
const KOREA_VOICES: Voice[] = [KORE, PUCK];
const JAPAN_VOICES: Voice[] = [ZEPHYR, PUCK];
const CHINA_VOICES: Voice[] = [KORE, CHARON_SERIOUS];
const PORTUGAL_VOICES: Voice[] = [KORE, PUCK];
const SPAIN_VOICES: Voice[] = [ZEPHYR, CHARON_GENERIC];


export const COUNTRY_VOICES: VoiceCategory = {
  "Việt Nam": VIETNAM_VOICES,
  "Mỹ (USA)": USA_VOICES,
  "Anh (UK)": UK_VOICES,
  "Pháp (France)": FRANCE_VOICES,
  "Nga (Russia)": RUSSIA_VOICES,
  "Hàn Quốc (Korea)": KOREA_VOICES,
  "Nhật Bản (Japan)": JAPAN_VOICES,
  "Trung Quốc (China)": CHINA_VOICES,
  "Bồ Đào Nha (Portugal)": PORTUGAL_VOICES,
  "Tây Ban Nha (Spain)": SPAIN_VOICES,
};

export const THEME_VOICES: VoiceCategory = {
  "Truyện ngắn": [...ANNOUNCER_VOICES, ...INSPIRATIONAL_VOICES],
  "Sự thật thú vị": ANNOUNCER_VOICES,
  "Trích dẫn": [...INSPIRATIONAL_VOICES, ...DRAMA_VOICES],
  "Thơ": INSPIRATIONAL_VOICES,
  "Giáo dục": ANNOUNCER_VOICES,
  "Thiền": INSPIRATIONAL_VOICES,
  "Sản phẩm": ANNOUNCER_VOICES,
  "Thư nháp": ANNOUNCER_VOICES,
  "Kinh dị": HORROR_VOICES,
  "Truyện ma": HORROR_VOICES,
  "Chiến tranh": DRAMA_VOICES,
  "Mặt trái sự thật": DRAMA_VOICES,
  "Giả tưởng": [...ALL_FEMALE_VOICES, ...ALL_MALE_VOICES],
  "Khoa học viễn tưởng": [...ANNOUNCER_VOICES, ...DRAMA_VOICES],
  "Bí ẩn": HORROR_VOICES,
  "Kịch": [...ALL_FEMALE_VOICES, ...ALL_MALE_VOICES],
  "Thế giới động vật": ANNOUNCER_VOICES,
  "Câu chuyện tâm linh": [...INSPIRATIONAL_VOICES, ...HORROR_VOICES],
  "Cổ tích": [KORE, PUCK, ZEPHYR],
  "Thời sự / Tin tức": ANNOUNCER_VOICES,
  "Tất cả Giọng nữ": ALL_FEMALE_VOICES,
  "Tất cả Giọng nam": ALL_MALE_VOICES,
};
