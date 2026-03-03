import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSpeechRecognitionResult {
    isListening: boolean;
    transcript: string;
    /** Always true — mic button always shown */
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    usesNativeApi: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [usesNativeApi, setUsesNativeApi] = useState(false);
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    // Accumulate all FINAL results here so intermediate results don't duplicate
    const finalTranscriptRef = useRef('');

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
                let interimTranscript = '';
                // Build from resultIndex onwards
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        // Append final result to the running total
                        finalTranscriptRef.current += result[0].transcript + ' ';
                    } else {
                        // These are interim (live preview) — not yet final
                        interimTranscript += result[0].transcript;
                    }
                }
                // Expose: final accumulated text + current interim preview
                setTranscript(finalTranscriptRef.current + interimTranscript);
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
    }, []);

    const startListening = useCallback(async () => {
        if (isListening) return;

        // Reset any previous accumulated transcript
        finalTranscriptRef.current = '';
        setTranscript('');

        // --- Native Web Speech API path ---
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.warn('Failed to start native speech recognition:', error);
            }
            return;
        }

        // --- MediaRecorder fallback ---
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
    }, [isListening, usesNativeApi]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        finalTranscriptRef.current = '';
    }, []);

    return {
        isListening,
        transcript,
        isSupported: true,
        startListening,
        stopListening,
        resetTranscript,
        usesNativeApi,
    };
}
