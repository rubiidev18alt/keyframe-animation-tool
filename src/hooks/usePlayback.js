import { useAnimation } from '../contexts/AnimationContext';

export function usePlayback() {
  const {
    isPlaying, setIsPlaying, isSceneReady, isLoadingModel, keyFrames, animationDuration,
    currentTime, seekToTime, sceneManagerRef, isGizmoDraggingRef,
  } = useAnimation();

  const hasKeys = Object.values(keyFrames).some(track => track?.length);
  const canPlay = isSceneReady && !isLoadingModel && hasKeys;

  function togglePlayback() {
    if (!canPlay || isGizmoDraggingRef.current) return;
    const manager = sceneManagerRef.current;
    if (isPlaying) {
      manager?.stopAnimation();
      setIsPlaying(false);
    } else if (manager?.playAnimationFromData(keyFrames, animationDuration, currentTime)) {
      setIsPlaying(true);
    }
  }

  function stopPlayback() {
    if (!isPlaying) return;
    sceneManagerRef.current?.stopAnimation();
    setIsPlaying(false);
    seekToTime(0);
  }

  return { canPlay, togglePlayback, stopPlayback };
}
