import { useRef, useState } from 'react';
import { useAnimation } from '../../contexts/AnimationContext';
import { generateAnimationJson } from '../../utils/animationHelpers';
import { downloadAnimation } from '../../utils/download';
import { useKeyframes } from '../../hooks/useKeyframes';
import Dialog from './Dialog';

export default function JsonModal({ onClose }) {
  const { animationName, animationDuration, keyFrames } = useAnimation();
  const { totalKeyframeCount } = useKeyframes();
  const [status, setStatus] = useState('');
  const outputRef = useRef(null);
  const text = totalKeyframeCount ? generateAnimationJson(animationName, animationDuration, keyFrames) : '// No keyframes have been set.';

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
    } catch {
      outputRef.current.select();
      setStatus('Text selected. Use your browser’s copy shortcut.');
    }
  }

  return (
    <Dialog title="Animation JSON" onClose={onClose}>
      <textarea className="json-field" ref={outputRef} aria-label="Animation JSON data" rows={14} readOnly value={text} />
      <div className="modal-actions">
        <span className="panel-message" role="status">{status}</span>
        <button className="button secondary" onClick={copyJson} disabled={!totalKeyframeCount}>Copy</button>
        <button className="button primary" onClick={() => downloadAnimation(text, animationName, 'json', 'application/json')} disabled={!totalKeyframeCount}>Download JSON</button>
      </div>
    </Dialog>
  );
}
