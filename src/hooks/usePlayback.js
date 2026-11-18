import { useAnimation } from '../contexts/AnimationContext';

export function usePlayback() {
  const {
    isPlaying, setIsPlaying, isSceneReady, isLoadingModel, keyFrames, animationDuration,
    currentTime, setCurrentTime, seekToTime, sceneManagerRef, isGizmoDraggingRef, interpolation, setInterpolation,
  } = useAnimation();

  const hasKeys = Object.values(keyFrames).some(track => track?.length);
  const canPlay = isSceneReady && !isLoadingModel && hasKeys;

  function togglePlayback() {
    if (!canPlay || isGizmoDraggingRef.current) return;
    const manager = sceneManagerRef.current;
    if (isPlaying) {
      const time = manager?.getPlaybackTime();
      manager?.stopAnimation();
      if (time !== undefined) setCurrentTime(Number(time.toFixed(4)));
      setIsPlaying(false);
    } else if (manager?.playAnimationFromData(keyFrames, animationDuration, currentTime, interpolation)) {
      setIsPlaying(true);
    }
  }

  function stopPlayback() {
    if (!isPlaying) return;
    sceneManagerRef.current?.stopAnimation();
    setIsPlaying(false);
    seekToTime(0);
  }

  function changeInterpolation(mode) {
    if (mode === interpolation || isLoadingModel || isGizmoDraggingRef.current) return;
    if (isPlaying) {
      const manager = sceneManagerRef.current;
      const time = manager?.getPlaybackTime() ?? currentTime;
      // Interpolants are attached to the action at creation; rebuild it without
      // rewinding so the toggle takes effect even while the clip is playing.
      if (!manager?.playAnimationFromData(keyFrames, animationDuration, time, mode)) return;
    }
    setInterpolation(mode);
  }

  return { canPlay, togglePlayback, stopPlayback, changeInterpolation };
}
