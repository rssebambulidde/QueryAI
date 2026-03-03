import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSpeechRecognitionResult {
    isListening: boolean;
    transcript: string;
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
    const finalTranscriptRef = useRef('');
    // Track whether we intentionally stopped (vs browser auto-stopping on silence)
    const intentionalStopRef = useRef(false);
    const isListeningRef = useRef(false);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) return;

        setUsesNativeApi(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening continuously
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US'; // Respect device language

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscriptRef.current += result[0].transcript + ' ';
                } else {
                    interimTranscript += result[0].transcript;
                }
            }
            setTranscript(finalTranscriptRef.current + interimTranscript);
        };

        recognition.onerror = (event: any) => {
            // 'no-speech' and 'network' are non-fatal — restart silently if still meant to be listening
            if (
                (event.error === 'no-speech' || event.error === 'network' || event.error === 'audio-capture') &&
                isListeningRef.current &&
                !intentionalStopRef.current
            ) {
                // Brief pause then restart
                setTimeout(() => {
                    if (isListeningRef.current && !intentionalStopRef.current) {
                        try { recognition.start(); } catch { /* already started */ }
                    }
                }, 300);
            } else {
                console.warn('Speech recognition error:', event.error);
                setIsListening(false);
                isListeningRef.current = false;
            }
        };

        recognition.onend = () => {
            // Browser stops recognition after a period of silence.
            // Auto-restart unless the user intentionally stopped.
            if (isListeningRef.current && !intentionalStopRef.current) {
                try { recognition.start(); } catch { /* already started */ }
            } else {
                setIsListening(false);
                isListeningRef.current = false;
            }
        };

        recognitionRef.current = recognition;
    }, []);

    const startListening = useCallback(async () => {
        if (isListeningRef.current) return;

        // Reset
        finalTranscriptRef.current = '';
        setTranscript('');
        intentionalStopRef.current = false;

        // --- Native Web Speech API ---
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                isListeningRef.current = true;
            } catch (error) {
                console.warn('Failed to start speech recognition:', error);
            }
            return;
        }

        // --- MediaRecorder fallback (Firefox / unsupported browsers) ---
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
                isListeningRef.current = false;
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsListening(true);
            isListeningRef.current = true;
        } catch (err) {
            console.warn('Microphone access denied:', err);
        }
    }, []);

    const stopListening = useCallback(() => {
        intentionalStopRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);

        if (recognitionRef.current && usesNativeApi) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, [usesNativeApi]);

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
