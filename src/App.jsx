import { useEffect, useRef, useState } from 'react';
import { AnimationProvider, useAnimation } from './contexts/AnimationContext';
import { useSceneManager } from './hooks/useSceneManager';
import { useKeyframes } from './hooks/useKeyframes';
import { usePlayback } from './hooks/usePlayback';
import { useKeyframeNavigation } from './hooks/useKeyframeNavigation';
import { FRAME_RATE } from './utils/animationTracks';
import Timeline from './components/Timeline';
import BoneList from './components/BoneList';
import TransformPanel from './components/TransformPanel';
import ExportImportPanel from './components/ExportImportPanel';
import JsonModal from './components/modals/JsonModal';
import ImportModal from './components/modals/ImportModal';
import InfoModal from './components/modals/InfoModal';
import FilePicker from './components/FilePicker';
import Icon from './components/Icon';
import Section from './components/Section';
import Viewport from './components/Viewport';
import logo from './assets/icon.svg';

function AppContent() {
  const viewportRef = useRef(null);
  const [activeTab, setActiveTab] = useState('scene');
  const [dialog, setDialog] = useState(null);
  const {
    isLoadingModel, isSceneReady, isPlaying, animationName, interpolation,
    setAnimationName, animationDuration, setAnimationDuration, currentTime, setCurrentTime, seekToTime,
    bones, isGizmoDraggingRef,
  } = useAnimation();
  const { handleLoadModel, handleLoadDemo, modelSource, sceneError, viewportUnavailable } = useSceneManager(viewportRef);
  const { setKeyframeFromUI, deleteKeyframeAtCurrentTime, totalKeyframeCount } = useKeyframes();
  const playback = usePlayback();
  const { togglePlayback } = playback;
  const keyframeNavigation = useKeyframeNavigation();
  const { jumpToKeyframe } = keyframeNavigation;

  const animateEnabled = isSceneReady && bones.length > 0;
  const modelInputDisabled = isPlaying || isLoadingModel || viewportUnavailable;
  const editingDisabled = !animateEnabled || isLoadingModel || isPlaying;

  function loadModel(file) {
    if (!modelInputDisabled && !isGizmoDraggingRef.current) handleLoadModel(file);
  }

  async function loadDemo() {
    if (modelInputDisabled || isGizmoDraggingRef.current) return;
    if (totalKeyframeCount && !window.confirm('Replace the current model and its keyframes with the demo rig?')) return;
    if (await handleLoadDemo()) setActiveTab('animate');
  }

  useEffect(() => {
    const preventFileNavigation = event => event.preventDefault();
    window.addEventListener('dragover', preventFileNavigation);
    window.addEventListener('drop', preventFileNavigation);
    return () => {
      window.removeEventListener('dragover', preventFileNavigation);
      window.removeEventListener('drop', preventFileNavigation);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = event => {
      if (dialog || !animateEnabled || isLoadingModel || isGizmoDraggingRef.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === ' ') {
        if (event.target instanceof Element && event.target.closest('button:focus-visible, a:focus-visible')) return;
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (isPlaying) return;

      const key = event.key.toLowerCase();
      if (key === 's' || key === 'k') setKeyframeFromUI();
      else if (key === 'delete' || key === 'backspace') deleteKeyframeAtCurrentTime();
      else if (key === '[' || key === ']') jumpToKeyframe(key === '[' ? -1 : 1);
      else if (key === 'home') seekToTime(0);
      else if (key === 'end') seekToTime(animationDuration);
      else if (key === 'arrowleft' || key === 'arrowright') {
        const direction = key === 'arrowleft' ? -1 : 1;
        const time = event.shiftKey ? currentTime + direction * 0.1 : (Math.round(currentTime * FRAME_RATE) + direction) / FRAME_RATE;
        seekToTime(Number(time.toFixed(4)));
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, animateEnabled, isPlaying, isLoadingModel, isGizmoDraggingRef, currentTime, animationDuration, seekToTime, togglePlayback, jumpToKeyframe, setKeyframeFromUI, deleteKeyframeAtCurrentTime]);

  return (
    <div className="app-container">
      <header className="titlebar">
        <div className="brand">
          <img src={logo} alt="" width="43" height="43" />
          <div className="brand-text">
            <h1>Keyframe <span>Animation Tool</span></h1>
            <span className="brand-subtitle">Skeletal animation workbench</span>
          </div>
          <span className="version" title={`Version ${__APP_VERSION__}`}>V{__APP_VERSION__}</span>
        </div>
        <div className="titlebar-actions">
          <span className="session-label"><i className="signal online" /> Local session</span>
          <button className="button secondary" onClick={() => setDialog('json')} disabled={!isSceneReady} title="View Animation JSON" aria-label="View JSON"><Icon name="code" /> <span>View JSON</span></button>
          <button className="button secondary" onClick={() => setDialog('info')} title="Help and keyboard shortcuts" aria-label="Help and keyboard shortcuts"><Icon name="info" /> <span>Help</span></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-panel" aria-label="Project controls">
          <div className="window-bar project-bar">
            <h2 className="window-title"><Icon name="layers" /> Project</h2>
            <span className="window-id">KAT / EDIT</span>
          </div>
          <div className="panel-tabs" aria-label="Project view">
            <button className={`tab-button${activeTab === 'scene' || !animateEnabled ? ' active' : ''}`} aria-pressed={activeTab === 'scene' || !animateEnabled} onClick={() => setActiveTab('scene')}><Icon name="box" /> Scene</button>
            <button className={`tab-button${activeTab === 'animate' && animateEnabled ? ' active' : ''}`} aria-pressed={activeTab === 'animate' && animateEnabled} onClick={() => setActiveTab('animate')} disabled={!animateEnabled}><Icon name="bone" /> Animate</button>
          </div>

          <div className="tab-content" hidden={activeTab === 'animate' && animateEnabled}>
            <Section index="01" title="Model source">
              <FilePicker
                id="model-file-input"
                accept=".fbx,.glb,.gltf"
                title={modelSource?.name ?? 'Import model'}
                hint={isSceneReady ? 'Replace FBX, GLB or GLTF' : 'Drop FBX, GLB or GLTF here'}
                onFile={loadModel}
                disabled={modelInputDisabled}
              />
              <button className="button secondary wide" onClick={loadDemo} disabled={modelInputDisabled} title="Try the built-in Relay R-07 rig">
                <Icon name="robot" /> Load demo rig <span className="button-format">R-07</span>
              </button>
              {isSceneReady && !animateEnabled && <p className="section-hint">No skeleton found. Load a rigged model to keyframe bones.</p>}
            </Section>

            <Section index="02" title="Animation setup">
              <div className="form-row">
                <label htmlFor="animation-name">Name</label>
                <input id="animation-name" type="text" value={animationName} maxLength={128} onChange={event => setAnimationName(event.target.value)} disabled={editingDisabled} />
              </div>
              <div className="form-row">
                <label htmlFor="animation-duration">Duration</label>
                <div className="unit-field">
                  <input id="animation-duration" type="number" value={animationDuration} min="0.0001" step="0.0001" onChange={event => {
                    const duration = event.target.valueAsNumber;
                    if (!Number.isFinite(duration) || duration <= 0) return;
                    setAnimationDuration(duration);
                    if (currentTime > duration) setCurrentTime(duration);
                  }} disabled={editingDisabled} />
                  <span aria-hidden="true">sec</span>
                </div>
              </div>
            </Section>
            <ExportImportPanel key={modelSource?.id} onImportJson={() => setDialog('import')} />
          </div>

          <div className="tab-content" hidden={activeTab === 'scene' || !animateEnabled}>
            <BoneList active={activeTab === 'animate' && animateEnabled} />
            <TransformPanel />
          </div>
          <div className="project-footer"><span>CLIP DATA</span><span>{totalKeyframeCount} {totalKeyframeCount === 1 ? 'KEYFRAME' : 'KEYFRAMES'}</span></div>
        </aside>

        <main className="main-area">
          <Viewport
            viewportRef={viewportRef}
            sceneError={sceneError}
            viewportUnavailable={viewportUnavailable}
            onClickPickModel={() => document.getElementById('model-file-input').click()}
            onLoadDemo={loadDemo}
          />
          <Timeline key={modelSource?.id} playback={playback} keyframeNavigation={keyframeNavigation} />
        </main>
      </div>

      <footer className="status-bar">
        <span className="system-status"><i className={`signal ${sceneError ? 'fault' : 'online'}`} />{isLoadingModel ? 'Reading file' : sceneError ? 'Check viewport' : isPlaying ? 'Playing clip' : animateEnabled ? 'Rig ready' : isSceneReady ? 'Model ready' : 'Ready'}</span>
        <span className="privacy-status">Your files stay on this device</span>
        <span className="fps-status">{FRAME_RATE} FPS <b>//</b> {interpolation}</span>
      </footer>

      {dialog === 'json' && <JsonModal onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportModal onClose={() => setDialog(null)} />}
      {dialog === 'info' && <InfoModal onClose={() => setDialog(null)} />}
    </div>
  );
}

export default function App() {
  return <AnimationProvider><AppContent /></AnimationProvider>;
}
