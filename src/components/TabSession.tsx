
import React from 'react';
import { AppWindow, X, Download, ShieldCheck } from 'lucide-react';

interface TabSessionProps {
  onExit: () => void;
}

const TabSession: React.FC<TabSessionProps> = ({ onExit }) => {
  return (
    <div className="min-h-screen bg-atmosphere flex flex-col p-6 md:p-10 items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 grid-overlay pointer-events-none"></div>
      <div className="w-full max-w-6xl flex flex-col glass-card rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <button
          onClick={onExit}
          className="absolute top-6 right-6 text-[#516273] hover:text-[#0f1f2e] transition-transform"
          aria-label="Exit"
        >
          <X className="w-7 h-7" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-[#ff4d6d] rounded-2xl flex items-center justify-center text-white shadow-[0_18px_40px_rgba(255,77,109,0.35)]">
              <AppWindow className="w-10 h-10 md:w-12 md:h-12" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-[#516273] font-semibold mb-2">
                Tab Guard
              </p>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0f1f2e] mb-3 leading-tight">
                Keep your browser in the zone.
              </h2>
              <div className="flex items-center gap-2 text-[#ff4d6d] justify-center md:justify-start">
                <ShieldCheck className="w-5 h-5" />
                <p className="text-sm md:text-base font-semibold uppercase tracking-[0.25em]">Chrome Only</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-8">
            <div className="space-y-4">
              <p className="text-[#516273] text-lg md:text-xl font-medium leading-relaxed">
                Install the <span className="font-extrabold text-[#ff4d6d]">Lock In Chrome Extension</span> to monitor tabs and flag distraction patterns in real time.
              </p>
              <ul className="text-[#516273] text-sm space-y-2 font-medium">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff4d6d]" />
                  Real-time distraction alerts
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff4d6d]" />
                  Focus session tracking
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff4d6d]" />
                  Native Chrome integration
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <a
                href="/lock-in-extension.zip"
                download="lock-in-extension.zip"
                className="w-full py-4 md:py-5 rounded-2xl text-lg md:text-xl font-semibold bg-[#ff4d6d] text-white hover:bg-[#e24360] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4 shadow-[0_15px_35px_rgba(255,77,109,0.3)]"
              >
                <Download className="w-6 h-6 md:w-7 md:h-7" />
                Install on Chrome
              </a>

              <div className="text-center md:text-left">
                <p className="text-[#516273] font-semibold text-xs uppercase tracking-widest opacity-70">
                  Lightweight • Secure • Optimized for Chrome
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TabSession;
