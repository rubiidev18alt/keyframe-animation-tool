import { useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { Euler, Quaternion, MathUtils } from 'three';
import { useAnimation } from '../contexts/AnimationContext';
import SceneManager from '../core/SceneManager';

export function useSceneManager(viewportRef) {
  const [sceneError, setSceneError] = useState('');
  const [viewportUnavailable, setViewportUnavailable] = useState(false);
  const {
    sceneManagerRef, isGizmoDraggingRef, setCurrentTime, setLivePose, isSceneReady,
    selectedBoneName, isPlaying, bones, keyFrames, currentTime, seekVersion, livePose,
    setBoneRotationUI, setBonePositionUI, resetAllStateForNewModel, setIsLoadingModel,
    setIsSceneReady, setBones, setSelectedBoneName,
  } = useAnimation();

  useEffect(() => {
    let manager;
    try {
      manager = new SceneManager(viewportRef.current);
    } catch (error) {
      console.error('Could not start the 3D viewport:', error);
      setViewportUnavailable(true);
      setSceneError('This browser could not start WebGL. Check that hardware acceleration is enabled.');
      return;
    }
    sceneManagerRef.current = manager;
    manager.setOnBoneTransformChangeByGizmo((boneName, position, quaternion) => {
      const { x, y, z } = position;
      const { x: qx, y: qy, z: qz, w } = quaternion;
      const transform = { position: { x, y, z }, quaternion: { x: qx, y: qy, z: qz, w } };
      setLivePose(pose => ({ ...pose, [boneName]: transform }));
    });
    manager.setOnGizmoDraggingChangedCallback(dragging => { isGizmoDraggingRef.current = dragging; });
    manager.setOnBoneClickCallback(setSelectedBoneName);
    manager.setOnTimeUpdate(time => setCurrentTime(Number(time.toFixed(4))));

    return () => {
      manager.cleanup();
      sceneManagerRef.current = null;
      isGizmoDraggingRef.current = false;
    };
  }, [viewportRef, sceneManagerRef, isGizmoDraggingRef, setCurrentTime, setLivePose, setSelectedBoneName]);

  const handleLoadModel = useCallback(async (file) => {
    const manager = sceneManagerRef.current;
    if (!manager || !file) return;
    setIsLoadingModel(true);
    setIsSceneReady(false);
    setSceneError('');
    resetAllStateForNewModel();
    try {
      const initialPose = await manager.loadModel(file);
      if (sceneManagerRef.current !== manager) return;
      const bones = manager.getBones();
      setBones(bones);
      setLivePose(initialPose);
      setSelectedBoneName(bones[0]?.name ?? null);
      setIsSceneReady(true);
    } catch (error) {
      if (sceneManagerRef.current !== manager) return;
      console.error('Failed to load the model:', error);
      setSceneError('Could not read this FBX. Check the file and try again.');
    } finally {
      if (sceneManagerRef.current === manager) setIsLoadingModel(false);
    }
  }, [sceneManagerRef, resetAllStateForNewModel, setBones, setIsLoadingModel, setIsSceneReady, setLivePose, setSelectedBoneName]);

  useEffect(() => {
    const manager = sceneManagerRef.current;
    if (!manager) return;
    manager.boneMarkersGroup.visible = !isPlaying && isSceneReady;
    if (isSceneReady && selectedBoneName && !isPlaying) manager.attachGizmo(selectedBoneName);
    else manager.detachGizmo();
  }, [selectedBoneName, isSceneReady, isPlaying, sceneManagerRef]);

  useLayoutEffect(() => {
    const manager = sceneManagerRef.current;
    if (!isSceneReady || isPlaying || isGizmoDraggingRef.current || !manager) return;
    setLivePose(Object.fromEntries(bones.map(({ name }) => [name, manager.getPoseAtTimeForBone(name, keyFrames, currentTime)])));
  }, [currentTime, seekVersion, keyFrames, isSceneReady, isPlaying, bones, sceneManagerRef, isGizmoDraggingRef, setLivePose]);

  useLayoutEffect(() => {
    if (!isSceneReady || isPlaying) return;
    if (!isGizmoDraggingRef.current) sceneManagerRef.current?.applyPoseFromData(livePose);
    const transform = Object.hasOwn(livePose, selectedBoneName) ? livePose[selectedBoneName] : null;
    if (!transform) return;
    const { position, quaternion: { x, y, z, w } } = transform;
    const rotation = new Euler().setFromQuaternion(new Quaternion(x, y, z, w), 'XYZ');
    setBonePositionUI(position);
    setBoneRotationUI({ x: MathUtils.radToDeg(rotation.x), y: MathUtils.radToDeg(rotation.y), z: MathUtils.radToDeg(rotation.z) });
  }, [livePose, isSceneReady, isPlaying, selectedBoneName, sceneManagerRef, isGizmoDraggingRef, setBonePositionUI, setBoneRotationUI]);

  return { handleLoadModel, sceneError, viewportUnavailable };
}
