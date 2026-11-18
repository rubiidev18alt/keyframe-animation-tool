import { useAnimation } from '../contexts/AnimationContext';
import Icon from './Icon';
import Section from './Section';

export default function BoneList() {
  const { bones, selectedBoneName, setSelectedBoneName, isPlaying, isGizmoDraggingRef, isLoadingModel, keyFrames } = useAnimation();
  return (
    <Section index="01" title="Bones" detail={`${bones.length} JOINTS`}>
      <ul className="bone-list" aria-label="Bones">
        {bones.map(({ name }) => (
          <li key={name}>
            <button
              className="bone-item"
              aria-pressed={name === selectedBoneName}
              disabled={isPlaying || isLoadingModel}
              onClick={() => !isGizmoDraggingRef.current && setSelectedBoneName(name)}
              title={name}
            >
              <Icon name="bone" /> <span>{name}</span>
              {Object.hasOwn(keyFrames, name) && keyFrames[name]?.length > 0 && <i className="bone-keyed" title="Animated bone" />}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
