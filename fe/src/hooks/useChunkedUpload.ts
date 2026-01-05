import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7777';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - must match backend
const MAX_CONCURRENT_CHUNKS = 3; // Upload 3 chunks in parallel

interface UploadedFile {
  path: string;
  url: string;
  size: number;
  mimeType: string;
  type: 'image' | 'video';
}

interface UploadProgress {
  fileIndex: number;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UseChunkedUploadOptions {
  onProgress?: (files: UploadProgress[], overall: number) => void;
  onFileComplete?: (fileIndex: number, file: UploadedFile) => void;
  onAllComplete?: (files: UploadedFile[]) => void;
  onError?: (error: string) => void;
}

export function useChunkedUpload(options: UseChunkedUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadChunk = async (
    uploadId: string,
    file: File,
    chunkIndex: number,
    signal: AbortSignal
  ): Promise<boolean> => {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunk', chunk);

    const response = await axios.post(`${API_BASE}/api/upload/${uploadId}/chunk`, formData, {
      signal,
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data.complete;
  };

  const uploadFile = async (
    file: File,
    _fileIndex: number,
    signal: AbortSignal,
    updateProgress: (progress: number) => void
  ): Promise<UploadedFile> => {
    // Initialize upload session
    const initResponse = await axios.post(`${API_BASE}/api/upload/init`, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, { signal, withCredentials: true });

    const { uploadId, totalChunks } = initResponse.data;
    let uploadedChunks = 0;

    // Upload chunks with concurrency control
    const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);

    // Process chunks in batches
    for (let i = 0; i < chunkIndices.length; i += MAX_CONCURRENT_CHUNKS) {
      const batch = chunkIndices.slice(i, i + MAX_CONCURRENT_CHUNKS);

      await Promise.all(
        batch.map(async (chunkIndex) => {
          await uploadChunk(uploadId, file, chunkIndex, signal);
          uploadedChunks++;
          const progress = Math.round((uploadedChunks / totalChunks) * 100);
          updateProgress(progress);
        })
      );
    }

    // Complete upload and get final file info
    const completeResponse = await axios.post(`${API_BASE}/api/upload/${uploadId}/complete`, {}, { signal, withCredentials: true });
    return completeResponse.data.file;
  };

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return [];

    setIsUploading(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Initialize progress for all files
    const initialProgress: UploadProgress[] = files.map((file, index) => ({
      fileIndex: index,
      fileName: file.name,
      progress: 0,
      status: 'pending',
    }));
    setProgress(initialProgress);
    setOverallProgress(0);

    const uploadedFiles: UploadedFile[] = [];
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    let uploadedSize = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileStartSize = uploadedSize;

        // Update status to uploading
        setProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'uploading' } : p
        ));

        const uploadedFile = await uploadFile(
          file,
          i,
          signal,
          (fileProgress) => {
            // Update file progress
            setProgress(prev => prev.map((p, idx) =>
              idx === i ? { ...p, progress: fileProgress } : p
            ));

            // Update overall progress
            const currentFileUploaded = (fileProgress / 100) * file.size;
            const totalUploaded = fileStartSize + currentFileUploaded;
            const overall = Math.round((totalUploaded / totalSize) * 100);
            setOverallProgress(overall);

            options.onProgress?.(
              progress.map((p, idx) =>
                idx === i ? { ...p, progress: fileProgress } : p
              ),
              overall
            );
          }
        );

        uploadedFiles.push(uploadedFile);
        uploadedSize += file.size;

        // Update status to complete
        setProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'complete', progress: 100 } : p
        ));

        options.onFileComplete?.(i, uploadedFile);
      }

      setOverallProgress(100);
      options.onAllComplete?.(uploadedFiles);
      return uploadedFiles;
    } catch (error) {
      if (axios.isCancel(error)) {
        options.onError?.('Upload cancelado');
      } else {
        const message = error instanceof Error ? error.message : 'Erro no upload';
        options.onError?.(message);

        // Mark current file as error
        setProgress(prev => prev.map((p) =>
          p.status === 'uploading' ? { ...p, status: 'error', error: message } : p
        ));
      }
      return [];
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [options]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setProgress([]);
    setOverallProgress(0);
    setIsUploading(false);
  }, []);

  return {
    upload,
    cancel,
    reset,
    isUploading,
    progress,
    overallProgress,
  };
}

// Utility to format file size
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
