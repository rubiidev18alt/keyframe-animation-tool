import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip, AnimationMixer, Bone, Group, InterpolateDiscrete, Quaternion } from 'three';
import { createThreeAnimationTracks, getClipChannels, sampleSteppedPose } from '../src/utils/steppedAnimation.js';
import { generateAnimationJson, parseImportedTracks } from '../src/utils/animationHelpers.js';

const vector = (x, y, z) => ({ x, y, z });
const rest = { position: vector(0, 2, 0), quaternion: { x: 0, y: 0, z: 0, w: 1 } };
const first = { time: 0.1, position: vector(2, 5, 0) };
const rotation = { time: 0.5, rotation: { x: 0, y: 1, z: 0, w: 0 } };
const last = { time: 1, position: vector(8, 5, 3) };

test('scrubbing holds each channel independently and snaps on the exact key', () => {
  const track = [last, first, rotation]; // Scrubbing also works for unsorted keys.
  assert.deepEqual(sampleSteppedPose([], 0.7, rest), rest);
  assert.deepEqual(sampleSteppedPose(track, 0, rest).position, first.position);
  assert.deepEqual(sampleSteppedPose(track, 0.9999, rest), { position: first.position, quaternion: rotation.rotation });
  assert.deepEqual(sampleSteppedPose(track, 1, rest).position, last.position);
  assert.deepEqual(sampleSteppedPose(track, 10, rest).position, last.position);
});

test('clip channels preserve exact authoring times and pad the end without exporting keys beyond the duration', () => {
  const [{ keys }] = getClipChannels([first, { time: 0.4167, position: vector(3, 4, 8) }, last], 0.6);
  assert.deepEqual(keys.map(key => key.time), [0, 0.1, 0.4167, 0.6]);
  assert.deepEqual(keys.at(-1).value, vector(3, 4, 8));
  assert.equal(getClipChannels([first, { time: 0.5, position: vector(Infinity, 0, 0) }], 1)[0].keys.length, 3);
});

test('Three playback tracks use discrete interpolation and bind to the bone even with special characters', () => {
  const model = new Group();
  const bone = new Bone();
  bone.name = 'Arm Left:01';
  model.add(bone);
  const manager = { getBoneByName: name => model.getObjectByName(name) };
  const tracks = createThreeAnimationTracks({ [bone.name]: [first, last, rotation], Missing: [last] }, manager, 1.5);
  assert.equal(tracks.length, 2);
  assert.ok(tracks.every(track => track.getInterpolation() === InterpolateDiscrete));

  const mixer = new AnimationMixer(model);
  const action = mixer.clipAction(new AnimationClip('Step', 1.5, tracks));
  action.play();
  mixer.setTime(0.99);
  assert.deepEqual(bone.position.toArray(), [2, 5, 0]);
  mixer.setTime(1);
  assert.deepEqual(bone.position.toArray(), [8, 5, 3]);
  assert.equal(bone.quaternion.angleTo(new Quaternion(0, 1, 0, 0)), 0);
});

test('JSON round-trip does not insert rest values on sparse channels', () => {
  const name = 'arm.left';
  const input = JSON.parse(generateAnimationJson('Pose', 1.2, { [name]: [first, rotation, last] }));
  const { keyFrames } = parseImportedTracks(input.tracks, [{ name }]);
  assert.deepEqual(keyFrames[name], [first, rotation, last]);
});
