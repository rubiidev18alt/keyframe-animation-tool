import Icon from './Icon';
import { useAnimation } from '../contexts/AnimationContext';

function RigSchematic() {
  return (
    <svg className="rig-schematic" viewBox="0 0 152 100" fill="none" aria-hidden="true">
      <path d="M13 29v-13h13m100 0h13v13M13 71v13h13m100 0h13V71" stroke="currentColor" opacity=".65" />
      <path d="M29 64 76 47l47 17-47 22-47-22Zm12-4 47 20m-34-24 47 18M64 80l47-21M51 74l47-18M76 47v39M29 64h94" stroke="currentColor" opacity=".24" />
      <path d="M40 27h72M40 73h72M76 16v68" stroke="currentColor" opacity=".24" strokeDasharray="2 5" />
      <path d="m54 35 22-12 22 12-22 12-22-12Zm0 0v24l22 12 22-12V35m-22 12v24m0-48v-5m22 41 11 5m-55-5-11 5" stroke="currentColor" strokeWidth="1.35" />
      <path d="m76 18-3.5-3.5L76 11l3.5 3.5L76 18Zm0 33-4-4 4-4 4 4-4 4Zm0 24-4-4 4-4 4 4-4 4ZM54 38l-3-3 3-3 3 3-3 3Zm44 0-3-3 3-3 3 3-3 3Z" fill="currentColor" />
      <path d="M39 63h5v5h-5zm69 0h5v5h-5z" fill="currentColor" opacity=".6" />
    </svg>
  );
}

export default function Viewport({ viewportRef, sceneError, viewportUnavailable, onClickPickModel }) {
  const { currentTime, animationDuration, seekToTime, isLoadingModel, isSceneReady, isPlaying, bones } = useAnimation();
  return (
    <section className="viewport-panel" aria-label="3D viewport">
      <div className="window-bar viewport-toolbar">
        <h2 className="window-title"><Icon name="box" /> Viewport <span className="window-id">/ 01</span></h2>
        <div className="time-controls">
          <label htmlFor="time-input"><Icon name="clock" /><span>Time</span></label>
          <input
            id="time-input"
            type="number"
            className="toolbar-input"
            min="0"
            max={animationDuration}
            step="0.0001"
            value={currentTime}
            onChange={event => seekToTime(event.target.valueAsNumber)}
            disabled={!isSceneReady || isPlaying || isLoadingModel}
          />
          <span className="time-duration">/ {animationDuration.toFixed(2)} s</span>
        </div>
      </div>

      <div ref={viewportRef} className={`viewport-container${isSceneReady ? ' has-rig' : ''}`}>
        <div className="viewport-hud" aria-hidden="true">
          <span><i /> Perspective</span>
          <span className="grid-caption">GRID / 50</span>
        </div>
        {(isLoadingModel || !isSceneReady) && (
          <div className="viewport-overlay">
            <div className="viewport-empty">
              <RigSchematic />
              <span className="viewport-kicker">{sceneError ? 'INPUT ERROR' : isLoadingModel ? 'READING FILE' : 'AWAITING INPUT'}</span>
              <h3>{isLoadingModel ? 'Loading scene…' : sceneError ? 'Scene unavailable' : 'No model loaded'}</h3>
              <p role={sceneError ? 'alert' : undefined}>{sceneError || 'Load an FBX rig to pose bones and start keyframing.'}</p>
              {!isLoadingModel && !viewportUnavailable && (
                <button className="button primary empty-action" onClick={onClickPickModel}>
                  <Icon name="upload" /> Choose FBX model
                </button>
              )}
            </div>
          </div>
        )}
        <svg className="viewport-axes" viewBox="0 0 64 53" fill="none" aria-label="Axis color legend" role="img">
          <path d="M25 32V12" stroke="#83dab8" />
          <path d="m25 32 19 8" stroke="#ef947c" />
          <path d="m25 32-13 10" stroke="#8fbcf2" />
          <circle cx="25" cy="32" r="2" fill="#dce8e8" />
          <text x="22" y="10" fill="#83dab8">Y</text>
          <text x="47" y="44" fill="#ef947c">X</text>
          <text x="4" y="49" fill="#8fbcf2">Z</text>
        </svg>
      </div>
      <div className="viewport-footer">
        <span className="viewport-state"><i className={`signal${isSceneReady ? ' online' : ''}`} />{isSceneReady ? `${bones.length} ${bones.length === 1 ? 'bone' : 'bones'}` : 'No rig'}</span>
        <span className="viewport-guide"><kbd>DRAG</kbd> Orbit <kbd>SHIFT+DRAG</kbd> Pan <kbd>SCROLL</kbd> Zoom</span>
      </div>
    </section>
  );
}
