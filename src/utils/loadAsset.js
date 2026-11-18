import { LoadingManager } from 'three';

function embeddedOnly(parser) {
  const { buffers = [], images = [], extensionsRequired = [], extensionsUsed = [] } = parser.json;
  if ([...buffers, ...images].some(entry => entry.uri && !/^data:/i.test(entry.uri))) {
    throw new Error('This glTF links to external buffers or textures. Export a self-contained .glb and try again.');
  }
  if (extensionsUsed.includes('KHR_draco_mesh_compression') ||
      extensionsRequired.some(name => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(name))) {
    throw new Error('This glTF requires a compression decoder. Re-export without mesh or KTX2 texture compression.');
  }
  return { name: 'EditorLocalGltf' };
}

// Unnamed joints are legal in glTF. Give them stable labels and retarget any
// animation tracks the loader bound to their temporary UUIDs.
function nameGltfJoints(model, clips) {
  const used = new Set();
  const targets = new Map();
  model.traverse(node => { if (node.name) used.add(node.name); });
  let joint = 0;
  model.traverse(node => {
    if (!node.isBone) return;
    joint++;
    if (node.name) return;
    const base = `Joint_${joint}`;
    let name = base;
    let suffix = 1;
    while (used.has(name)) name = `${base}_${suffix++}`;
    node.name = name;
    used.add(name);
    targets.set(node.uuid, name);
  });
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      const name = targets.get(track.name.slice(0, dot));
      if (name) track.name = `${name}${track.name.slice(dot)}`;
    }
  }
}

export async function loadLocalAsset(file) {
  const format = file.name.match(/\.(fbx|glb|gltf)$/i)?.[1].toLowerCase();
  if (!format) throw new Error('Choose an FBX, GLB or self-contained GLTF file.');
  const bytes = await file.arrayBuffer();
  if (format === 'fbx') {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const model = new FBXLoader().parse(bytes, '');
    return { model, animations: model.animations, format };
  }

  if (format === 'glb' && (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67)) {
    throw new Error('This file is not a valid binary GLB.');
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const manager = new LoadingManager().setURLModifier(url => {
    if (/^(blob:|data:)/i.test(url)) return url;
    throw new Error('Only embedded glTF buffers and textures are supported.');
  });
  const asset = await new GLTFLoader(manager).register(embeddedOnly).parseAsync(bytes, '');
  const { scene: model, animations } = asset;
  if (!model) throw new Error('The file does not contain a scene.');
  nameGltfJoints(model, animations);
  model.userData.unitScaleFactor = 100; // glTF is in meters; FBX metadata stores centimeters per unit.
  return { model, animations, format };
}
