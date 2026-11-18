import { InterpolateDiscrete, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';

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

// Each channel holds its own most recent key. Before the first key it holds
// that first value; channels without any keys stay in their original pose.
export function sampleSteppedPose(track, time, restPose) {
  const pose = {};
  for (const channel of CHANNELS) {
    let previous;
    let first;
    for (const key of track ?? []) {
      if (!validValue(key, channel)) continue;
      if (!first || key.time <= first.time) first = key;
      if (key.time <= time && (!previous || key.time >= previous.time)) previous = key;
    }
    pose[channel.binding] = { ...((previous ?? first)?.[channel.property] ?? restPose[channel.binding]) };
  }
  return pose;
}

// Keep clip authoring times as doubles (FBX stores integer ticks, unlike Three
// and GLB's Float32 times). Pad the ends to preserve duration and the last hold.
export function getClipChannels(track, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return CHANNELS.flatMap(channel => {
    const keysByTime = new Map();
    for (const key of track ?? []) {
      if (validValue(key, channel)) keysByTime.set(key.time, key[channel.property]);
    }
    if (!keysByTime.size) return [];

    const times = [...keysByTime.keys()].sort((a, b) => a - b);
    const keys = times.filter(time => time <= duration).map(time => ({ time, value: keysByTime.get(time) }));
    if (!keys.length || keys[0].time > 0) keys.unshift({ time: 0, value: keysByTime.get(times[0]) });
    const lastKey = keys[keys.length - 1];
    if (lastKey.time < duration) keys.push({ time: duration, value: lastKey.value });
    return [{ ...channel, keys }];
  });
}

export function createThreeAnimationTracks(keyFrames, sceneManager, duration) {
  const tracks = [];
  for (const [boneName, track] of Object.entries(keyFrames)) {
    const bone = sceneManager.getBoneByName(boneName);
    if (!bone) continue;
    for (const { Track, binding, components, keys } of getClipChannels(track, duration)) {
      // UUIDs avoid Three's property-binding syntax restrictions on node names.
      tracks.push(new Track(
        `${bone.uuid}.${binding}`,
        keys.map(({ time }) => time),
        keys.flatMap(({ value }) => components.map(axis => value[axis])),
        InterpolateDiscrete,
      ));
    }
  }
  return tracks;
}
