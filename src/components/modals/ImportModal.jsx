import { useState } from 'react';
import { useAnimation } from '../../contexts/AnimationContext';
import { validateImportedJson, parseImportedTracks } from '../../utils/animationHelpers';
import Dialog from './Dialog';

export default function ImportModal({ onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const { bones, setAnimationName, setAnimationDuration, setKeyFrames, setCurrentTime } = useAnimation();

  function importJson() {
    try {
      const data = JSON.parse(text);
      validateImportedJson(data);
      const { keyFrames } = parseImportedTracks(data.tracks, bones);
      if (!Object.keys(keyFrames).length) throw new Error('No keyframes match the loaded rig.');
      setAnimationName(data.name);
      setAnimationDuration(data.duration);
      setKeyFrames(keyFrames);
      setCurrentTime(0);
      onClose();
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <Dialog title="Import Keyframe JSON" onClose={onClose}>
      <label className="json-label" htmlFor="import-json">Paste the animation JSON for the currently loaded rig.</label>
      <textarea id="import-json" className="json-field" rows={12} value={text} onChange={event => { setText(event.target.value); setError(''); }} spellCheck={false} />
      {error && <p className="panel-message error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" onClick={importJson} disabled={!text.trim()}>Import JSON</button>
      </div>
    </Dialog>
  );
}
