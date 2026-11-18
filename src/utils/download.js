export function downloadAnimation(data, name, extension, type = 'application/octet-stream') {
  const fileName = (name || '').trim().replace(/[\s/\\:*?"<>|]+/g, '_') || 'animation';
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser consume the object URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
