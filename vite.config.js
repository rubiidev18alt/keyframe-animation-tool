import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Keep the licenses with the app even when the offline HTML travels by itself.
const licensePaths = {
  'Keyframe Animation Tool': './LICENSE',
  'fflate (vendored in Three.js)': './licenses/fflate.txt',
  ...Object.fromEntries(['react', 'react-dom', 'scheduler', 'three', 'three-js-fbx-exporter']
    .map(name => [name, `./node_modules/${name}/LICENSE`])),
};

const includeLicenses = {
  name: 'include-runtime-licenses',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const licenses = Object.entries(licensePaths).map(([name, path]) =>
        `${name}\n${readFileSync(new URL(path, import.meta.url), 'utf8').trim()}`).join('\n\n');
      return `${html}\n<!-- Runtime licenses\n${licenses.replaceAll('-->', '-- >')}\n-->\n`;
    },
  },
};

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: false,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), includeLicenses, ...(mode === 'offline' ? [viteSingleFile()] : [])],
  server: { allowedHosts: ['.e2b.app'] },
  preview: { allowedHosts: ['.e2b.app'] },
}));
