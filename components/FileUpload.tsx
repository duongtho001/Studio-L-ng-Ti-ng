import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
  onFilesSelect: (files: { content: string, name: string }[]) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filePromises = Array.from(files)
      .filter(file => file.type === 'text/plain')
      .map(file => {
        return new Promise<{ content: string, name: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve({ content, name: file.name });
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      });
    
    if (filePromises.length !== files.length) {
        alert("Một số tệp không phải là tệp .txt hợp lệ và đã bị bỏ qua.");
    }

    try {
      const results = await Promise.all(filePromises);
      if (results.length > 0) {
        onFilesSelect(results);
      }
    } catch (error) {
      alert("Đã xảy ra lỗi khi đọc tệp.");
      console.error(error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    processFiles(event.target.files);
  };

  const handleDragEvents = useCallback((e: React.DragEvent<HTMLLabelElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(dragging);
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    handleDragEvents(e, false);
    if (disabled) return;
    processFiles(e.dataTransfer.files);
  }, [disabled, handleDragEvents]);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-4 text-indigo-300">1. Tải Lên Kịch Bản</h2>
      <label
        htmlFor="file-upload"
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg transition-colors duration-300
          ${disabled 
            ? 'cursor-not-allowed bg-gray-800/50 border-gray-700 opacity-50' 
            : `cursor-pointer border-gray-600 bg-gray-800 hover:bg-gray-700/50 ${isDragging ? 'border-indigo-400 bg-gray-700' : ''}`
          }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
          <p className="mb-2 text-sm text-gray-400">
            {disabled 
              ? 'Vui lòng nhập API Key để kích hoạt'
              : <><span className="font-semibold text-indigo-400">Nhấn để tải lên</span> hoặc kéo và thả</>
            }
          </p>
          <p className="text-xs text-gray-500">Hỗ trợ nhiều tệp văn bản (.txt)</p>
        </div>
        <input id="file-upload" type="file" className="hidden" accept=".txt" onChange={handleFileChange} multiple disabled={disabled} />
      </label>
    </div>
  );
};