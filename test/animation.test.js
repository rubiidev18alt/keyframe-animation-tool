import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip, AnimationMixer, Bone, Group, InterpolateDiscrete, InterpolateLinear, Quaternion } from 'three';
import { createThreeAnimationTracks, getClipChannels, samplePoseAtTime, findNeighborKeyframes } from '../src/utils/animationTracks.js';
import { generateAnimationJson, parseImportedTracks, validateImportedJson } from '../src/utils/animationHelpers.js';

const vector = (x, y, z) => ({ x, y, z });
const rest = { position: vector(0, 2, 0), quaternion: { x: 0, y: 0, z: 0, w: 1 } };
const first = { time: 0.1, position: vector(2, 5, 0) };
const rotation = { time: 0.5, rotation: { x: 0, y: 1, z: 0, w: 0 } };
const last = { time: 1, position: vector(8, 5, 3) };

test('scrubbing holds each channel independently and snaps on the exact key', () => {
  const track = [last, first, rotation]; // Scrubbing also works for unsorted keys.
  assert.deepEqual(samplePoseAtTime([], 0.7, rest), rest);
  assert.deepEqual(samplePoseAtTime(track, 0, rest).position, first.position);
  assert.deepEqual(samplePoseAtTime(track, 0.9999, rest), { position: first.position, quaternion: rotation.rotation });
  assert.deepEqual(samplePoseAtTime(track, 1, rest).position, last.position);
  assert.deepEqual(samplePoseAtTime(track, 10, rest).position, last.position);
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


test('smooth scrubbing, playback and cropped endpoints agree on independent channels', () => {
  const start = { time: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const end = { time: 1, rotation: { x: 0, y: 0, z: -1, w: 0 } };
  const track = [last, start, first, end];
  const middle = samplePoseAtTime(track, 0.55, rest, 'smooth');
  const expected = new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: -1 }, Math.PI * 0.55);
  const asQuaternion = ({ x, y, z, w }) => new Quaternion(x, y, z, w);
  assert.ok(Math.abs(middle.position.x - 5) < 1e-8);
  assert.ok(Math.abs(middle.position.z - 1.5) < 1e-8);
  assert.ok(asQuaternion(middle.quaternion).angleTo(expected) < 1e-7);
  assert.deepEqual(samplePoseAtTime(track, 1, rest, 'smooth').quaternion, end.rotation);
  assert.deepEqual(samplePoseAtTime([last], 0.2, rest, 'smooth').position, last.position);

  const channels = getClipChannels(track, 0.55, 'smooth');
  assert.deepEqual(channels[0].keys.map(k => k.time), [0, 0.1, 0.55]);
  assert.deepEqual(channels[0].keys.at(-1).value, middle.position);
  assert.deepEqual(channels[1].keys.at(-1).value, middle.quaternion);

  const model = new Group();
  const bone = new Bone();
  bone.name = 'Arm';
  model.add(bone);
  const tracks = createThreeAnimationTracks({ Arm: track }, { getBoneByName: () => bone }, 0.55, 'smooth');
  assert.ok(tracks.every(track => track.getInterpolation() === InterpolateLinear));
  const mixer = new AnimationMixer(model);
  mixer.clipAction(new AnimationClip('Smooth', 0.55, tracks)).play();
  mixer.setTime(0.3);
  const sample = samplePoseAtTime(track, 0.3, rest, 'smooth');
  assert.ok(Math.abs(bone.position.x - sample.position.x) < 1e-6);
  assert.ok(asQuaternion(bone.quaternion).normalize().angleTo(asQuaternion(sample.quaternion)) < 1e-6);
});

test('key navigation uses exact timestamps, skips the current key and does not wrap', () => {
  const keys = [{ time: 1.2345 }, { time: 0 }, { time: 0.4167 }, { time: 8 }, { time: NaN }];
  assert.deepEqual(findNeighborKeyframes(keys, 0, 2), { previous: null, next: 0.4167 });
  assert.deepEqual(findNeighborKeyframes(keys, 0.4167, 2), { previous: 0, next: 1.2345 });
  assert.deepEqual(findNeighborKeyframes(keys, 0.8, 2), { previous: 0.4167, next: 1.2345 });
  assert.deepEqual(findNeighborKeyframes(keys, 2, 2), { previous: 1.2345, next: null });
  assert.deepEqual(findNeighborKeyframes([], 0, 2), { previous: null, next: null });
});

test('JSON saves the mode and still accepts older projects without it', () => {
  const project = JSON.parse(generateAnimationJson('Pose', 1.2, { Arm: [rotation] }, 'smooth'));
  assert.equal(project.interpolation, 'smooth');
  assert.equal(validateImportedJson(project), true);
  delete project.interpolation;
  assert.equal(validateImportedJson(project), true);
  assert.throws(() => validateImportedJson({ ...project, interpolation: 'unknown' }), /interpolation/);
});
