// Assets parsed from local files own their GPU resources. Dispose each once,
// including textures and skeletons shared by several meshes in the scene.
export function disposeModelResources(model) {
  const resources = new Set();
  const images = new Set();
  model.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.skeleton) resources.add(node.skeleton);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material || resources.has(material)) continue;
      resources.add(material);
      for (const value of Object.values(material)) {
        if (!value?.isTexture) continue;
        resources.add(value);
        if (typeof value.image?.close === 'function') images.add(value.image);
      }
    }
  });
  for (const resource of resources) resource.dispose();
  for (const image of images) image.close();
}
