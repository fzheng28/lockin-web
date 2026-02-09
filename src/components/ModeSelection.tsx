
import React from 'react';
import { Video, AppWindow } from 'lucide-react';

interface ModeSelectionProps {
  onSelectLive: () => void;
  onSelectTab: () => void;
}

const ModeSelection: React.FC<ModeSelectionProps> = ({ onSelectLive, onSelectTab }) => {
  return (
    <div className="relative w-full min-h-screen bg-atmosphere overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-14 py-16 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-[#516273] font-semibold">
              Choose a mode
            </p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0f1f2e]">
              Pick the focus engine that fits your day.
            </h2>
          </div>
          <p className="text-base md:text-lg text-[#516273] max-w-lg">
            Live Mode uses camera and mic to coach your attention. Tab Mode keeps your browser honest with a lightweight extension.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-card rounded-3xl p-8 md:p-10 border-l-4 border-[#1fa2a6]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#1fa2a6] text-white flex items-center justify-center">
                <Video className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#516273] font-semibold">
                  Live Mode
                </p>
                <h3 className="text-2xl font-bold text-[#0f1f2e]">AI Focus Coach</h3>
              </div>
            </div>
            <p className="text-[#516273] text-lg leading-relaxed mb-10">
              Read your attention signals in real time and get quick, playful nudges when your focus slips.
            </p>
            <button
              onClick={onSelectLive}
              className="btn-secondary w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-300 hover:translate-y-[-2px] active:scale-[0.98]"
            >
              Enter Live Mode
            </button>
          </div>

          <div className="glass-card rounded-3xl p-8 md:p-10 border-l-4 border-[#ff7a1a]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#ff7a1a] text-white flex items-center justify-center">
                <AppWindow className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#516273] font-semibold">
                  Tab Mode
                </p>
                <h3 className="text-2xl font-bold text-[#0f1f2e]">Browser Discipline</h3>
              </div>
            </div>
            <p className="text-[#516273] text-lg leading-relaxed mb-10">
              Track tab activity, flag distractions, and stay locked in with a lightweight Chrome extension.
            </p>
            <button
              onClick={onSelectTab}
              className="btn-primary w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-300 hover:translate-y-[-2px] active:scale-[0.98]"
            >
              Enter Tab Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;
