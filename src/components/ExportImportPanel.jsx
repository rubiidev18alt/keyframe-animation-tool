import { useState } from 'react';
import { AnimationClip } from 'three';
import { useAnimation } from '../contexts/AnimationContext';
import { generateAnimationJson, findCompatibleClip } from '../utils/animationHelpers';
import { createThreeAnimationTracks } from '../utils/animationTracks';
import { downloadAnimation } from '../utils/download';
import { loadLocalAsset } from '../utils/loadAsset';
import { disposeModelResources } from '../utils/modelResources';
import { useKeyframes } from '../hooks/useKeyframes';
import FilePicker from './FilePicker';
import Icon from './Icon';
import Section from './Section';

export default function ExportImportPanel({ onImportJson }) {
  const {
    animationName, animationDuration, keyFrames, isSceneReady, sceneManagerRef, isPlaying,
    bones, interpolation, replaceTimeline, setIsLoadingModel, isLoadingModel, isGizmoDraggingRef,
  } = useAnimation();
  const { totalKeyframeCount } = useKeyframes();
  const [exporting, setExporting] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const canImport = isSceneReady && bones.length > 0 && !isPlaying && !isLoadingModel;
  const canExport = canImport && totalKeyframeCount > 0 && !exporting;

  async function exportClip(format) {
    if (!canExport || isGizmoDraggingRef.current) return;
    const manager = sceneManagerRef.current;
    const model = manager?.model;
    if (!model) return;
    setExportStatus(null);
    setExporting(format);
    try {
      if (format === 'json') {
        downloadAnimation(generateAnimationJson(animationName, animationDuration, keyFrames, interpolation), animationName, 'json', 'application/json');
      } else if (format === 'fbx') {
        const { exportAnimationFbx } = await import('../utils/exportFbx');
        downloadAnimation(exportAnimationFbx(model, keyFrames, animationName, animationDuration, interpolation), animationName, 'fbx');
      } else {
        const tracks = createThreeAnimationTracks(keyFrames, manager, animationDuration, interpolation);
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
    if (!canImport || isGizmoDraggingRef.current) return;
    setImportStatus(null);
    setIsLoadingModel(true);
    let asset;
    try {
      asset = await loadLocalAsset(file);
      if (!asset.animations?.length) throw new Error('No animations were found in this file.');
      const imported = findCompatibleClip(asset.animations, bones, asset.format !== 'fbx');
      if (!imported) throw new Error('No animation tracks match the loaded rig.');

      replaceTimeline({ ...imported, animationName: imported.animationName || file.name.replace(/\.[^.]+$/, '') });
      const skippedCount = imported.skippedBones.length;
      setImportStatus({ message: skippedCount ? `Clip loaded. ${skippedCount} unmatched ${skippedCount === 1 ? 'bone' : 'bones'} skipped.` : 'Animation imported.' });
    } catch (error) {
      console.error('Animation import failed:', error);
      setImportStatus({ message: error.message, error: true });
    } finally {
      if (asset?.model) disposeModelResources(asset.model);
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
