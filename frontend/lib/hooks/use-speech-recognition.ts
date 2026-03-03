import { useState, useEffect, useCallback } from 'react';

export interface UseSpeechRecognitionResult {
    isListening: boolean;
    transcript: string;
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const [recognitionObj, setRecognitionObj] = useState<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
            setIsSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        currentTranscript += event.results[i][0].transcript;
                    } else {
                        currentTranscript += event.results[i][0].transcript;
                    }
                }
                setTranscript(currentTranscript);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            setRecognitionObj(recognition);
        }
    }, []);

    const startListening = useCallback(() => {
        if (recognitionObj && !isListening) {
            try {
                setTranscript('');
                recognitionObj.start();
                setIsListening(true);
            } catch (error) {
                console.error('Failed to start speech recognition', error);
            }
        }
    }, [recognitionObj, isListening]);

    const stopListening = useCallback(() => {
        if (recognitionObj && isListening) {
            recognitionObj.stop();
            setIsListening(false);
        }
    }, [recognitionObj, isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    };
}
