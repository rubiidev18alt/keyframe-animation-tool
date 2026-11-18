import { InterpolateDiscrete, InterpolateLinear, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';

export const FRAME_RATE = 30;
const AXES = ['x', 'y', 'z'];
const CHANNELS = [
  { property: 'position', binding: 'position', components: AXES, Track: VectorKeyframeTrack },
  { property: 'rotation', binding: 'quaternion', components: [...AXES, 'w'], Track: QuaternionKeyframeTrack },
];

function validValue(key, { property, components }) {
  const value = key?.[property];
  return Number.isFinite(key?.time) && key.time >= 0 && value &&
    components.every(axis => Number.isFinite(value[axis])) &&
    (property !== 'rotation' || Math.hypot(value.x, value.y, value.z, value.w) > 0);
}

function sampleChannel(channel, left, right, time, interpolation, fallback) {
  if (!left || !right || time <= left.time || interpolation !== 'smooth') {
    return left?.value ?? right?.value ?? fallback;
  }
  const amount = (time - left.time) / (right.time - left.time);
  const a = left.value;
  const b = right.value;
  if (channel.binding === 'quaternion') {
    const q = new Quaternion(a.x, a.y, a.z, a.w).slerp(new Quaternion(b.x, b.y, b.z, b.w), amount);
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  }
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount, z: a.z + (b.z - a.z) * amount };
}

// Translate and rotate independently: hold the endpoints, and keep the bind
// pose for channels with no keys. Same-time keys always use the exact pose.
export function samplePoseAtTime(track, time, restPose, interpolation = 'step') {
  const pose = {};
  for (const channel of CHANNELS) {
    let left;
    let right;
    for (const key of track ?? []) {
      if (!validValue(key, channel)) continue;
      if (key.time <= time) {
        if (!left || key.time >= left.time) left = key;
      } else if (!right || key.time <= right.time) {
        right = key;
      }
    }
    const asSample = key => key && { time: key.time, value: key[channel.property] };
    pose[channel.binding] = { ...sampleChannel(channel, asSample(left), asSample(right), time, interpolation, restPose[channel.binding]) };
  }
  return pose;
}

// Keep authoring times as doubles for FBX. Pad the endpoints so playback and
// exports agree with scrubbing even when the user crops through a transition.
export function getClipChannels(track, duration, interpolation = 'step') {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return CHANNELS.flatMap(channel => {
    const keysByTime = new Map();
    for (const key of track ?? []) {
      if (validValue(key, channel)) keysByTime.set(key.time, key[channel.property]);
    }
    if (!keysByTime.size) return [];

    const sorted = [...keysByTime].sort(([a], [b]) => a - b).map(([time, value]) => ({ time, value }));
    const keys = sorted.filter(key => key.time <= duration);
    const lastKey = keys.at(-1);
    const nextKey = sorted[keys.length];
    if (!keys.length || keys[0].time > 0) keys.unshift({ time: 0, value: sorted[0].value });
    if (!lastKey || lastKey.time < duration) {
      keys.push({ time: duration, value: sampleChannel(channel, lastKey, nextKey, duration, interpolation) });
    }
    return [{ ...channel, keys }];
  });
}

export function createThreeAnimationTracks(keyFrames, sceneManager, duration, interpolation = 'step') {
  const tracks = [];
  const mode = interpolation === 'smooth' ? InterpolateLinear : InterpolateDiscrete;
  for (const [boneName, track] of Object.entries(keyFrames)) {
    const bone = sceneManager.getBoneByName(boneName);
    if (!bone) continue;
    for (const { Track, binding, components, keys } of getClipChannels(track, duration, interpolation)) {
      // UUIDs avoid Three's property-binding syntax restrictions on node names.
      tracks.push(new Track(
        `${bone.uuid}.${binding}`,
        keys.map(({ time }) => time),
        keys.flatMap(({ value }) => components.map(axis => value[axis])),
        mode,
      ));
    }
  }
  return tracks;
}

export function findNeighborKeyframes(track, time, duration) {
  let previous = null;
  let next = null;
  for (const key of track ?? []) {
    const at = key?.time;
    if (!Number.isFinite(at) || at < 0 || at > duration) continue;
    if (at < time - 1e-7 && (previous === null || at > previous)) previous = at;
    if (at > time + 1e-7 && (next === null || at < next)) next = at;
  }
  return { previous, next };
}
