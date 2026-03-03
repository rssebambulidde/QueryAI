import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSpeechRecognitionResult {
    isListening: boolean;
    transcript: string;
    /** Always true — mic button always shown. Falls back to MediaRecorder on unsupported browsers. */
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    /** True when using the native SpeechRecognition API */
    usesNativeApi: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [usesNativeApi, setUsesNativeApi] = useState(false);
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
            setUsesNativeApi(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
            };

            recognition.onerror = (event: any) => {
                console.warn('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
        // MediaRecorder (fallback) is available on virtually all modern browsers.
        // We detect that it's available but no further action needed at init time —
        // it's set up on demand when recording starts.
    }, []);

    const startListening = useCallback(async () => {
        if (isListening) return;

        // --- Native Web Speech API path ---
        if (recognitionRef.current) {
            try {
                setTranscript('');
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.warn('Failed to start native speech recognition:', error);
            }
            return;
        }

        // --- MediaRecorder fallback path ---
        // Only record audio; transcription happens when user stops recording.
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                // Attempt to transcribe via the backend's Whisper-based endpoint
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');
                    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
                    const res = await fetch(`${apiBase}/api/transcribe`, {
                        method: 'POST',
                        body: formData,
                        credentials: 'include',
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setTranscript(data.text ?? '');
                    } else {
                        console.warn('Transcription request failed:', res.status);
                    }
                } catch (err) {
                    console.warn('Transcription upload failed:', err);
                }

                setIsListening(false);
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsListening(true);
        } catch (err) {
            console.warn('Microphone access denied:', err);
            setIsListening(false);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (!isListening) return;

        if (recognitionRef.current && usesNativeApi) {
            recognitionRef.current.stop();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        // Note: setIsListening(false) is called inside .onend / .onstop
    }, [isListening, usesNativeApi]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        isSupported: true, // Always show the button — MediaRecorder is near universal
        startListening,
        stopListening,
        resetTranscript,
        usesNativeApi,
    };
}
