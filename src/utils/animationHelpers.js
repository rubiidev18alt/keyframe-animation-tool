import * as THREE from 'three';

export const generateAnimationJson = (animationName, animationDuration, keyFrames, interpolation = 'step') => {
  const animationClipData = {
    name: animationName,
    duration: animationDuration,
    interpolation: interpolation === 'smooth' ? 'smooth' : 'step',
    tracks: [],
  };
  
  for (const boneName in keyFrames) {
    const trackData = keyFrames[boneName];
    if (trackData && trackData.length > 0) {
      const rotTimes = [], rotValues = [], posTimes = [], posValues = [];
      
      trackData.forEach(kf => {
        if (kf.rotation && 
            typeof kf.rotation.x === 'number' && typeof kf.rotation.y === 'number' && 
            typeof kf.rotation.z === 'number' && typeof kf.rotation.w === 'number') { 
          rotTimes.push(kf.time); 
          rotValues.push(kf.rotation.x, kf.rotation.y, kf.rotation.z, kf.rotation.w); 
        }
        if (kf.position &&
            typeof kf.position.x === 'number' &&
            typeof kf.position.y === 'number' &&
            typeof kf.position.z === 'number') { 
          posTimes.push(kf.time); 
          posValues.push(kf.position.x, kf.position.y, kf.position.z); 
        }
      });
      
      if (rotValues.length > 0) {
        animationClipData.tracks.push({ 
          name: `${boneName}.quaternion`, 
          type: 'quaternion', 
          times: rotTimes, 
          values: rotValues 
        });
      }
      if (posValues.length > 0) {
        animationClipData.tracks.push({ 
          name: `${boneName}.position`, 
          type: 'vector', 
          times: posTimes, 
          values: posValues 
        });
      }
    }
  }
  
  return JSON.stringify(animationClipData, null, 2);
};

export const eulerToQuaternion = (eulerDegrees) => {
  const eulerXRad = (typeof eulerDegrees.x === 'number' && !isNaN(eulerDegrees.x) ? eulerDegrees.x : 0) * Math.PI / 180;
  const eulerYRad = (typeof eulerDegrees.y === 'number' && !isNaN(eulerDegrees.y) ? eulerDegrees.y : 0) * Math.PI / 180;
  const eulerZRad = (typeof eulerDegrees.z === 'number' && !isNaN(eulerDegrees.z) ? eulerDegrees.z : 0) * Math.PI / 180;
  
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(eulerXRad, eulerYRad, eulerZRad, 'XYZ')
  );
  
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  };
};

export const validatePosition = (position) => {
  return {
    x: typeof position?.x === 'number' && !isNaN(position.x) ? position.x : 0,
    y: typeof position?.y === 'number' && !isNaN(position.y) ? position.y : 0,
    z: typeof position?.z === 'number' && !isNaN(position.z) ? position.z : 0,
  };
};

export const findKeyframeAtTime = (keyframes, time, tolerance = 0.0001) => {
  if (!keyframes || !Array.isArray(keyframes)) return null;
  return keyframes.find(kf => Math.abs(kf.time - time) < tolerance);
};

export const insertOrUpdateKeyframe = (track, newKeyframe, tolerance = 0.0001) => {
  const newTrack = track ? [...track] : [];
  const existingIndex = newTrack.findIndex(kf => Math.abs(kf.time - newKeyframe.time) < tolerance);
  
  if (existingIndex > -1) {
    newTrack[existingIndex] = { ...newTrack[existingIndex], ...newKeyframe };
  } else {
    newTrack.push(newKeyframe);
  }
  
  newTrack.sort((a, b) => a.time - b.time);
  return newTrack;
};

export const removeKeyframeAtTime = (track, time, tolerance = 0.0001) => {
  if (!track) return [];
  return track.filter(kf => Math.abs(kf.time - time) > tolerance);
};

export const validateImportedJson = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error("Invalid JSON: Not an object");
  }
  
  if (typeof data.name !== 'string') {
    throw new Error("Invalid JSON: Missing or invalid 'name' field");
  }
  
  if (!Number.isFinite(data.duration) || data.duration <= 0) {
    throw new Error("Invalid JSON: Missing or invalid 'duration' field");
  }
  
  if (data.interpolation !== undefined && !['step', 'smooth'].includes(data.interpolation)) {
    throw new Error("Invalid JSON: 'interpolation' must be 'step' or 'smooth'");
  }
  if (!Array.isArray(data.tracks)) {
    throw new Error("Invalid JSON: Missing or invalid 'tracks' array");
  }
  
  return true;
};

// Keep sparse translation and rotation channels independent. Filling in the
// rest pose on an unrelated key would make a keyed channel jump back to rest.
const TRACK_TARGET = /^(.+)\.(position|quaternion)$/;
export function parseImportedTracks(tracks, bones) {
  const boneNames = new Set(bones.map(bone => bone.name));
  const tracksByBone = new Map();
  const skippedBones = new Set();
  for (const track of tracks) {
    const match = typeof track?.name === 'string' && track.name.match(TRACK_TARGET);
    if (!match) continue;
    const [, boneName, property] = match;
    if (!boneNames.has(boneName)) {
      skippedBones.add(boneName);
      continue;
    }

    const { times, values } = track;
    const components = property === 'quaternion' ? 4 : 3;
    // A glTF cubic key is stored as [in-tangent, value, out-tangent]. The
    // editor uses the authored values with its global pose interpolation.
    const cubic = track.createInterpolant?.isInterpolantFactoryMethodGLTFCubicSpline;
    const stride = cubic ? components * 3 : components;
    const isArray = value => Array.isArray(value) || ArrayBuffer.isView(value);
    if (!isArray(times) || !isArray(values) || values.length !== times.length * stride) continue;

    for (let i = 0; i < times.length; i++) {
      if (!Number.isFinite(times[i]) || times[i] < 0) continue;
      const time = Number(times[i].toFixed(4));
      const offset = i * stride + (cubic ? components : 0);
      const x = values[offset];
      const y = values[offset + 1];
      const z = values[offset + 2];
      const w = values[offset + 3];
      if (![x, y, z].every(Number.isFinite)) continue;
      if (components === 4 && (!Number.isFinite(w) || !Math.hypot(x, y, z, w))) continue;

      if (!tracksByBone.has(boneName)) tracksByBone.set(boneName, new Map());
      const trackAtTime = tracksByBone.get(boneName);
      const key = trackAtTime.get(time) ?? { time };
      if (property === 'position') key.position = { x, y, z };
      else {
        const q = new THREE.Quaternion(x, y, z, w).normalize();
        key.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
      }
      trackAtTime.set(time, key);
    }
  }

  return {
    keyFrames: Object.fromEntries([...tracksByBone].map(([name, keys]) => [name, [...keys.values()].sort((a, b) => a.time - b.time)])),
    skippedBones: [...skippedBones],
  };
}

export function parseAnimationClipToKATKeyframes(clip, bones, inferInterpolation = false) {
  const imported = parseImportedTracks(clip.tracks, bones);
  const duration = clip.duration;
  const result = {
    animationName: clip.name,
    animationDuration: Number.isFinite(duration) && duration > 0 ? Number(duration.toFixed(4)) || duration : 5,
    ...imported,
  };
  if (inferInterpolation) {
    const hasSmoothTracks = clip.tracks.some(track => {
      const target = track.name.match(TRACK_TARGET)?.[1];
      return target && Object.hasOwn(imported.keyFrames, target) && track.getInterpolation() !== THREE.InterpolateDiscrete;
    });
    result.interpolation = hasSmoothTracks ? 'smooth' : 'step';
  }
  return result;
}

export function findCompatibleClip(animations, bones, inferInterpolation = false) {
  for (const clip of animations ?? []) {
    const imported = parseAnimationClipToKATKeyframes(clip, bones, inferInterpolation);
    if (Object.keys(imported.keyFrames).length) return imported;
  }
  return null;
}

export const getQuaternionAngleDifference = (q1, q2) => {
  const tq1 = new THREE.Quaternion(
    (typeof q1?.x === 'number' && !isNaN(q1.x)) ? q1.x : 0,
    (typeof q1?.y === 'number' && !isNaN(q1.y)) ? q1.y : 0,
    (typeof q1?.z === 'number' && !isNaN(q1.z)) ? q1.z : 0,
    (typeof q1?.w === 'number' && !isNaN(q1.w)) ? q1.w : 1
  );
  const tq2 = new THREE.Quaternion(
    (typeof q2?.x === 'number' && !isNaN(q2.x)) ? q2.x : 0,
    (typeof q2?.y === 'number' && !isNaN(q2.y)) ? q2.y : 0,
    (typeof q2?.z === 'number' && !isNaN(q2.z)) ? q2.z : 0,
    (typeof q2?.w === 'number' && !isNaN(q2.w)) ? q2.w : 1
  );
  return tq1.angleTo(tq2);
};