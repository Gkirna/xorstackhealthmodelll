import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AudioUploadOptions {
  sessionId?: string;
  onTranscriptGenerated?: (text: string) => void;
  onAudioUploaded?: (url: string) => void;
  maxFileSize?: number; // in MB
  allowedFormats?: string[];
}

interface UploadState {
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  uploadedFile: File | null;
  audioUrl: string | null;
}

export function useAudioUpload(options: AudioUploadOptions = {}) {
  const {
    sessionId,
    onTranscriptGenerated,
    onAudioUploaded,
    maxFileSize = 100, // Increased to 100MB for longer sessions
    allowedFormats = [
      '.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac', 
      '.mp4', '.avi', '.mov', '.wmv' // Support video files (audio will be extracted)
    ],
  } = options;

  const [state, setState] = useState<UploadState>({
    isUploading: false,
    uploadProgress: 0,
    error: null,
    uploadedFile: null,
    audioUrl: null,
  });

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size must be less than ${maxFileSize}MB. Current size: ${fileSizeMB.toFixed(2)}MB`;
    }

    // Check file format
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedFormats.includes(fileExtension)) {
      return `Unsupported file format. Allowed formats: ${allowedFormats.join(', ')}`;
    }

    return null;
  }, [maxFileSize, allowedFormats]);

  const uploadAudio = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      toast.error(validationError);
      return;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isUploading: true, 
        uploadProgress: 0, 
        error: null,
        uploadedFile: file 
      }));

      console.log('📤 Starting audio upload...', { 
        fileName: file.name, 
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB` 
      });

      // Create a progress simulation for better UX
      const progressInterval = setInterval(() => {
        setState(prev => {
          const newProgress = Math.min(prev.uploadProgress + Math.random() * 15, 90);
          return { ...prev, uploadProgress: newProgress };
        });
      }, 200);

      const fileName = sessionId 
        ? `${sessionId}/${Date.now()}_${file.name}`
        : `${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      clearInterval(progressInterval);

      if (error) throw error;

      setState(prev => ({ ...prev, uploadProgress: 100 }));

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio-recordings')
        .getPublicUrl(fileName);

      setState(prev => ({ ...prev, audioUrl: publicUrl }));

      console.log('✅ Audio uploaded successfully:', publicUrl);
      toast.success('Audio uploaded successfully');

      if (onAudioUploaded) {
        onAudioUploaded(publicUrl);
      }

      // Trigger transcription
      await transcribeAudio(publicUrl);

      setState(prev => ({ ...prev, isUploading: false }));
    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload audio';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isUploading: false 
      }));
      toast.error(errorMessage);
    }
  }, [sessionId, validateFile, onAudioUploaded]);

  const transcribeAudio = useCallback(async (audioUrl: string) => {
    try {
      console.log('🎯 Starting transcription for uploaded audio...');
      setState(prev => ({ ...prev, uploadProgress: 70 }));
      
      // For large files, show estimated processing time
      toast.info('Processing audio... This may take a few minutes for longer recordings.');
      
      // Download the audio file to convert to base64
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      
      console.log('📦 Audio blob size:', (audioBlob.size / (1024 * 1024)).toFixed(2), 'MB');
      
      setState(prev => ({ ...prev, uploadProgress: 75 }));
      
      // Convert to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      setState(prev => ({ ...prev, uploadProgress: 80 }));
      console.log('📤 Calling transcription edge function...');

      // Call Supabase edge function with longer timeout expectation
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          session_id: sessionId,
        },
      });

      if (error) throw error;

      setState(prev => ({ ...prev, uploadProgress: 100 }));
      
      const transcriptText = data?.text || '';
      
      if (transcriptText) {
        const wordCount = transcriptText.split(' ').length;
        console.log('✅ Transcription completed:', wordCount, 'words');
        toast.success(`Transcription completed! ${wordCount} words transcribed.`);
        
        if (onTranscriptGenerated) {
          onTranscriptGenerated(transcriptText);
        }
      } else {
        throw new Error('No transcript received from server');
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      toast.error(errorMessage);
    }
  }, [sessionId, onTranscriptGenerated]);

  const removeAudio = useCallback(() => {
    setState(prev => ({
      ...prev,
      uploadedFile: null,
      audioUrl: null,
      error: null,
      uploadProgress: 0,
    }));
    toast.info('Audio file removed');
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return {
    ...state,
    uploadAudio,
    removeAudio,
    formatFileSize,
    validateFile,
  };
}
