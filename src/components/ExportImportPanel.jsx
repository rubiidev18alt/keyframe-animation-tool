import { useState } from 'react';
import { AnimationClip } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { useAnimation } from '../contexts/AnimationContext';
import { generateAnimationJson, parseAnimationClipToKATKeyframes } from '../utils/animationHelpers';
import { createThreeAnimationTracks } from '../utils/steppedAnimation';
import { downloadAnimation } from '../utils/download';
import { useKeyframes } from '../hooks/useKeyframes';
import FilePicker from './FilePicker';
import Icon from './Icon';
import Section from './Section';

export default function ExportImportPanel({ onImportJson }) {
  const {
    animationName, animationDuration, keyFrames, isSceneReady, sceneManagerRef, isPlaying,
    bones, setAnimationName, setAnimationDuration, setKeyFrames, setCurrentTime,
    setIsLoadingModel, isLoadingModel,
  } = useAnimation();
  const { totalKeyframeCount } = useKeyframes();
  const [exporting, setExporting] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const canImport = isSceneReady && bones.length > 0 && !isPlaying && !isLoadingModel;
  const canExport = canImport && totalKeyframeCount > 0 && !exporting;

  async function exportClip(format) {
    if (!canExport) return;
    const manager = sceneManagerRef.current;
    const model = manager?.model;
    if (!model) return;
    setExportStatus(null);
    setExporting(format);
    try {
      if (format === 'json') {
        downloadAnimation(generateAnimationJson(animationName, animationDuration, keyFrames), animationName, 'json', 'application/json');
      } else if (format === 'fbx') {
        const { exportAnimationFbx } = await import('../utils/exportFbx');
        downloadAnimation(exportAnimationFbx(model, keyFrames, animationName, animationDuration), animationName, 'fbx');
      } else {
        const tracks = createThreeAnimationTracks(keyFrames, manager, animationDuration);
        if (!tracks.length) throw new Error('No valid keyframes match the loaded rig.');
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const clip = new AnimationClip(animationName, animationDuration, tracks);
        const result = await new GLTFExporter().parseAsync(model, { binary: true, animations: [clip], includeCustomExtensions: true });
        downloadAnimation(result, animationName, 'glb');
      }
      setExportStatus({ message: `${format.toUpperCase()} download started.` });
    } catch (error) {
      console.error('Animation export failed:', error);
      setExportStatus({ message: error.message, error: true });
    } finally {
      setExporting(null);
    }
  }

  async function loadAnimation(file) {
    if (!canImport) return;
    setImportStatus(null);
    setIsLoadingModel(true);
    let objectUrl;
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      let asset;
      if (extension === 'fbx') {
        asset = new FBXLoader().parse(await file.arrayBuffer(), '');
      } else if (extension === 'glb' || extension === 'gltf') {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        objectUrl = URL.createObjectURL(file);
        asset = await new GLTFLoader().loadAsync(objectUrl);
      } else throw new Error('Choose an FBX, GLB or GLTF animation file.');

      const clip = asset.animations?.[0];
      if (!clip) throw new Error('No animations were found in this file.');
      const imported = parseAnimationClipToKATKeyframes(clip, bones);
      if (!Object.keys(imported.keyFrames).length) throw new Error('No animation tracks match the loaded rig.');

      setAnimationName(imported.animationName || file.name.replace(/\.[^.]+$/, ''));
      setAnimationDuration(imported.animationDuration > 0 && Number.isFinite(imported.animationDuration) ? Number(imported.animationDuration.toFixed(4)) || imported.animationDuration : 5);
      setKeyFrames(imported.keyFrames);
      setCurrentTime(0);
      const skippedCount = imported.skippedBones.length;
      setImportStatus({ message: skippedCount ? `Clip loaded. ${skippedCount} unmatched ${skippedCount === 1 ? 'bone' : 'bones'} skipped.` : 'Animation imported.' });
    } catch (error) {
      console.error('Animation import failed:', error);
      setImportStatus({ message: error.message, error: true });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setIsLoadingModel(false);
    }
  }

  return (
    <>
      <Section index="03" title="Import animation">
        <FilePicker id="animation-file-input" accept=".fbx,.glb,.gltf" title="Import animation file" hint="FBX, GLB or GLTF" onFile={loadAnimation} disabled={!canImport} />
        <button className="button secondary wide" onClick={onImportJson} disabled={!canImport}><Icon name="code" /> Import Keyframe JSON</button>
        {importStatus && <p className={`panel-message${importStatus.error ? ' error' : ''}`} role={importStatus.error ? 'alert' : 'status'}>{importStatus.message}</p>}
      </Section>

      <Section index="04" title="Export animation">
        <button className="button primary wide" onClick={() => exportClip('fbx')} disabled={!canExport} title="Export the skeleton and its animation as FBX">
          <Icon name="download" /> {exporting === 'fbx' ? 'Exporting FBX…' : 'Export FBX'}
          <span className="button-format">.FBX</span>
        </button>
        <div className="button-group">
          <button className="button secondary" onClick={() => exportClip('glb')} disabled={!canExport} title="Export model and animation">{exporting === 'glb' ? 'Exporting…' : 'Export GLB'}</button>
          <button className="button secondary" onClick={() => exportClip('json')} disabled={!canExport} title="Save keyframes for this tool">Export JSON</button>
        </div>
        <p className="section-hint">FBX: skeleton + clip <b>·</b> GLB: model + clip</p>
        {exportStatus && <p className={`panel-message${exportStatus.error ? ' error' : ''}`} role={exportStatus.error ? 'alert' : 'status'}>{exportStatus.message}</p>}
      </Section>
    </>
  );
}
