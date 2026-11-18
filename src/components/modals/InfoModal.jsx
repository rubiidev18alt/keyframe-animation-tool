import Dialog from './Dialog';

const repository = 'https://github.com/rubiidev18alt/keyframe-animation-tool';
const shortcuts = [
  ['Space', 'Play / pause'],
  ['S or K', 'Set or update keyframe'],
  ['Delete / Backspace', 'Delete current keyframe'],
  ['← / →', 'Previous / next frame'],
  ['[ / ]', 'Previous / next keyframe on the selected bone'],
  ['Shift + ← / →', 'Jump by 0.1 seconds'],
  ['Home / End', 'Start / end of timeline'],
];

export default function InfoModal({ onClose }) {
  return (
    <Dialog title="Workbench help" onClose={onClose}>
      <p>Keyframe Animation Tool runs in your browser. Model and animation files are not uploaded.</p>
      <h3>Quick start</h3>
      <ol>
        <li>In <strong>Scene</strong>, choose an FBX or GLB model with a skeleton, or load the built-in demo rig.</li>
        <li>Open <strong>Animate</strong>, choose a bone, and rotate it with the gizmo or the local rotation fields.</li>
        <li>Set a key. Move the playhead, change the pose, and set another key.</li>
        <li>Click a key to snap to its pose. Choose <strong>Step</strong> to hold poses or <strong>Smooth</strong> to interpolate between keys. The mode also applies to exports.</li>
      </ol>
      <h3>Export formats</h3>
      <ul>
        <li><strong>FBX</strong>: skeleton and animation only, for use with the matching rig.</li>
        <li><strong>GLB</strong>: model and animation together.</li>
        <li><strong>JSON</strong>: editable keyframe data to bring back into the workbench.</li>
      </ul>
      <h3>Keyboard shortcuts</h3>
      <dl className="shortcut-list">
        {shortcuts.map(([keys, action]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}
      </dl>
      <div className="modal-actions">
        <a className="button secondary" href={repository} target="_blank" rel="noreferrer">Source</a>
        <a className="button secondary" href={`${repository}/releases/latest`} target="_blank" rel="noreferrer">Offline releases</a>
        <button className="button primary" onClick={onClose}>Done</button>
      </div>
    </Dialog>
  );
}
