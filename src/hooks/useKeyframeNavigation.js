import { useCallback, useMemo } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { findNeighborKeyframes } from '../utils/animationTracks';

export function useKeyframeNavigation() {
  const { selectedBoneName, keyFrames, currentTime, animationDuration, seekToTime,
    isPlaying, isSceneReady, isLoadingModel, isGizmoDraggingRef } = useAnimation();
  const track = selectedBoneName && Object.hasOwn(keyFrames, selectedBoneName) ? keyFrames[selectedBoneName] : null;
  const { previous, next } = useMemo(
    () => findNeighborKeyframes(track, currentTime, animationDuration),
    [track, currentTime, animationDuration],
  );
  const canJump = isSceneReady && !isPlaying && !isLoadingModel;
  const jumpToKeyframe = useCallback(direction => {
    const time = direction < 0 ? previous : next;
    if (canJump && !isGizmoDraggingRef.current && time !== null) seekToTime(time);
  }, [previous, next, canJump, isGizmoDraggingRef, seekToTime]);

  return { canJumpBack: canJump && previous !== null, canJumpForward: canJump && next !== null, jumpToKeyframe };
}
