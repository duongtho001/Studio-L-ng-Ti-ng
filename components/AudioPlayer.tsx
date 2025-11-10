import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';

interface AudioPlayerProps {
  audioUrl: string;
  fileName: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, fileName }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-300">Âm Thanh Đã Tạo</h3>
      <audio controls src={audioUrl} className="w-full">
        Trình duyệt của bạn không hỗ trợ phần tử âm thanh.
      </audio>
      <a
        href={audioUrl}
        download={fileName}
        className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors duration-300 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500"
      >
        <DownloadIcon className="w-5 h-5"/>
        Tải Âm Thanh (.wav)
      </a>
    </div>
  );
};