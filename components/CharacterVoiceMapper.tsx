
import React, { useState } from 'react';
import type { CharacterMap } from '../types';
import { VOICE_CATEGORIES, NARRATOR_KEY } from '../constants';
import { GoogleGenAI, Modality } from '@google/genai';
import { decodeBase64, createWavBlob } from '../utils/audioUtils';
import { Loader } from './Loader';
import { PlayIcon } from './icons/PlayIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';


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
  const [previewingChar, setPreviewingChar] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [newCharName, setNewCharName] = useState('');

  const handlePreview = async (character: string, voice: string) => {
    if (previewingChar) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }

    setPreviewingChar(character);
    setPreviewError(null);

    let audioUrl = '';

    try {
      // FIX: Use the injected API key rotation function for consistency.
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
      const wavBlob = createWavBlob(pcmData, { sampleRate: 24000, numChannels: 1 });
      audioUrl = URL.createObjectURL(wavBlob);

      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      audio.play();

      const cleanup = () => {
        setPreviewingChar(null);
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      };

      audio.onended = cleanup;
      audio.onerror = () => {
        console.error("Lỗi khi phát âm thanh xem trước.");
        setPreviewError(`Không thể phát bản xem trước cho giọng nói của ${character}.`);
        cleanup();
      };

    } catch (e: any) {
      console.error("Xem trước thất bại:", e);
      setPreviewError(`Không thể tạo bản xem trước cho giọng nói của ${character}.`);
      setPreviewingChar(null);
       if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    }
  };
  
  const handleAddClick = () => {
    if (newCharName.trim()) {
      onAddCharacter(newCharName);
      setNewCharName('');
    }
  };


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
                      disabled={!!previewingChar}
                    >
                      {Object.entries(VOICE_CATEGORIES).map(([category, voices]) => (
                        <optgroup label={category} key={category}>
                          {voices.map(voice => (
                            <option key={voice.name} value={voice.name}>
                              {voice.displayName} ({voice.gender === 'Male' ? 'Nam' : 'Nữ'})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      onClick={() => handlePreview(char, characterMap[char].voice)}
                      disabled={!!previewingChar}
                      className="p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
                      aria-label={`Xem trước giọng của ${char}`}
                    >
                      {previewingChar === char ? (
                        <Loader className="w-5 h-5" />
                      ) : (
                        <PlayIcon className="w-5 h-5 text-indigo-400" />
                      )}
                    </button>
                    <button
                        onClick={() => onDeleteCharacter(char)}
                        disabled={!!previewingChar}
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
