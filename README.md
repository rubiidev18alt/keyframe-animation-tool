# Keyframe Animation Tool

A browser-based editor for posing FBX and GLB rigs, building skeletal animations, and exporting clips. Models and animations are processed on your device.

![The Keyframe Animation Tool workbench with the Relay R-07 demo rig](public/screenshot.png)

## Run it locally, offline

Download `keyframe-animation-tool-v0.3.0.html` from the [v0.3.0 release](https://github.com/rubiidev18alt/keyframe-animation-tool/releases/tag/v0.3.0) and open it in a current browser with WebGL support. No installer, server, Node.js, or internet connection is needed. Keep your rig and saved animations separately from the app file.

## Edit an animation

1. In **Scene → Model source**, pick or drop an **FBX**, **GLB**, or self-contained **GLTF** model. Or select **Try demo** to open Relay R-07, an 11-joint robot with an editable starter clip.
2. In **Animate**, select a bone and change its local rotation with the viewport gizmo or the rotation fields. Position is read-only in the editor; imported clips can include position keys.
3. Select a time and click **Set Key**. Repeat at other times and on other bones. Use **Tracks** to see all animated bones and the key-jump buttons (or `[` and `]`) to move between keys on the selected bone.
4. Choose **Step** or **Smooth** next to the timeline scrubber. **Step** is the default and holds each keyed value until the next key. **Smooth** blends positions linearly and rotations along the shortest arc. Clicking a key marker jumps to its exact pose in either mode.
5. Return to **Scene** to export. Use **Import animation** to apply a compatible clip from another FBX/GLB/GLTF file to the loaded rig, or paste saved keyframe JSON.

### GLB model import

Skinned models can be posed and animated. If a GLB/GLTF model includes animations, the first clip with matching bone rotation or translation tracks opens on the timeline. Models without a skeleton can be viewed but not keyframed. Use glTF 2.0 files with embedded buffers and textures; assets that require a Draco, Meshopt, or KTX2 decoder aren't supported. The editor uses one interpolation mode per clip, so cubic tangents, per-channel interpolation differences, and scale or morph animation aren't retained.

### Export formats

| Export | Includes | Use it for |
| --- | --- | --- |
| **FBX** | Binary FBX 7.4, skeleton hierarchy, and one clip. Step uses constant curves; Smooth uses linear translation and sampled Euler rotation curves. | Applying the clip to the matching rig in other 3D tools. No mesh, skin weights, or textures. |
| **GLB** | Model and clip together, using STEP or LINEAR interpolation. | Moving a rigged model and clip together. |
| **JSON** | Editable position and rotation keys and the Step/Smooth setting. | Saving keys to reopen on the same rig. Older JSON without a mode opens in Step. |

Some 3D applications resample FBX curves on import. To keep the stepped look, keep constant interpolation or disable resampling where your importer supports it.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` or `K` | Set or update a keyframe |
| `Delete` / `Backspace` | Remove the selected bone's key at the playhead |
| `[` / `]` | Previous / next keyframe on the selected bone |
| `←` / `→` | Previous / next frame (30 fps reference) |
| `Shift` + `←` / `→` | Jump by 0.1 seconds |
| `Home` / `End` | Start / end of the timeline |

## Develop and build

Use Node.js 22 and npm:

```sh
git clone https://github.com/rubiidev18alt/keyframe-animation-tool.git
cd keyframe-animation-tool
npm ci
npm run dev
```

- `npm run lint` checks the source. `npm test` checks pose sampling, key navigation, file imports, and FBX export.
- `npm run build` creates the static website in `dist/`. `npm run preview` serves that build for testing.
- `npm run build:local` creates the standalone `build/local/index.html`. Rename the HTML as desired and open it directly, or attach it to a GitHub release.

## Publish the website on GitHub Pages

In [repository Settings → Pages](https://github.com/rubiidev18alt/keyframe-animation-tool/settings/pages), set **Build and deployment → Source** to **GitHub Actions**. After the change is merged into `main`, the **Build and deploy Pages** workflow can deploy on a push to `main` or be run manually from the Actions tab. The website URL is [rubiidev18alt.github.io/keyframe-animation-tool/](https://rubiidev18alt.github.io/keyframe-animation-tool/) once deployment succeeds.

## License

[MIT](LICENSE).
