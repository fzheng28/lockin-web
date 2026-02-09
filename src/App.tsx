
import React, { useState, useCallback } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import ModeSelection from './components/ModeSelection';
import LiveSession from './components/LiveSession';
import TabSession from './components/TabSession';

const AppState = {
  WELCOME: 0,
  SELECTION: 1,
  LIVE_SESSION: 2,
  TAB_SESSION: 3
}

type AppStateEnum = (typeof AppState)[keyof typeof AppState];


const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStateEnum>(AppState.WELCOME);

  const goToSelection = useCallback(() => setCurrentStep(AppState.SELECTION), []);
  const goToWelcome = useCallback(() => setCurrentStep(AppState.WELCOME), []);
  const enterLiveMode = useCallback(() => setCurrentStep(AppState.LIVE_SESSION), []);
  const enterTabMode = useCallback(() => setCurrentStep(AppState.TAB_SESSION), []);

  return (
    <div className="min-h-screen w-full">
      {currentStep === AppState.WELCOME && (
        <WelcomeScreen onNext={goToSelection} />
      )}
      {currentStep === AppState.SELECTION && (
        <ModeSelection onSelectLive={enterLiveMode} onSelectTab={enterTabMode} />
      )}
      {currentStep === AppState.LIVE_SESSION && (
        <LiveSession onExit={goToWelcome} />
      )}
      {currentStep === AppState.TAB_SESSION && (
        <TabSession onExit={goToWelcome} />
      )}
    </div>
  );
};

export default App;
