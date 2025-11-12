import React, { useState, useRef, useEffect } from 'react';
import type { CharacterMap } from '../types';
import { THEME_VOICES, COUNTRY_VOICES, NARRATOR_KEY } from '../constants';
import { GoogleGenAI, Modality } from '@google/genai';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';
import { Loader } from './Loader';
import { PlayIcon } from './icons/PlayIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SpeakerWaveIcon } from './icons/SpeakerWaveIcon';


interface CharacterVoiceMapperProps {
  characterMap: CharacterMap;
  onVoiceChange: (character: string, voice: string) => void;
  onAddCharacter: (name: string) => void;
  onDeleteCharacter: (name: string) => void;
  isDetectingGenders: boolean;
  withApiKeyRotation: <T>(apiCall: (apiKey: string) => Promise<T>) => Promise<T>;
}

export const CharacterVoiceMapper: React.FC<CharacterVoiceMapperProps> = ({ characterMap, onVoiceChange, onAddCharacter, onDeleteCharacter, isDetectingGenders, withApiKeyRotation }) => {
  const characters = Object.keys(characterMap).filter(c => c !== NARRATOR_KEY);
  const [previewState, setPreviewState] = useState<{ char: string; status: 'loading' | 'playing' } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState<'theme' | 'country'>('theme');

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePreview = async (character: string, voice: string) => {
    if (previewState) return;

    // Stop any currently playing audio from previous clicks
    if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
        currentSourceRef.current = null;
    }

    setPreviewState({ char: character, status: 'loading' });
    setPreviewError(null);

    try {
      // Initialize AudioContext on first user interaction
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioContext = audioContextRef.current;
      
      // Browsers may suspend AudioContext until a user gesture.
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const response = await withApiKeyRotation(async (key) => {
        const ai = new GoogleGenAI({ apiKey: key });
        return ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Xin chào, đây là giọng nói mẫu của tôi.` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        });
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error("Không tìm thấy dữ liệu âm thanh trong phản hồi từ API.");
      }
      
      const pcmData = decodeBase64(base64Audio);
      
      // Use Web Audio API to decode and play
      const audioBuffer = await decodeAudioData(pcmData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      currentSourceRef.current = source;
      
      source.onended = () => {
        setPreviewState(null);
        // Check if this is still the current source before nullifying the ref
        if (currentSourceRef.current === source) {
            currentSourceRef.current = null;
        }
      };
      
      source.start(0); // Start playing immediately
      setPreviewState({ char: character, status: 'playing' });

    } catch (e: any) {
      console.error("Xem trước thất bại:", e);
      setPreviewError(`Không thể tạo bản xem trước cho giọng nói của ${character}. Vui lòng thử lại.`);
      setPreviewState(null);
    }
  };
  
  const handleAddClick = () => {
    if (newCharName.trim()) {
      onAddCharacter(newCharName);
      setNewCharName('');
    }
  };

  const voiceCategories = selectionMode === 'theme' ? THEME_VOICES : COUNTRY_VOICES;

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-indigo-300">2. Phân Bổ Giọng Nói</h2>
       {previewError && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-2 rounded-lg mb-4 text-sm" role="alert">
          <p>{previewError}</p>
        </div>
      )}

      {isDetectingGenders ? (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900/50 rounded-lg">
          <Loader />
          <p className="text-gray-400 mt-4 animate-pulse">Đang phân tích kịch bản và nhận dạng giới tính nhân vật...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
             <input
              type="text"
              placeholder="Tìm kiếm giọng nói trong danh sách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
            />
          </div>
           <div className="mb-4 flex items-center justify-center rounded-lg bg-gray-700/50 p-1 w-max mx-auto">
              <button onClick={() => setSelectionMode('theme')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${selectionMode === 'theme' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600/50'}`}>
                Theo Chủ Đề
              </button>
              <button onClick={() => setSelectionMode('country')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${selectionMode === 'country' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600/50'}`}>
                Theo Quốc Gia
              </button>
            </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {characters.length > 0 ? (
              characters.map(char => (
                <div key={char} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg gap-2">
                  <span className="font-medium text-gray-300 flex-1 truncate" title={char}>{char}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={characterMap[char]?.voice || ''}
                      onChange={(e) => onVoiceChange(char, e.target.value)}
                      className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                      disabled={!!previewState}
                    >
                      {Object.entries(voiceCategories).map(([category, voices]) => {
                        const filteredVoices = voices.filter(voice => voice.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
                        if (filteredVoices.length === 0) return null;

                        return (
                          <optgroup label={category} key={category}>
                            {filteredVoices.map(voice => (
                              <option key={voice.name} value={voice.name}>
                                {voice.displayName} ({voice.gender === 'Male' ? 'Nam' : 'Nữ'})
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <button
                      onClick={() => handlePreview(char, characterMap[char].voice)}
                      disabled={!!previewState}
                      className="p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Xem trước giọng của ${char}`}
                    >
                       {previewState?.char === char && previewState.status === 'loading' ? (
                        <Loader className="w-5 h-5" />
                      ) : previewState?.char === char && previewState.status === 'playing' ? (
                        <SpeakerWaveIcon className="w-5 h-5 text-green-400 animate-pulse" />
                      ) : (
                        <PlayIcon className="w-5 h-5 text-indigo-400" />
                      )}
                    </button>
                    <button
                        onClick={() => onDeleteCharacter(char)}
                        disabled={!!previewState}
                        className="p-2.5 rounded-lg bg-gray-700 hover:bg-red-800/50 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Xóa nhân vật ${char}`}
                    >
                        <TrashIcon className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400">Không có nhân vật nào được phát hiện trong kịch bản.</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-indigo-400">Thêm Nhân Vật Thủ Công</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="Tên Nhân Vật"
                className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                onKeyDown={(e) => e.key === 'Enter' && handleAddClick()}
              />
              <button
                onClick={handleAddClick}
                className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                disabled={!newCharName.trim()}
                aria-label="Thêm nhân vật mới"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};