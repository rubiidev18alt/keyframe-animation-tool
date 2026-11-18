import { useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { Euler, Quaternion, MathUtils } from 'three';
import { useAnimation } from '../contexts/AnimationContext';
import SceneManager from '../core/SceneManager';
import { findCompatibleClip } from '../utils/animationHelpers';
import { loadLocalAsset } from '../utils/loadAsset';
import { disposeModelResources } from '../utils/modelResources';

export function useSceneManager(viewportRef) {
  const [sceneError, setSceneError] = useState('');
  const [modelSource, setModelSource] = useState(null);
  const [viewportUnavailable, setViewportUnavailable] = useState(false);
  const {
    sceneManagerRef, isGizmoDraggingRef, setCurrentTime, setLivePose, isSceneReady,
    selectedBoneName, isPlaying, bones, keyFrames, currentTime, seekVersion, livePose, interpolation, isLoadingModel,
    setBoneRotationUI, setBonePositionUI, resetAllStateForNewModel, setIsLoadingModel,
    setIsSceneReady, setBones, setSelectedBoneName, replaceTimeline,
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

  const replaceModel = useCallback(async (name, readAsset) => {
    const manager = sceneManagerRef.current;
    if (!manager) return false;
    setIsLoadingModel(true);
    setSceneError('');
    try {
      const asset = await readAsset();
      if (sceneManagerRef.current !== manager) {
        disposeModelResources(asset.model);
        return false;
      }
      // Leave the existing rig and keys untouched if reading the new file fails.
      const initialPose = manager.setModel(asset.model);
      const nextBones = manager.getBones();
      const clip = asset.format !== 'fbx' && nextBones.length
        ? findCompatibleClip(asset.animations, nextBones, true)
        : null;
      resetAllStateForNewModel();
      setModelSource({ name, id: asset.model.uuid });
      setBones(nextBones);
      setLivePose(initialPose);
      setSelectedBoneName(asset.selectedBoneName ?? Object.keys(clip?.keyFrames ?? {})[0] ?? nextBones[0]?.name ?? null);
      if (clip) replaceTimeline(clip);
      setIsSceneReady(true);
      return true;
    } catch (error) {
      if (sceneManagerRef.current !== manager) return false;
      console.error('Failed to load the model:', error);
      setSceneError(`Could not load the model. ${error.message || 'Check the file and try again.'}`);
      return false;
    } finally {
      if (sceneManagerRef.current === manager) setIsLoadingModel(false);
    }
  }, [sceneManagerRef, resetAllStateForNewModel, setBones, setIsLoadingModel, setIsSceneReady, setLivePose, setSelectedBoneName, replaceTimeline]);

  const handleLoadModel = file => replaceModel(file.name, () => loadLocalAsset(file));
  const handleLoadDemo = () => replaceModel('Demo: Relay R-07', async () => {
    const { createDemoRig } = await import('../utils/demoRig');
    return createDemoRig();
  });

  useEffect(() => {
    const manager = sceneManagerRef.current;
    if (!manager) return;
    manager.boneMarkersGroup.visible = !isPlaying && !isLoadingModel && isSceneReady;
    if (isSceneReady && selectedBoneName && !isPlaying && !isLoadingModel) manager.attachGizmo(selectedBoneName);
    else manager.detachGizmo();
  }, [selectedBoneName, isSceneReady, isPlaying, isLoadingModel, sceneManagerRef]);

  useLayoutEffect(() => {
    const manager = sceneManagerRef.current;
    if (!isSceneReady || isPlaying || isGizmoDraggingRef.current || !manager) return;
    setLivePose(Object.fromEntries(bones.map(({ name }) => [name, manager.getPoseAtTimeForBone(name, keyFrames, currentTime, interpolation)])));
  }, [currentTime, seekVersion, keyFrames, isSceneReady, isPlaying, bones, interpolation, sceneManagerRef, isGizmoDraggingRef, setLivePose]);

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

  return { handleLoadModel, handleLoadDemo, modelSource, sceneError, viewportUnavailable };
}
