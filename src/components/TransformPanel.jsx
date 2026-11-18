import { useAnimation } from '../contexts/AnimationContext';
import { useKeyframes } from '../hooks/useKeyframes';
import { eulerToQuaternion } from '../utils/animationHelpers';
import Section from './Section';

const AXES = ['x', 'y', 'z'];

function TransformFields({ type, value, disabled, onChange }) {
  const rotation = type === 'Rotation';
  return (
    <fieldset className="transform-section">
      <legend>{type} <span>{rotation ? '° / LOCAL' : 'READ ONLY'}</span></legend>
      <div className="transform-grid">
        {AXES.map(axis => (
          <label key={axis} className="transform-field">
            <span className={`axis-label ${axis}`}>{axis.toUpperCase()}</span>
            <input
              className="transform-input"
              type="number"
              aria-label={`${type} ${axis.toUpperCase()}`}
              value={rotation ? Number(value[axis].toFixed(2)) : value[axis].toFixed(3)}
              step={rotation ? 1 : 0.01}
              readOnly={!rotation}
              disabled={rotation && disabled}
              onChange={event => onChange?.(axis, event.target.valueAsNumber)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function TransformPanel() {
  const {
    selectedBoneName, isSceneReady, isPlaying, isLoadingModel, boneRotationUI, setBoneRotationUI,
    bonePositionUI, setLivePose, isGizmoDraggingRef,
  } = useAnimation();
  const { setKeyframeFromUI, deleteKeyframeAtCurrentTime, hasKeyframeAtCurrentTime, selectedBoneKeyframeCount } = useKeyframes();
  if (!selectedBoneName || !isSceneReady) return null;
  const disabled = isPlaying || isLoadingModel;

  function rotate(axis, value) {
    if (disabled || isGizmoDraggingRef.current || !Number.isFinite(value)) return;
    const rotation = { ...boneRotationUI, [axis]: value };
    setBoneRotationUI(rotation);
    const quaternion = eulerToQuaternion(rotation);
    setLivePose(pose => ({ ...pose, [selectedBoneName]: { position: { ...bonePositionUI }, quaternion } }));
  }

  return (
    <>
      <Section index="02" title="Transform">
        <p className="selection-name" title={selectedBoneName}>{selectedBoneName}</p>
        <TransformFields type="Position" value={bonePositionUI} />
        <TransformFields type="Rotation" value={boneRotationUI} disabled={disabled} onChange={rotate} />
      </Section>
      <Section index="03" title="Keyframe" detail={`${selectedBoneKeyframeCount} ON TRACK`}>
        <div className="button-group key-actions">
          <button className="button primary" disabled={disabled} onClick={() => !isGizmoDraggingRef.current && setKeyframeFromUI()} title="Set keyframe (S or K)">{hasKeyframeAtCurrentTime ? 'Update Key' : 'Set Key'}</button>
          <button className="button secondary" disabled={disabled || !hasKeyframeAtCurrentTime} onClick={() => !isGizmoDraggingRef.current && deleteKeyframeAtCurrentTime()} title="Delete keyframe (Delete)">Delete Key</button>
        </div>
        <p className="section-hint">Click a key on the timeline to snap to its pose.</p>
      </Section>
    </>
  );
}
