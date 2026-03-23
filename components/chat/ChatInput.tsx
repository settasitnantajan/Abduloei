'use client';

import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Type declaration for browser compat
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
}

/** ตรวจว่า browser รองรับ Web Speech API หรือไม่ */
function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** หา MIME type ที่ MediaRecorder รองรับ (Safari ใช้ mp4, Chrome ใช้ webm) */
function getRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return 'audio/webm';
}

export default function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const messageBeforeListeningRef = useRef('');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error('กรุณาพิมพ์ข้อความ');
      return;
    }

    if (trimmedMessage.length > 2000) {
      toast.error('ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)');
      return;
    }

    setIsSending(true);

    // หยุด voice recognition ถ้ากำลังฟังอยู่
    if (isListening) {
      stopListening();
    }

    // เคลียร์ input ทันที (ก่อนรอ API)
    setMessage('');
    messageBeforeListeningRef.current = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(trimmedMessage);
    } catch (error) {
      // กรณี error → คืนข้อความกลับใน input
      setMessage(trimmedMessage);
      messageBeforeListeningRef.current = trimmedMessage;
      console.error('Error sending message:', error);
      toast.error('ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** หยุดอัดเสียง MediaRecorder และปล่อย stream */
  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    stopMediaRecorder();
    setIsListening(false);
  }, [stopMediaRecorder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopMediaRecorder();
    };
  }, [stopMediaRecorder]);

  const handleClear = () => {
    if (isListening) stopListening();
    setMessage('');
    messageBeforeListeningRef.current = '';
    textareaRef.current?.focus();
  };

  /** ส่ง audio blob ไป API แปลงเป็นข้อความ */
  const transcribeRecording = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'แปลงเสียงไม่สำเร็จ');
      }

      const data = await response.json();
      if (data.text) {
        const base = messageBeforeListeningRef.current;
        const separator = base && !base.endsWith(' ') ? ' ' : '';
        setMessage(base + separator + data.text);
      } else {
        toast.error('ไม่ได้ยินเสียงพูด กรุณาลองใหม่');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถแปลงเสียงได้');
    } finally {
      setIsTranscribing(false);
    }
  };

  /** เริ่มอัดเสียงด้วย MediaRecorder (สำหรับ Safari/iOS) */
  const startMediaRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        // ปล่อย stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // ส่งไปแปลงเสียง (ถ้ามีข้อมูล)
        if (audioBlob.size > 0) {
          transcribeRecording(audioBlob);
        }
      };

      recorder.start();
      messageBeforeListeningRef.current = message;
      setIsListening(true);
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'NotAllowedError') {
        toast.error('ไม่ได้รับอนุญาตใช้ไมโครโฟน กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์');
      } else {
        toast.error('ไม่สามารถเปิดไมโครโฟนได้');
        console.error('MediaRecorder error:', error);
      }
    }
  };

  /** หยุดอัดเสียง MediaRecorder */
  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  /** เริ่มฟังด้วย Web Speech API (Chrome/Edge) */
  const startWebSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    messageBeforeListeningRef.current = message;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const base = messageBeforeListeningRef.current;
      const separator = base && !base.endsWith(' ') ? ' ' : '';
      setMessage(base + separator + finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        toast.error('ไม่ได้รับอนุญาตใช้ไมโครโฟน กรุณาอนุญาตในเบราว์เซอร์');
      } else if (event.error !== 'aborted') {
        toast.error('เกิดข้อผิดพลาดในการรับเสียง');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      toast.error('ไม่สามารถเริ่มรับเสียงได้');
    }
  };

  const handleVoiceInput = () => {
    // ถ้ากำลังฟังอยู่ → หยุด
    if (isListening) {
      // ถ้าใช้ MediaRecorder → หยุดอัด (จะ trigger onstop → transcribe)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        stopMediaRecording();
      } else {
        stopListening();
      }
      return;
    }

    // เลือกวิธีตาม browser support
    if (isWebSpeechSupported()) {
      startWebSpeech();
    } else {
      startMediaRecording();
    }
  };

  const isInputDisabled = disabled || isSending || isTranscribing;

  return (
    <div className="bg-[#1A1A1A] border-t border-[#333333] p-4">
      <div className="max-w-4xl mx-auto flex items-end space-x-2">
        {/* Voice Input Button */}
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleVoiceInput}
          disabled={isInputDisabled}
          className={`h-12 w-12 rounded-full flex-shrink-0 transition-colors ${
            isListening
              ? 'bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse'
              : isTranscribing
                ? 'bg-yellow-600 border-yellow-500 text-white'
                : 'bg-[#2A2A2A] border-[#333333] text-gray-400 hover:text-white hover:bg-[#333333]'
          }`}
        >
          {isTranscribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isListening ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={isTranscribing ? 'กำลังแปลงเสียง...' : message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์ข้อความ..."
            disabled={isInputDisabled}
            className="min-h-[48px] max-h-[200px] resize-none bg-[#2A2A2A] border-[#333333] text-white placeholder:text-gray-500 pr-10 py-3"
            rows={1}
          />
          {message.length > 0 && !isTranscribing && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-[#444444] hover:bg-[#555555] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Send Button */}
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={isInputDisabled || !message.trim()}
          className="h-12 w-12 rounded-full bg-[#00B900] hover:bg-[#00A000] text-white flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* Character count */}
      {message.length > 1800 && (
        <div className="max-w-4xl mx-auto mt-2">
          <p
            className={`text-xs text-right ${
              message.length > 2000 ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {message.length} / 2000
          </p>
        </div>
      )}
    </div>
  );
}
