import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { MultiSpeakerVoiceConfig } from '@google/genai';
import { FileUpload } from './components/FileUpload';
import { CharacterVoiceMapper } from './components/CharacterVoiceMapper';
import { AudioPlayer } from './components/AudioPlayer';
import { Loader } from './components/Loader';
import type { CharacterMap, Job } from './types';
import { NARRATOR_KEY, DEFAULT_FEMALE_VOICE, DEFAULT_MALE_VOICE, DEFAULT_NEUTRAL_VOICE } from './constants';
import { createWavBlob, decodeBase64 } from './utils/audioUtils';
import { chunkTextBySentences } from './utils/textUtils';
import { StudioIcon } from './components/icons/StudioIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { PlayIcon } from './components/icons/PlayIcon';

export default function App() {
  const [apiKeysString, setApiKeysString] = useState<string>(() => localStorage.getItem('gemini-api-keys') || '');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isQueueProcessing, setIsQueueProcessing] = useState<boolean>(false);
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const apiKeys = useMemo(() => apiKeysString.split('\n').filter(k => k.trim() !== ''), [apiKeysString]);
  const currentApiKeyIndexRef = useRef(0);

  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const isQueuePausedRef = useRef(isQueuePaused);
  useEffect(() => {
    isQueuePausedRef.current = isQueuePaused;
  }, [isQueuePaused]);

  useEffect(() => {
    if (apiKeysString) {
      localStorage.setItem('gemini-api-keys', apiKeysString);
    } else {
      localStorage.removeItem('gemini-api-keys');
    }
  }, [apiKeysString]);

  const withApiKeyRotation = useCallback(async function<T>(apiCall: (apiKey: string) => Promise<T>): Promise<T> {
    if (apiKeys.length === 0) {
      throw new Error("Vui lòng cung cấp ít nhất một API Key.");
    }
    let lastError: any = null;
    for (let i = 0; i < apiKeys.length; i++) {
      const keyIndex = (currentApiKeyIndexRef.current + i) % apiKeys.length;
      const currentKey = apiKeys[keyIndex];
      try {
        const result = await apiCall(currentKey);
        currentApiKeyIndexRef.current = keyIndex;
        return result;
      } catch (e: any) {
        lastError = e;
        const isRateLimitError = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('API key not valid');
        if (isRateLimitError) {
          console.warn(`API key at index ${keyIndex} failed. Trying next key.`);
        } else {
          throw e;
        }
      }
    }
    throw lastError || new Error("Tất cả các API Key được cung cấp đều không hợp lệ hoặc đã hết hạn mức.");
  }, [apiKeys]);

  const detectCharactersAndGenders = useCallback(async (job: Job) => {
    const initialMap: CharacterMap = { [NARRATOR_KEY]: { voice: DEFAULT_NEUTRAL_VOICE } };
    try {
      const detectedCharacters: { name: string, gender: string }[] = await withApiKeyRotation(async (key) => {
        const ai = new GoogleGenAI({ apiKey: key });
        const prompt = `Please read the following script, identify all unique character names (excluding "${NARRATOR_KEY}"), and determine their likely gender (must be "Male", "Female", or "Neutral"). Return the result as a single JSON array of objects, where each object has a "name" and "gender" property. If no characters are found, return an empty array.

Script: """${job.fileContent}"""`;
        const responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              gender: { type: Type.STRING, enum: ['Male', 'Female', 'Neutral'] }
            },
            required: ['name', 'gender']
          }
        };
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });
        return JSON.parse(response.text);
      });
      detectedCharacters.forEach(char => {
        if (char.name && char.name.toLowerCase() !== NARRATOR_KEY.toLowerCase()) {
          const gender = char.gender;
          initialMap[char.name] = { voice: gender === 'Male' ? DEFAULT_MALE_VOICE : gender === 'Female' ? DEFAULT_FEMALE_VOICE : DEFAULT_NEUTRAL_VOICE };
        }
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, characterMap: initialMap, status: 'queued' } : j));
    } catch (e: any) {
      console.error("Failed to detect characters and genders:", e);
      const errorMessage = e.message?.includes('RESOURCE_EXHAUSTED')
        ? "Lỗi: Tất cả các API key đều đã hết hạn mức hoặc không hợp lệ."
        : "Không thể tự động phát hiện nhân vật. Vui lòng thêm thủ công.";
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, characterMap: initialMap, status: 'failed', error: errorMessage } : j));
    }
  }, [withApiKeyRotation]);

  const handleFilesSelect = useCallback((files: { content: string, name: string }[]) => {
    const newJobs: Job[] = files.map((file, index) => ({
      id: Date.now() + index,
      fileName: file.name,
      fileContent: file.content,
      status: 'detecting',
      characterMap: {},
    }));
    setJobs(prevJobs => [...prevJobs, ...newJobs]);
    (async () => {
      for (const newJob of newJobs) {
        await detectCharactersAndGenders(newJob);
      }
    })();
  }, [detectCharactersAndGenders]);

  const generateAudioForJob = async (jobId: number) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'processing', progressMessage: 'Chuẩn bị tạo...' } : j));
    try {
      const job = jobsRef.current.find(j => j.id === jobId);
      if (!job) throw new Error("Không tìm thấy công việc.");

      const speakers = Object.keys(job.characterMap).filter(c => c !== NARRATOR_KEY);
      if (speakers.length > 2) {
        throw new Error("Chỉ hỗ trợ tối đa hai nhân vật nói.");
      }

      const chunks = chunkTextBySentences(job.fileContent);
      const allPcmData: Uint8Array[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progressMessage: `Đang tạo phân đoạn ${i + 1}/${chunks.length}...` } : j));

        const currentJobForApi = jobsRef.current.find(j => j.id === jobId);
        if (!currentJobForApi) throw new Error("Job disappeared during API call");

        const response = await withApiKeyRotation(async (key) => {
          const ai = new GoogleGenAI({ apiKey: key });
          if (speakers.length === 2) {
            const speakerVoiceConfigs: MultiSpeakerVoiceConfig['speakerVoiceConfigs'] = speakers.map(speaker => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: currentJobForApi.characterMap[speaker].voice } } }));
            return await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: `TTS đoạn hội thoại sau giữa ${speakers.join(' và ')}:\n\n${chunks[i]}` }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs } } } });
          } else {
            const primarySpeaker = speakers.length === 1 ? speakers[0] : NARRATOR_KEY;
            const voice = currentJobForApi.characterMap[primarySpeaker]?.voice || DEFAULT_NEUTRAL_VOICE;
            return await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: `TTS đoạn văn bản sau:\n\n${chunks[i]}` }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
          }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) allPcmData.push(decodeBase64(base64Audio));
      }

      if (allPcmData.length === 0) throw new Error("Không thể tạo dữ liệu âm thanh.");
      
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progressMessage: 'Đang ghép âm thanh...' } : j));
      const totalLength = allPcmData.reduce((acc, val) => acc + val.length, 0);
      const combinedPcmData = new Uint8Array(totalLength);
      let offset = 0;
      for (const pcm of allPcmData) {
        combinedPcmData.set(pcm, offset);
        offset += pcm.length;
      }
      
      const wavBlob = createWavBlob(combinedPcmData, { sampleRate: 24000, numChannels: 1 });
      const url = URL.createObjectURL(wavBlob);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed', audioUrl: url, progressMessage: '' } : j));
    } catch (e: any) {
      console.error(e);
      let errorMessage = `Tạo thất bại: ${e.message}`;
      if (e.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Lỗi: Tất cả các API key đều đã hết hạn mức hoặc không hợp lệ. Vui lòng kiểm tra lại key và hạn mức của bạn.";
      }
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', error: errorMessage, progressMessage: '' } : j));
    }
  };

  const processQueue = async () => {
    if (isQueueProcessing && !isQueuePaused) return;

    setIsQueueProcessing(true);
    setIsQueuePaused(false);

    // Give state a moment to update so isQueuePausedRef is correct
    await new Promise(resolve => setTimeout(resolve, 0));

    const jobIdsToProcess = jobsRef.current.filter(j => j.status === 'queued').map(j => j.id);
    for (const jobId of jobIdsToProcess) {
      if (isQueuePausedRef.current) {
        return;
      }
      await generateAudioForJob(jobId);
    }
    setIsQueueProcessing(false);
    setIsQueuePaused(false);
  };

  const processSingleJob = async (jobId: number) => {
    if (isQueueProcessing) return;
    setIsQueueProcessing(true);
    await generateAudioForJob(jobId);
    setIsQueueProcessing(false);
  };
  
  const handlePauseResumeQueue = () => {
    if (isQueueProcessing) {
      setIsQueuePaused(prev => !prev);
      if (isQueuePaused) {
        // We are resuming, so call processQueue
        processQueue();
      }
    }
  };

  const handleDeleteJob = (jobId: number) => {
    const jobToDelete = jobs.find(j => j.id === jobId);
    if (jobToDelete?.audioUrl) {
      URL.revokeObjectURL(jobToDelete.audioUrl);
    }
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleUpdateEditingJob = (updatedMap: CharacterMap) => {
    if (!editingJob) return;
    setEditingJob(prev => prev ? { ...prev, characterMap: updatedMap } : null);
  };

  const handleSaveEdits = () => {
    if (!editingJob) return;
    setJobs(prev => prev.map(j => j.id === editingJob.id ? { ...j, characterMap: editingJob.characterMap } : j));
    setEditingJob(null);
  };

  const queuedJobsCount = useMemo(() => jobs.filter(j => j.status === 'queued').length, [jobs]);
  const isGenerateDisabled = apiKeys.length === 0 || (queuedJobsCount === 0 && !isQueueProcessing);

  const getStatusPill = (status: Job['status']) => {
    const styles: {[key: string]: string} = {
      detecting: 'bg-yellow-800 text-yellow-300 animate-pulse',
      queued: 'bg-blue-800 text-blue-300',
      processing: 'bg-purple-800 text-purple-300 animate-pulse',
      completed: 'bg-green-800 text-green-300',
      failed: 'bg-red-800 text-red-300',
    };
    const text: {[key: string]: string} = {
      detecting: 'Đang phân tích...',
      queued: 'Sẵn sàng',
      processing: 'Đang xử lý...',
      completed: 'Hoàn thành',
      failed: 'Thất bại',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{text[status]}</span>;
  };

  const renderMainButton = () => {
    if (isQueueProcessing && !isQueuePaused) {
      return (
        <button onClick={handlePauseResumeQueue} className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500">
          <Loader /> Tạm dừng
        </button>
      );
    }
    if (isQueueProcessing && isQueuePaused) {
      return (
        <button onClick={handlePauseResumeQueue} className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500">
          Tiếp tục ({queuedJobsCount} tệp)
        </button>
      );
    }
    return (
       <button onClick={processQueue} disabled={isGenerateDisabled} className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 ${isGenerateDisabled ? 'bg-indigo-900/50 cursor-not-allowed text-gray-400' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'}`}>
          Bắt đầu tạo ({queuedJobsCount} tệp)
        </button>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-7xl">
           <div className="w-full text-center text-sm text-gray-400 mb-4">
              <p>App của Thọ - 0934415387</p>
              <p>Tham Gia Nhóm zalo tạo app : <a href="https://zalo.me/g/sgkzgk550" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">https://zalo.me/g/sgkzgk550</a></p>
            </div>
          <header className="text-center mb-8">
            <StudioIcon className="w-16 h-16 mx-auto mb-4 text-indigo-400" />
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
              Studio Lồng Tiếng
            </h1>
            <p className="text-gray-400 mt-2 max-w-3xl mx-auto">
              Tải lên nhiều kịch bản, cấu hình giọng nói và tạo hàng loạt âm thanh lồng tiếng. Kết quả sẽ được lưu lại trong lịch sử của bạn.
            </p>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col gap-6 self-start">
              <div>
                <h2 className="text-2xl font-semibold mb-2 text-indigo-300">Quản lý API Keys</h2>
                <p className="text-sm text-gray-400 mb-3">
                  Nhập các API Key của bạn từ Google AI Studio, mỗi key một dòng. Hệ thống sẽ tự động chuyển sang key tiếp theo nếu key hiện tại hết hạn mức.
                </p>
                <textarea
                  value={apiKeysString}
                  onChange={(e) => setApiKeysString(e.target.value)}
                  placeholder="Dán các API Key của bạn vào đây, mỗi key một dòng"
                  className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                  aria-label="Gemini API Keys Input"
                  rows={4}
                />
              </div>

              <FileUpload onFilesSelect={handleFilesSelect} disabled={apiKeys.length === 0} />

              {renderMainButton()}
            </div>

            <div className="lg:col-span-3 bg-gray-800/50 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col">
              <h2 className="text-2xl font-semibold mb-4 text-indigo-300">Hàng chờ & Lịch sử</h2>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {jobs.length === 0 ? (
                   <div className="flex-grow flex items-center justify-center text-center bg-gray-900/50 rounded-lg p-8">
                    <p className="text-gray-400">Tải lên một hoặc nhiều tệp kịch bản để bắt đầu.</p>
                  </div>
                ) : (
                  [...jobs].reverse().map(job => (
                    <div key={job.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold truncate pr-4 break-all" title={job.fileName}>{job.fileName}</p>
                        {getStatusPill(job.status)}
                      </div>
                      
                      {job.status === 'processing' && (
                        <div className="flex items-center text-sm text-gray-400">
                           <Loader className="w-4 h-4 mr-2"/>
                           <span>{job.progressMessage}</span>
                        </div>
                      )}

                      {job.status === 'completed' && job.audioUrl && (
                        <div className="mt-2">
                          <AudioPlayer audioUrl={job.audioUrl} fileName={job.fileName.replace('.txt', '.wav')} />
                        </div>
                      )}

                      {job.error && <p className="text-sm text-red-400 mt-2 break-words">{job.error}</p>}
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex items-center gap-4">
                           {(job.status === 'queued' || job.status === 'failed') && (
                            <button 
                              onClick={() => setEditingJob(job)}
                              className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold disabled:text-gray-500 disabled:cursor-not-allowed"
                              disabled={isQueueProcessing}
                            >
                              Chỉnh sửa giọng nói
                            </button>
                          )}
                          {job.status === 'queued' && (
                            <button
                              onClick={() => processSingleJob(job.id)}
                              className="text-sm text-green-400 hover:text-green-300 font-semibold disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-1"
                              disabled={isQueueProcessing}
                            >
                              <PlayIcon className="w-4 h-4" /> Tạo ngay
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Xóa tệp ${job.fileName}`}
                          disabled={job.status === 'processing'}
                        >
                          <TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {editingJob && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setEditingJob(null)}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-2xl font-semibold text-indigo-300">Chỉnh sửa giọng nói</h2>
              <p className="text-gray-400 truncate" title={editingJob.fileName}>Tệp: {editingJob.fileName}</p>
            </div>
            <div className="p-6 overflow-y-auto">
               <CharacterVoiceMapper
                  characterMap={editingJob.characterMap}
                  onVoiceChange={(character, voice) => handleUpdateEditingJob({ ...editingJob.characterMap, [character]: { voice } })}
                  onAddCharacter={(name) => {
                     const trimmedName = name.trim();
                     if (trimmedName && !editingJob.characterMap.hasOwnProperty(trimmedName)) {
                       handleUpdateEditingJob({ ...editingJob.characterMap, [trimmedName]: { voice: 'Kore' } });
                     }
                  }}
                  onDeleteCharacter={(name) => {
                    const newMap = { ...editingJob.characterMap };
                    delete newMap[name];
                    handleUpdateEditingJob(newMap);
                  }}
                  isDetectingGenders={false}
                  withApiKeyRotation={withApiKeyRotation}
                />
            </div>
            <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-4 rounded-b-xl">
              <button onClick={() => setEditingJob(null)} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors font-semibold">Hủy</button>
              <button onClick={handleSaveEdits} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors font-semibold">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}