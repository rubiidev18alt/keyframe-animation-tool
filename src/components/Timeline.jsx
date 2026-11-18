import { useState } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { FRAME_RATE } from '../utils/steppedAnimation';
import Icon from './Icon';

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

export default function Timeline({ playback }) {
  const {
    animationDuration, currentTime, seekToTime, keyFrames, selectedBoneName, setSelectedBoneName,
    isSceneReady, isPlaying, isLoadingModel, isGizmoDraggingRef,
  } = useAnimation();
  const [showAllTracks, setShowAllTracks] = useState(false);
  const { canPlay, togglePlayback, stopPlayback } = playback;
  const animatedBones = Object.keys(keyFrames).filter(name => keyFrames[name]?.length).sort((a, b) => a.localeCompare(b));
  const expanded = showAllTracks && animatedBones.length > 0;
  const visibleBones = expanded ? animatedBones : [selectedBoneName];
  const canSeek = isSceneReady && !isPlaying && !isLoadingModel;

  function seek(time, name) {
    if (!canSeek || isGizmoDraggingRef.current) return;
    if (name) setSelectedBoneName(name);
    seekToTime(time);
  }

  function seekFromClick(event) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const time = (event.clientX - left) / width * animationDuration;
    seek(Number(time.toFixed(4)));
  }

  const playhead = `${Math.min(1, currentTime / animationDuration) * 100}%`;
  const frame = Math.round(currentTime * FRAME_RATE);
  const frameCount = Math.round(animationDuration * FRAME_RATE);

  return (
    <section className="timeline-container" aria-label="Timeline" style={{ '--playhead': playhead }}>
      <div className="window-bar timeline-header">
        <h2 className="window-title"><Icon name="layers" /> Timeline <span className="window-id">/ 02</span></h2>
        <div className="timeline-transport" aria-label="Playback controls">
          <button className="icon-button" title="Previous frame" aria-label="Previous frame" onClick={() => seek(Number(((frame - 1) / FRAME_RATE).toFixed(4)))} disabled={!canSeek}><Icon name="previous" /></button>
          <button className="icon-button transport-play" title={isPlaying ? 'Pause (Space)' : 'Play (Space)'} aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback} disabled={!canPlay}><Icon name={isPlaying ? 'pause' : 'play'} /></button>
          <button className="icon-button" title="Stop and rewind" aria-label="Stop" onClick={stopPlayback} disabled={!isPlaying}><Icon name="stop" /></button>
          <button className="icon-button" title="Next frame" aria-label="Next frame" onClick={() => seek(Number(((frame + 1) / FRAME_RATE).toFixed(4)))} disabled={!canSeek}><Icon name="next" /></button>
        </div>
        <div className="timeline-readout">FRAME <strong>{String(frame).padStart(3, '0')}</strong> <span>/ {String(frameCount).padStart(3, '0')}</span></div>
      </div>

      <div className="timeline-body">
        <div className="track-layout timeline-ruler">
          <button className="track-toggle" onClick={() => setShowAllTracks(value => !value)} aria-expanded={expanded} disabled={!animatedBones.length} title={expanded ? 'Collapse tracks' : 'Show all animated bones'}>
            <Icon name={expanded ? 'collapse' : 'expand'} /> Tracks {animatedBones.length > 0 && <span>{animatedBones.length}</span>}
          </button>
          <div className="track-inset">
            <div className="ruler-scale" onClick={seekFromClick}>
              {TICKS.map((fraction, index) => (
                <span key={fraction} className={`ruler-tick tick-${index}`} style={{ left: `${fraction * 100}%` }}>
                  {(fraction * animationDuration).toFixed(2)}s
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="timeline-rows">
          {visibleBones.map(name => {
            const track = name && Object.hasOwn(keyFrames, name) ? keyFrames[name] : [];
            return <div className={`track-layout timeline-row${name && name === selectedBoneName ? ' selected-track' : ''}`} key={name ?? 'empty'}>
              <button className="timeline-track-label" title={name ?? 'No bone selected'} aria-pressed={Boolean(name && name === selectedBoneName)} disabled={!name || !canSeek} onClick={() => name && !isGizmoDraggingRef.current && setSelectedBoneName(name)}>
                <Icon name="bone" /> <span>{name || 'No bone'}</span>
              </button>
              <div className="track-inset">
                <div className="track-grid" onClick={seekFromClick}>
                  <span className="timeline-playhead" aria-hidden="true" />
                  {!track.length && <span className="track-empty">{isSceneReady ? 'No keys on this track' : 'Load a rig to begin'}</span>}
                  {track.filter(key => key.time >= 0 && key.time <= animationDuration).map(key => (
                    <button
                      key={key.time}
                      className={`timeline-marker${Math.abs(key.time - currentTime) < 0.0001 ? ' at-key' : ''}`}
                      style={{ left: `${key.time / animationDuration * 100}%` }}
                      title={`${name} at ${key.time}s`}
                      aria-label={`Snap to ${name} keyframe at ${key.time} seconds`}
                      disabled={!canSeek}
                      onClick={event => { event.stopPropagation(); seek(key.time, name); }}
                    />
                  ))}
                </div>
              </div>
            </div>;
          })}
        </div>
        <div className="track-layout timeline-scrubber">
          <span className="timeline-mode" title="Each pose holds until the next keyframe"><i /> Stepped</span>
          <input className="timeline-slider" type="range" aria-label="Scrub timeline" min="0" max={animationDuration} step="0.0001" value={currentTime} onChange={event => seek(event.target.valueAsNumber)} disabled={!canSeek} />
        </div>
      </div>
    </section>
  );
}
