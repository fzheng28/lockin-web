
import React, { useEffect } from 'react';
import { Camera, X, Play, Square, BrainCircuit, AlertTriangle } from 'lucide-react';
import { useProctoring } from '../hooks/useProctoring';

interface LiveSessionProps {
  onExit: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ onExit }) => {
  const { isProctoring, error, isDistracted, startProctoring, stopProctoring, mediaStream, feedbackHistory, videoRef } = useProctoring();

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleToggle = () => {
    if (isProctoring) {
      stopProctoring();
    } else {
      startProctoring();
    }
  };

  const getStatusMessage = () => {
    if (error) return error;
    if (isProctoring) {
      if (isDistracted) return "Distraction detected! Get back to work, you slacker!";
      return "AI Focus Coach is watching. Stay focused!";
    }
    return "Ready to lock in?";
  }

  return (
    <div className="min-h-screen bg-atmosphere flex flex-col p-6 md:p-10 items-center justify-center relative overflow-hidden">
      <div className="w-full max-w-6xl flex flex-col h-full glass-card rounded-3xl p-6 md:p-10 relative">
        <button onClick={onExit} className="absolute top-6 right-6 text-[#516273] hover:text-[#0f1f2e] transition-colors">
          <X className="w-7 h-7" />
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#1fa2a6] rounded-2xl text-white shadow-[0_12px_30px_rgba(31,162,166,0.4)]">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0f1f2e]">Live Focus Session</h2>
              <p className="text-[#516273] font-medium">Real-time coaching and status signals.</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-xs font-semibold tracking-[0.3em] uppercase ${isProctoring ? 'bg-[#1fa2a6]/20 text-[#0f1f2e]' : 'bg-[#516273]/15 text-[#516273]'}`}>
            {isProctoring ? 'Session active' : 'Session idle'}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className={`relative aspect-video bg-black/10 rounded-2xl overflow-hidden border-2 ${isDistracted ? 'border-[#ffb347]' : 'border-transparent'}`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            {!isProctoring && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <Camera className="w-16 h-16 text-[#516273]/40" />
              </div>
            )}
            {isProctoring && !error && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#1fa2a6] text-white px-3 py-1 rounded-full text-xs font-bold">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                AI COACH ACTIVE
              </div>
            )}
            {isDistracted && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#ffb347] text-[#1b1204] px-3 py-1 rounded-full text-sm font-bold">
                <AlertTriangle className="w-5 h-5" />
                DISTRACTED
              </div>
            )}
          </div>

          <div className="flex flex-col h-full justify-between gap-6">
            <div className={`glass-card rounded-3xl p-6 border ${isDistracted ? 'border-[#ffb347]' : 'border-transparent'} flex flex-col h-full`}>
              <h3 className="text-[#0f1f2e] text-xl font-bold mb-3">Coach Feedback</h3>
              <div className="flex-1 overflow-y-auto pr-2">
                {feedbackHistory.length > 0 ? (
                  <>
                    <p className={`text-lg leading-relaxed italic mb-4 ${isDistracted ? 'text-[#9a5a1a]' : 'text-[#0f1f2e]'}`}>
                      "{feedbackHistory[feedbackHistory.length - 1]}"
                    </p>
                    {feedbackHistory.length > 1 && (
                      <div className="text-sm text-[#516273] space-y-1">
                        <p className="font-semibold mt-2">Previous Feedback:</p>
                        {feedbackHistory.slice(0, -1).reverse().map((feedback, index) => (
                          <p key={index} className="opacity-75">"- {feedback}"</p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className={`text-lg leading-relaxed italic ${isDistracted ? 'text-[#9a5a1a]' : 'text-[#0f1f2e]'}`}>
                    "{getStatusMessage()}"
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleToggle}
              className="w-full py-5 rounded-2xl text-xl font-semibold flex items-center justify-center gap-4 btn-secondary"
            >
              {isProctoring ? (
                <><Square className="w-7 h-7 fill-current" /> Stop Session</>
              ) : (
                <><Play className="w-7 h-7 fill-current" /> Start Deep Work</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;
