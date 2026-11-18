import { Euler, Quaternion, MathUtils } from 'three';
import { FbxBinaryWriter, FbxNode } from 'three-js-fbx-exporter';
import { getClipChannels } from './steppedAnimation.js';

const FBX_VERSION = 7400;
const TICKS_PER_SECOND = 46186158000;
const CONSTANT_STANDARD = 0x02; // Hold this key, not the next key (0x102).
// FBX Euler XYZ applies rotations extrinsically, i.e. Three's intrinsic ZYX.
const EULER_ORDER = 'ZYX';
const toTicks = seconds => BigInt(Math.round(seconds * TICKS_PER_SECOND));
const typed = (type, value) => ({ type, value });
const named = (name, type) => `${name}\u0000\u0001${type}`;
const property = (node, name, type, values, label = '', flags = '') =>
  node.add('P', [name, type, label, flags, ...values]);

function translationValues(position) {
  return [position.x, position.y, position.z];
}

function eulerValues(rotation) {
  const quaternion = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
  const { x, y, z } = new Euler().setFromQuaternion(quaternion, EULER_ORDER);
  return [x, y, z].map(MathUtils.radToDeg);
}

function addTransform(properties, name, values) {
  property(properties, name, name, values.map(value => typed('float64', value)), '', 'A');
}

function addCurve(objects, id, times, values) {
  const curve = objects.add('AnimationCurve', [id, named('', 'AnimCurve'), '']);
  curve.add('Default', [typed('float64', values[0])]);
  curve.add('KeyVer', [4008]);
  curve.add('KeyTime', [typed('int64Array', times)]);
  curve.add('KeyValueFloat', [typed('float32Array', values)]);
  curve.add('KeyAttrFlags', [typed('int32Array', [CONSTANT_STANDARD])]);
  curve.add('KeyAttrDataFloat', [typed('float32Array', [0, 0, 0, 0])]);
  curve.add('KeyAttrRefCount', [typed('int32Array', [times.length])]);
}

/** Write a binary FBX take with the source skeleton (no meshes or textures). */
export function exportAnimationFbx(model, keyFrames, name, duration) {
  if (!model) throw new Error('Load an FBX rig first.');
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(Math.round(duration * TICKS_PER_SECOND))) {
    throw new Error('The animation duration is outside the supported FBX range.');
  }

  const rigNodes = new Set();
  model.traverse(node => {
    if (!node.isBone) return;
    for (let joint = node; joint && !rigNodes.has(joint); joint = joint === model ? null : joint.parent) {
      rigNodes.add(joint);
    }
  });

  const stop = toTicks(duration);
  const takeName = (name || '').trim().replace(/\0/g, '') || 'Animation';
  const creator = 'Keyframe Animation Tool';
  const header = new FbxNode('FBXHeaderExtension');
  header.add('FBXHeaderVersion', [1003]);
  header.add('FBXVersion', [FBX_VERSION]);
  header.add('Creator', [creator]);

  const globals = new FbxNode('GlobalSettings');
  globals.add('Version', [1000]);
  const settings = globals.add('Properties70');
  for (const [axis, index, sign] of [['UpAxis', 1, 1], ['FrontAxis', 2, 1], ['CoordAxis', 0, 1]]) {
    property(settings, axis, 'int', [index], 'Integer');
    property(settings, `${axis}Sign`, 'int', [sign], 'Integer');
  }
  const units = model.userData.unitScaleFactor;
  property(settings, 'UnitScaleFactor', 'double', [typed('float64', Number.isFinite(units) && units > 0 ? units : 1)], 'Number');
  property(settings, 'TimeMode', 'enum', [6]); // FBX eFrames30
  property(settings, 'TimeSpanStart', 'KTime', [0n], 'Time');
  property(settings, 'TimeSpanStop', 'KTime', [stop], 'Time');

  const documents = new FbxNode('Documents');
  documents.add('Count', [1]);
  const document = documents.add('Document', [1n, 'Scene', 'Scene']);
  property(document.add('Properties70'), 'ActiveAnimStackName', 'KString', [takeName]);
  document.add('RootNode', [0n]);

  let nextId = 100n;
  const ids = new Map([...rigNodes].map(node => [node, nextId++]));
  const objects = new FbxNode('Objects');
  const connections = new FbxNode('Connections');
  const connect = (from, to, binding) => connections.add('C', binding ? ['OP', from, to, binding] : ['OO', from, to]);

  const stackId = nextId++;
  const layerId = nextId++;
  const stack = objects.add('AnimationStack', [stackId, named(takeName, 'AnimStack'), '']);
  const stackProps = stack.add('Properties70');
  for (const prefix of ['Local', 'Reference']) {
    property(stackProps, `${prefix}Start`, 'KTime', [0n], 'Time');
    property(stackProps, `${prefix}Stop`, 'KTime', [stop], 'Time');
  }
  objects.add('AnimationLayer', [layerId, named('Base Layer', 'AnimLayer'), '']);
  connect(layerId, stackId);

  let curveCount = 0;
  for (const [node, id] of ids) {
    const nodeName = node.userData.originalName || node.name || (node.isBone ? 'Bone' : 'Rig');
    const nodeType = node.isBone ? 'LimbNode' : 'Null';
    const fbxModel = objects.add('Model', [id, named(nodeName, 'Model'), nodeType]);
    fbxModel.add('Version', [232]);
    const transform = fbxModel.add('Properties70');
    addTransform(transform, 'Lcl Translation', translationValues(node.userData.initialLocalPosition ?? node.position));
    addTransform(transform, 'Lcl Rotation', eulerValues(node.userData.initialLocalQuaternion ?? node.quaternion));
    addTransform(transform, 'Lcl Scaling', translationValues(node.scale));
    property(transform, 'RotationOrder', 'enum', [0]);
    property(transform, 'InheritType', 'enum', [1]); // Match Three.js parent * local transforms.
    connect(id, ids.get(node.parent) ?? 0n);
    if (!node.isBone) continue;

    const attributeId = nextId++;
    const attribute = objects.add('NodeAttribute', [attributeId, named(nodeName, 'NodeAttribute'), 'LimbNode']);
    attribute.add('TypeFlags', ['Skeleton']);
    connect(attributeId, id);

    const track = Object.hasOwn(keyFrames, node.name) ? keyFrames[node.name] : null;
    for (const { binding, keys } of getClipChannels(track, duration)) {
      const rotation = binding === 'quaternion';
      const curveNodeId = nextId++;
      const curveNode = objects.add('AnimationCurveNode', [curveNodeId, named(rotation ? 'R' : 'T', 'AnimCurveNode'), '']);
      connect(curveNodeId, layerId);
      connect(curveNodeId, id, rotation ? 'Lcl Rotation' : 'Lcl Translation');
      const props = curveNode.add('Properties70');
      const times = keys.map(key => toTicks(key.time));
      const values = keys.map(key => rotation ? eulerValues(key.value) : translationValues(key.value));
      ['X', 'Y', 'Z'].forEach((axis, i) => {
        const axisValues = values.map(tuple => tuple[i]);
        if (rotation) {
          for (let key = 1; key < axisValues.length; key++) {
            // Keep Euler angles on the nearest revolution across the ±180° seam.
            axisValues[key] += 360 * Math.round((axisValues[key - 1] - axisValues[key]) / 360);
          }
        }
        const channel = `d|${axis}`;
        property(props, channel, 'Number', [typed('float64', axisValues[0])], '', 'A');
        const curveId = nextId++;
        addCurve(objects, curveId, times, axisValues);
        connect(curveId, curveNodeId, channel);
        curveCount++;
      });
    }
  }
  if (!curveCount) throw new Error('No valid keyframes match the loaded skeleton.');

  const definitions = new FbxNode('Definitions');
  definitions.add('Version', [100]);
  definitions.add('Count', [objects.children.length]);
  const counts = new Map();
  for (const node of objects.children) counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
  for (const [type, count] of counts) definitions.add('ObjectType', [type]).add('Count', [count]);

  const takes = new FbxNode('Takes');
  takes.add('Current', [takeName]);
  const take = takes.add('Take', [takeName]);
  take.add('FileName', [`${takeName}.tak`]);
  take.add('LocalTime', [0n, stop]);
  take.add('ReferenceTime', [0n, stop]);
  return new FbxBinaryWriter({ version: FBX_VERSION }).writeDocument([
    header, globals, documents, new FbxNode('References'), definitions, objects, connections, takes,
  ]);
}
