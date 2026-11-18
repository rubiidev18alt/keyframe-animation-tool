import {
  AnimationClip, Bone, BoxGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Group,
  InterpolateDiscrete, MeshStandardMaterial, Quaternion, QuaternionKeyframeTrack, Skeleton,
  SkinnedMesh, Uint16BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A small original robot, built in memory so the demo also works offline.
const colors = { shell: 0x88cbbd, light: 0xd9e6d8, dark: 0x253642, edge: 0x485e65, amber: 0xf2b569, eye: 0x9efcef };

export function createDemoRig() {
  const model = new Group();
  model.name = 'Relay_R07';
  model.userData.unitScaleFactor = 100;
  const bones = [];
  const parts = [];
  const addBone = (name, parent, x, y, z) => {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    bones.push(bone);
    return bone;
  };
  const part = (bone, geometry, color, x, y, z) => {
    geometry.translate(x, y, z);
    parts.push({ bone, geometry, color });
  };
  const box = (bone, color, sx, sy, sz, x, y, z) => part(bone, new BoxGeometry(sx, sy, sz), color, x, y, z);
  const disc = (bone, color, radius, depth, x, y, z) =>
    part(bone, new CylinderGeometry(radius, radius, depth, 12).rotateX(Math.PI / 2), color, x, y, z);

  const hips = addBone('Hips', model, 0, 0.82, 0);
  box(hips, 'dark', 0.43, 0.17, 0.30, 0, 0, 0);
  box(hips, 'edge', 0.40, 0.055, 0.325, 0, 0.02, 0);
  box(hips, 'amber', 0.11, 0.06, 0.02, 0, 0.02, 0.172);

  const chest = addBone('Torso', hips, 0, 0.135, 0);
  box(chest, 'shell', 0.54, 0.40, 0.31, 0, 0.18, 0);
  box(chest, 'light', 0.48, 0.08, 0.32, 0, 0.36, 0);
  box(chest, 'dark', 0.32, 0.19, 0.022, 0, 0.185, 0.16);
  box(chest, 'amber', 0.074, 0.082, 0.014, -0.08, 0.19, 0.18);
  for (let i = 0; i < 3; i++) box(chest, 'edge', 0.105, 0.011, 0.012, 0.045, 0.16 + i * 0.03, 0.177);
  disc(chest, 'dark', 0.088, 0.06, 0, 0.411, 0);

  const head = addBone('Head', chest, 0, 0.435, 0);
  box(head, 'light', 0.43, 0.30, 0.29, 0, 0.142, 0);
  box(head, 'shell', 0.40, 0.066, 0.31, 0, 0.262, 0);
  box(head, 'dark', 0.347, 0.135, 0.032, 0, 0.151, 0.148);
  for (const side of [-1, 1]) {
    disc(head, 'eye', 0.041, 0.009, 0.092 * side, 0.156, 0.17);
    box(head, 'edge', 0.047, 0.123, 0.12, 0.224 * side, 0.131, 0);
  }
  box(head, 'dark', 0.025, 0.115, 0.028, -0.116, 0.328, 0);
  box(head, 'amber', 0.060, 0.034, 0.042, -0.116, 0.389, 0);

  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    const arm = addBone(`Shoulder_${suffix}`, chest, side * 0.365, 0.305, 0);
    box(arm, 'edge', 0.20, 0.145, 0.214, 0, -0.018, 0);
    box(arm, 'shell', 0.155, 0.25, 0.17, 0, -0.168, 0);
    box(arm, 'light', 0.18, 0.073, 0.20, 0, -0.053, 0);
    const elbow = addBone(`Elbow_${suffix}`, arm, 0, -0.322, 0);
    disc(elbow, 'dark', 0.072, 0.172, 0, 0, 0);
    disc(elbow, 'amber', 0.032, 0.015, 0, 0, 0.091);
    box(elbow, 'light', 0.148, 0.175, 0.16, 0, -0.132, 0);
    box(elbow, 'dark', 0.122, 0.079, 0.14, 0, -0.242, 0);

    const hip = addBone(`Hip_${suffix}`, hips, side * 0.133, -0.076, 0);
    box(hip, 'edge', 0.162, 0.30, 0.173, 0, -0.15, 0);
    const knee = addBone(`Knee_${suffix}`, hip, 0, -0.338, 0);
    disc(knee, 'dark', 0.076, 0.19, 0, 0, 0);
    disc(knee, 'amber', 0.034, 0.012, 0, 0, 0.098);
    box(knee, 'shell', 0.172, 0.23, 0.19, 0, -0.165, 0);
    box(knee, 'dark', 0.203, 0.116, 0.28, 0, -0.30, 0.04);
    box(knee, 'edge', 0.206, 0.036, 0.284, 0, -0.348, 0.04);
  }

  model.updateMatrixWorld(true);
  for (const { bone, geometry, color } of parts) {
    geometry.applyMatrix4(bone.matrixWorld);
    const count = geometry.attributes.position.count;
    const vertexColors = new Float32Array(count * 3);
    const weights = new Float32Array(count * 4);
    const joints = new Uint16Array(count * 4);
    const rgb = new Color(colors[color]);
    const joint = bones.indexOf(bone);
    for (let i = 0; i < count; i++) {
      rgb.toArray(vertexColors, i * 3);
      weights[i * 4] = 1;
      joints[i * 4] = joint;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(vertexColors, 3));
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  }
  const geometry = mergeGeometries(parts.map(part => part.geometry));
  parts.forEach(part => part.geometry.dispose());
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.57, metalness: 0.12 }));
  mesh.name = 'Relay_Shell';
  model.add(mesh);
  model.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones));

  const times = [0, 0.65, 1.25, 1.85, 2.45, 3.2];
  const track = (bone, x, y, z) => new QuaternionKeyframeTrack(`${bone}.quaternion`, times,
    times.flatMap((_, i) => new Quaternion().setFromEuler(new Euler(x[i] ?? 0, y[i] ?? 0, z[i] ?? 0)).toArray()), InterpolateDiscrete);
  const clip = new AnimationClip('Relay — Signal Check', 3.2, [
    track('Shoulder_R', [], [], [0.08, 1.45, 1.85, 1.5, 0.85, 0.08]),
    track('Elbow_R', [], [], [0, 0.58, 1.08, 0.62, 0.32, 0]),
    track('Head', [-0.04, -0.09, 0.06, -0.09, -0.04, -0.04], [-0.1, 0.12, 0.26, 0.14, 0.05, -0.1], []),
  ]);
  return { model, animations: [clip], format: 'demo', selectedBoneName: 'Shoulder_R' };
}
