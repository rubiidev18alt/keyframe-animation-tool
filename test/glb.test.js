import assert from 'node:assert/strict';
import { Buffer, File } from 'node:buffer';
import test from 'node:test';
import { Matrix4, Vector3 } from 'three';
import { findCompatibleClip } from '../src/utils/animationHelpers.js';
import { createDemoRig } from '../src/utils/demoRig.js';
import { loadLocalAsset } from '../src/utils/loadAsset.js';

// Binary glTF built directly from the format (not with the editor's exporter).
// A triangle is weighted to an unnamed child joint whose translation is keyed.
function makeGlb(interpolation = 'LINEAR', { staticModel = false, externalImage, compressed = false } = {}) {
  const parts = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;
  const accessor = (array, type, count, bounds) => {
    const bytes = Buffer.from(array.buffer);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    parts.push(bytes);
    offset += bytes.length;
    accessors.push({ bufferView: bufferViews.length - 1, componentType: array instanceof Float32Array ? 5126 : 5123, count, type, ...bounds });
    return accessors.length - 1;
  };
  const POSITION = accessor(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), 'VEC3', 3, { min: [0, 0, 0], max: [1, 1, 0] });
  const JOINTS_0 = accessor(Uint16Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), 'VEC4', 3);
  const WEIGHTS_0 = accessor(Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), 'VEC4', 3);
  const identity = new Matrix4().toArray();
  const inverseBindMatrices = accessor(Float32Array.from([...identity, ...identity]), 'MAT4', 2);
  const input = accessor(Float32Array.of(0, 1), 'SCALAR', 2, { min: [0], max: [1] });
  const values = interpolation === 'CUBICSPLINE' ? [0, 0, 0, 0, 0, 0, 3, 0, 0, 3, 0, 0, 2, 0, 0, 0, 0, 0] : [0, 0, 0, 2, 0, 0];
  const output = accessor(Float32Array.from(values), 'VEC3', values.length / 3);
  const doc = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: staticModel ? [0] : [0, 1] }],
    nodes: staticModel ? [{ name: 'Panel', mesh: 0 }] : [{ name: 'Panel', mesh: 0, skin: 0 }, { name: 'Joint_2', children: [2] }, {}],
    meshes: [{ primitives: [{ attributes: staticModel ? { POSITION } : { POSITION, JOINTS_0, WEIGHTS_0 } }] }],
    ...(staticModel ? {} : {
      skins: [{ joints: [1, 2], inverseBindMatrices }],
      animations: [{ name: 'Slide', samplers: [{ input, output, interpolation }], channels: [{ sampler: 0, target: { node: 2, path: 'translation' } }] }],
    }),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
    ...(externalImage ? { images: [{ uri: externalImage }] } : {}),
    ...(compressed ? { extensionsUsed: ['KHR_draco_mesh_compression'] } : {}),
  };
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + padded.length + offset, 8);
  header.writeUInt32LE(padded.length, 12);
  header.write('JSON', 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset, 0);
  binHeader.write('BIN\0', 4);
  return new File([header, padded, binHeader, ...parts], 'Panel.GLB');
}

test('a local GLB yields an editable skinned model and keys for its unnamed joint', async () => {
  const { model, animations, format } = await loadLocalAsset(makeGlb());
  assert.equal(format, 'glb');
  assert.equal(model.userData.unitScaleFactor, 100);
  const mesh = model.getObjectByName('Panel');
  assert.ok(mesh.isSkinnedMesh);
  const [root, joint] = mesh.skeleton.bones;
  assert.ok(root.isBone && joint.isBone);
  assert.equal(joint.parent, root);
  assert.equal(joint.name, 'Joint_2_1'); // Doesn't shadow the named root.
  const clip = findCompatibleClip(animations, mesh.skeleton.bones, true);
  assert.equal(clip.animationName, 'Slide');
  assert.equal(clip.animationDuration, 1);
  assert.equal(clip.interpolation, 'smooth');
  assert.deepEqual(clip.keyFrames[joint.name].at(-1), { time: 1, position: { x: 2, y: 0, z: 0 } });

  model.updateMatrixWorld(true);
  joint.position.x = 2;
  model.updateMatrixWorld(true);
  assert.deepEqual(mesh.getVertexPosition(0, new Vector3()).toArray(), [2, 0, 0]);
});

test('GLB clip interpolation keeps STEP and imports cubic key values without their tangents', async () => {
  for (const [mode, expected] of [['STEP', 'step'], ['CUBICSPLINE', 'smooth']]) {
    const { model, animations } = await loadLocalAsset(makeGlb(mode));
    const bones = model.getObjectByName('Panel').skeleton.bones;
    const clip = findCompatibleClip(animations, bones, true);
    assert.equal(clip.interpolation, expected);
    assert.deepEqual(Object.values(clip.keyFrames)[0].map(key => key.position.x), [0, 2]);
  }
});

test('static GLB models load without a rig, while invalid/nonlocal assets give clear errors', async () => {
  const { model, animations } = await loadLocalAsset(makeGlb('LINEAR', { staticModel: true }));
  assert.ok(model.getObjectByName('Panel').isMesh);
  assert.deepEqual(animations, []);
  assert.equal(model.children.some(node => node.isBone), false);
  await assert.rejects(loadLocalAsset(new File(['not a GLB'], 'broken.glb')), /not a valid binary GLB/);
  await assert.rejects(loadLocalAsset(makeGlb('LINEAR', { externalImage: 'texture.png' })), /external buffers or textures/);
  await assert.rejects(loadLocalAsset(makeGlb('LINEAR', { compressed: true })), /compression decoder/);
});

test('the offline demo contains a working skinned mesh and an editable stepped clip', () => {
  const { model, animations, selectedBoneName } = createDemoRig();
  const mesh = model.getObjectByName('Relay_Shell');
  assert.ok(mesh.isSkinnedMesh && mesh.skeleton.bones.length === 11);
  const clip = findCompatibleClip(animations, mesh.skeleton.bones, true);
  assert.equal(clip.interpolation, 'step');
  assert.equal(clip.keyFrames[selectedBoneName].length, 6);
  assert.equal(clip.keyFrames[selectedBoneName].at(-1).time, clip.animationDuration);
});
