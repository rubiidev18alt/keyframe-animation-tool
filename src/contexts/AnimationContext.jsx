import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AnimationContext = createContext();

export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within AnimationProvider');
  }
  return context;
};

export const AnimationProvider = ({ children }) => {
  // Model & Scene state
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [bones, setBones] = useState([]);
  const [selectedBoneName, setSelectedBoneName] = useState(null);
  
  // Transform state
  const [boneRotationUI, setBoneRotationUI] = useState({ x: 0, y: 0, z: 0 });
  const [bonePositionUI, setBonePositionUI] = useState({ x: 0, y: 0, z: 0 });
  const [livePose, setLivePose] = useState({});
  
  // Animation state
  const [animationName, setAnimationName] = useState('MyAnimation');
  const [animationDuration, setAnimationDuration] = useState(5);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [keyFrames, setKeyFrames] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [interpolation, setInterpolation] = useState('step');
  
  // Refs
  const isGizmoDraggingRef = useRef(false);
  const sceneManagerRef = useRef(null);

  const seekToTime = useCallback(time => {
    if (!Number.isFinite(time)) return;
    setCurrentTime(Math.min(animationDuration, Math.max(0, time)));
    // Clicking the current marker again snaps back from any unkeyed edits.
    setSeekVersion(version => version + 1);
  }, [animationDuration]);

  const replaceTimeline = useCallback(clip => {
    setAnimationName(clip.animationName || 'MyAnimation');
    setAnimationDuration(clip.animationDuration);
    setKeyFrames(clip.keyFrames);
    setCurrentTime(0);
    if (clip.interpolation) setInterpolation(clip.interpolation);
  }, []);

  // Reset function for new model
  const resetAllStateForNewModel = useCallback(() => {
    setBones([]);
    setSelectedBoneName(null);
    setBoneRotationUI({ x: 0, y: 0, z: 0 });
    setBonePositionUI({ x: 0, y: 0, z: 0 });
    setLivePose({});
    replaceTimeline({ animationDuration: 5, keyFrames: {} });
    setIsPlaying(false);
  }, [replaceTimeline]);


  const value = {
    // Model & Scene
    isLoadingModel,
    setIsLoadingModel,
    isSceneReady,
    setIsSceneReady,
    bones,
    setBones,
    selectedBoneName,
    setSelectedBoneName,
    
    // Transform
    boneRotationUI,
    setBoneRotationUI,
    bonePositionUI,
    setBonePositionUI,
    livePose,
    setLivePose,
    
    // Animation
    animationName,
    setAnimationName,
    animationDuration,
    setAnimationDuration,
    currentTime,
    setCurrentTime,
    seekToTime,
    seekVersion,
    keyFrames,
    setKeyFrames,
    isPlaying,
    setIsPlaying,
    interpolation,
    setInterpolation,
    replaceTimeline,
    
    // Refs
    isGizmoDraggingRef,
    sceneManagerRef,
    
    // Functions
    resetAllStateForNewModel,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
};
