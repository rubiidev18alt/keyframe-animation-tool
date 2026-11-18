import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { Bone, Euler, Group, Quaternion, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { validateFbxBinary } from 'three-js-fbx-exporter';
import { exportAnimationFbx } from '../src/utils/exportFbx.js';
import { parseAnimationClipToKATKeyframes } from '../src/utils/animationHelpers.js';

function rig() {
  const stage = new Group();
  stage.scale.setScalar(100);
  const model = new Group();
  model.name = 'Rig';
  model.position.set(3, 2, 1);
  model.scale.setScalar(2);
  stage.add(model);
  const hip = new Bone();
  hip.name = 'charHips';
  hip.userData.originalName = 'char:Hips';
  hip.position.set(0, 11, 0);
  hip.userData.initialLocalPosition = { x: 0, y: 8, z: 0 };
  model.add(hip);
  const arm = new Bone();
  arm.name = 'Arm';
  arm.position.set(1, 4, 0);
  arm.userData.initialLocalQuaternion = { x: 0, y: 0, z: 0, w: 1 };
  arm.rotateX(1);
  hip.add(arm);
  return { model, hip, arm };
}

const pose = new Quaternion().setFromEuler(new Euler(2.1, 2.6, 1.55));

test('binary FBX round-trips the take, hierarchy, source transforms and sparse keys', () => {
  const { model, hip, arm } = rig();
  const duration = 1.2334;
  const keyFrames = {
    [hip.name]: [{ time: 0, position: { x: 0, y: 8, z: 0 } }, { time: 0.2167, position: { x: 3, y: 10, z: -2 } }],
    [arm.name]: [{ time: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } }, { time: 0.4167, rotation: pose }],
    Missing: [{ time: 0, position: { x: 9, y: 9, z: 9 } }],
  };
  const fbx = exportAnimationFbx(model, keyFrames, 'Walk Cycle', duration);
  assert.equal(validateFbxBinary(fbx).valid, true);
  assert.equal(new DataView(fbx.buffer).getUint32(23, true), 7400);
  const loaded = new FBXLoader().parse(fbx.buffer, '');
  const loadedHip = loaded.getObjectByName(hip.name);
  const loadedArm = loaded.getObjectByName(arm.name);
  assert.equal(loadedHip.userData.originalName, 'char:Hips');
  assert.ok(loadedHip.isBone && loadedArm.isBone);
  assert.equal(loadedArm.parent, loadedHip);
  assert.deepEqual(loaded.position.toArray(), [3, 2, 1]);
  assert.deepEqual(loaded.scale.toArray(), [2, 2, 2]);
  assert.deepEqual(loadedHip.position.toArray(), [0, 8, 0]);
  assert.equal(loadedArm.quaternion.angleTo(new Quaternion()), 0);
  assert.deepEqual(hip.position.toArray(), [0, 11, 0]); // Don't stomp the editor pose.
  assert.ok(arm.quaternion.angleTo(new Quaternion()) > 0);

  const [clip] = loaded.animations;
  assert.equal(clip.name, 'Walk Cycle');
  assert.ok(Math.abs(clip.duration - duration) < 1e-6);
  const imported = parseAnimationClipToKATKeyframes(clip, [hip, arm]);
  const position = imported.keyFrames[hip.name][1].position;
  const restoredQ = imported.keyFrames[arm.name][1].rotation;
  assert.deepEqual(position, { x: 3, y: 10, z: -2 });
  assert.equal(imported.keyFrames[arm.name][1].time, 0.4167);
  assert.ok(new Quaternion(restoredQ.x, restoredQ.y, restoredQ.z, restoredQ.w).angleTo(pose) < 0.0001);

  assert.deepEqual(readCurveFlags(fbx), Array(6).fill(2)); // Constant, hold previous.
});

test('FBX refuses to export without a valid named skeleton track or duration', () => {
  const { model } = rig();
  assert.throws(() => exportAnimationFbx(null, {}, 'Invalid', 1), /Load a rigged model/);
  assert.throws(() => exportAnimationFbx(model, { Missing: [{ time: 0, position: new Vector3() }] }, 'Invalid', 5), /No valid keyframes/);
  assert.throws(() => exportAnimationFbx(model, {}, 'Invalid', 0), /duration/);
});


function readCurveFlags(fbx) {
  // Three's reader doesn't expose FBX interpolation flags, so inspect the
  // first value of each FBX KeyAttrFlags int32[] record directly.
  const bytes = Buffer.from(fbx);
  const attr = 'KeyAttrFlags';
  const flags = [];
  for (let at = bytes.indexOf(attr); at !== -1; at = bytes.indexOf(attr, at + attr.length)) {
    const start = at + attr.length;
    assert.equal(bytes.toString('ascii', start, start + 1), 'i');
    flags.push(bytes.readInt32LE(start + 13));
  }
  return flags;
}

test('smooth FBX uses linear curves, adds rotational samples and ends at the cropped pose', () => {
  const { model, hip, arm } = rig();
  const keyFrames = {
    [hip.name]: [{ time: 0, position: new Vector3(0, 8, 0) }, { time: 2, position: new Vector3(2, 12, 4) }],
    [arm.name]: [{ time: 0, rotation: new Quaternion() }, { time: 2, rotation: pose }],
  };
  const fbx = exportAnimationFbx(model, keyFrames, 'Smooth Curve', 1, 'smooth');
  assert.equal(validateFbxBinary(fbx).valid, true);
  assert.deepEqual(readCurveFlags(fbx), Array(6).fill(4));

  const scene = new FBXLoader().parse(fbx.buffer, '');
  const [clip] = scene.animations;
  const imported = parseAnimationClipToKATKeyframes(clip, [hip, arm]);
  assert.equal(clip.duration, 1);
  assert.deepEqual(imported.keyFrames[hip.name].at(-1).position, { x: 1, y: 10, z: 2 });
  const rotationKeys = imported.keyFrames[arm.name];
  assert.ok(rotationKeys.length > 2);
  for (const { time, rotation: { x, y, z, w } } of rotationKeys) {
    assert.ok(new Quaternion(x, y, z, w).angleTo(new Quaternion().slerp(pose, time / 2)) < 0.001);
  }
});
