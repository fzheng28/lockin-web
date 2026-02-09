
import React from 'react';

interface WelcomeScreenProps {
  onNext: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-atmosphere">
      <div className="absolute inset-0 grid-overlay pointer-events-none"></div>
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#ffd6a3]/70 blur-3xl animate-glow"></div>
      <div className="absolute bottom-[-120px] right-[-80px] w-96 h-96 rounded-full bg-[#9ee7ea]/60 blur-3xl animate-glow"></div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6 md:px-16">
          <div className="max-w-4xl text-center md:text-left animate-float-in">
            <h2 className="text-sm md:text-base uppercase tracking-[0.4em] text-[#516273] font-semibold mb-6">
              Attention is all you need
            </h2>
            <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-8">
              Are you ready to <span className="text-gradient-lock">lock in?</span>
            </h1>
            <p className="text-lg md:text-xl text-[#516273] font-medium leading-relaxed mb-10">
              Live focus coaching + tab discipline, wrapped in a calm studio vibe.
            </p>
            <div className="flex justify-center md:justify-start">
              <button
                onClick={onNext}
                className="btn-primary px-10 py-4 rounded-full text-lg font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                I am ready
              </button>
            </div>
          </div>
        </div>

        <div className="pb-10 text-center text-xs uppercase tracking-[0.35em] text-[#516273] font-semibold opacity-70">
          Designed for high-focus flow
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
