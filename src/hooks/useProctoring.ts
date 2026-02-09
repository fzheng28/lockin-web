
import { useState, useEffect, useRef } from 'react';



const FRAME_RATE = 1.5; // frames per second
const JPEG_QUALITY = 0.4; // 40%
// Audio: buffer and send every ~500ms (~60KB per request) to stay well under body limits
const AUDIO_SEND_INTERVAL_MS = 500;

export const useProctoring = () => {
  const [isProctoring, setIsProctoring] = useState(false);
  const isProctoringRef = useRef(isProctoring); // Added
  const [error, setError] = useState<string | null>(null);
  const [isDistracted, setIsDistracted] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>([]);
  const mediaStream = useRef<MediaStream | null>(null);
  const frameIntervalId = useRef<number | null>(null); // For frame streaming interval
  const availableVoices = useRef<SpeechSynthesisVoice[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const proctoringSession = useRef<any>(null); // Placeholder for Gemini Live session
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<number[]>([]);
  const audioSendIntervalId = useRef<number | null>(null);

  useEffect(() => {
    const populateVoices = () => {
      availableVoices.current = window.speechSynthesis.getVoices();
    };
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, []);

  useEffect(() => {
    isProctoringRef.current = isProctoring;
  }, [isProctoring]);

  const speakFeedback = (text: string, shouldSpeak: boolean) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);

      const maleVoice = availableVoices.current.find(voice =>
        voice.lang.startsWith('en') &&
        (voice.name.toLowerCase().includes('google uk english male') ||
          voice.name.toLowerCase().includes('microsoft david - english (united states)') ||
          voice.name.toLowerCase().includes('male') ||
          voice.name.toLowerCase().includes('man') ||
          voice.name.toLowerCase().includes('david') ||
          voice.name.toLowerCase().includes('daniel'))
      );

      if (maleVoice) {
        utterance.voice = maleVoice;
      }
      utterance.pitch = 0.8;
      utterance.rate = 0.85;

      utterance.onend = () => { };
      utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
      };

      if (shouldSpeak) {
        window.speechSynthesis.speak(utterance);
      }
      setFeedbackHistory(prev => [...prev, text]);
    } else {
      console.warn('Speech synthesis not supported in this browser.');
      setFeedbackHistory(prev => [...prev, `[Speech not supported] ${text}`]);
    }
  };

  const startProctoring = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera and microphone are not available in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mediaStream.current = stream;
      // Assign the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsProctoring(true);
      setError(null);

      // Initialize Gemini chat session for real-time proctoring via backend
      const response = await fetch('/api/proctoring-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'start' }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Backend response:', data);
      proctoringSession.current = true; // Use a boolean to indicate session is active

      // setupFrameStreaming(); // This will be called via useEffect
    } catch (err) {
      console.error('Error starting proctoring:', err);
      setError('Could not access camera and microphone. Please check permissions.');
      setIsProctoring(false);
    }
  };

  const stopProctoring = () => {
    window.speechSynthesis.cancel();
    if (frameIntervalId.current) {
      clearInterval(frameIntervalId.current);
      frameIntervalId.current = null;
    }
    if (audioSendIntervalId.current) {
      clearInterval(audioSendIntervalId.current);
      audioSendIntervalId.current = null;
    }
    audioBufferRef.current = [];
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
    }
    // Close the audio context and processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Close the proctoring session if it exists (no explicit end for backend session)
    proctoringSession.current = null;
    // Immediately update the ref to prevent any pending async tasks from acting as if proctoring is still active.
    isProctoringRef.current = false;
    setIsProctoring(false);
  };

  const setupFrameStreaming = () => {
    if (!videoRef.current || !mediaStream.current) {
      console.warn('Video element or media stream not available for frame streaming.');
      return;
    }

    const videoTrack = mediaStream.current.getVideoTracks()[0];
    const audioTrack = mediaStream.current.getAudioTracks()[0];

    if (!videoTrack) {
      console.error('No video track found in media stream.');
      return;
    }
    if (!audioTrack) {
      console.error('No audio track found in media stream.');
      return;
    }

    // Create a hidden canvas if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const context = canvasElement.getContext('2d');

    if (!context) {
      console.error('Could not get 2D context from canvas.');
      return;
    }

    // Audio context and processor for capturing audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(mediaStream.current);
    const processor = audioContext.createScriptProcessor(4096, 1, 1); // Buffer size, input channels, output channels
    audioProcessorRef.current = processor;

    // Buffer audio chunks; send at a fixed interval to avoid ERR_INSUFFICIENT_RESOURCES
    processor.onaudioprocess = (event) => {
      if (!proctoringSession.current) return;

      const audioData = event.inputBuffer.getChannelData(0);
      const int16Array = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        int16Array[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF; // Convert to 16-bit PCM
      }
      audioBufferRef.current.push(...Array.from(new Uint8Array(int16Array.buffer)));
    };

    const flushAudioBuffer = () => {
      if (!proctoringSession.current || audioBufferRef.current.length === 0) return;
      const chunk = audioBufferRef.current.splice(0, audioBufferRef.current.length);
      // Chunk to avoid "too many function arguments" with String.fromCharCode.apply
      const CHUNK = 8192;
      let binary = '';
      for (let i = 0; i < chunk.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, chunk.slice(i, i + CHUNK) as unknown as number[]);
      }
      const base64Audio = btoa(binary);
      if (!base64Audio) return;

      fetch('/api/proctoring-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          parts: [{
            inlineData: {
              data: base64Audio,
              mimeType: 'audio/x-raw',
            }
          }]
        }),
      })
        .then(async (response) => {
          const contentType = response.headers.get('content-type');
          const isJson = contentType && contentType.includes('application/json');
          if (!isJson) {
            const text = await response.text();
            if (!response.ok) {
              console.warn('Audio request failed:', response.status, text.slice(0, 100));
            }
            return null;
          }
          return response.json();
        })
        .then((data) => {
          if (data?.error) console.error('Backend audio error:', data.error);
        })
        .catch((error) => console.error('Error sending audio to backend:', error));
    };

    audioSendIntervalId.current = window.setInterval(flushAudioBuffer, AUDIO_SEND_INTERVAL_MS);

    source.connect(processor);
    processor.connect(audioContext.destination);

    const captureFrame = () => {
      if (!isProctoringRef.current) { // Use the ref here
        return;
      }
      if (!videoElement.videoWidth || !videoElement.videoHeight) {
        return;
      }

      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

      canvasElement.toBlob(async (blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];

            if (proctoringSession.current) {
              try {
                // Send video frame part to backend
                const response = await fetch('/api/proctoring-chat', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    type: 'message',
                    parts: [{
                      inlineData: {
                        data: base64Data,
                        mimeType: 'image/jpeg'
                      }
                    }]
                  }),
                });

                if (!response.ok) {
                  throw new Error(`Backend error: ${response.statusText}`);
                }
                const responseData = await response.json();
                const text = responseData.text;

                if (text) {
                  const jsonText = text.replace(/```json\n|```/g, '').trim();
                  const analysis = JSON.parse(jsonText);
                  setIsDistracted(analysis.isDistracted);
                  // Only speak feedback if proctoring is active AND the user is distracted.
                  // Textual feedback is still added to history regardless.
                  if (analysis.feedback && isProctoringRef.current) {
                    speakFeedback(analysis.feedback, analysis.isDistracted);
                  }
                }
              } catch (error) {
                console.error('Error sending media to backend or processing response:', error);
              }
            }
          };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', JPEG_QUALITY);
    };

    frameIntervalId.current = window.setInterval(captureFrame, 1000 / FRAME_RATE);
  };

  useEffect(() => {
    if (isProctoring && videoRef.current && mediaStream.current) {
      setupFrameStreaming();
    }
  }, [isProctoring, videoRef.current, mediaStream.current]);

  useEffect(() => {
    return () => {
      stopProctoring();
    };
  }, []);

  return { isProctoring, error, isDistracted, startProctoring, stopProctoring, mediaStream: mediaStream.current, videoRef, feedbackHistory };
};
