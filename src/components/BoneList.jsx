import { useLayoutEffect, useRef } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import Icon from './Icon';
import Section from './Section';

export default function BoneList({ active }) {
  const { bones, selectedBoneName, setSelectedBoneName, isPlaying, isGizmoDraggingRef, isLoadingModel, keyFrames } = useAnimation();
  const listRef = useRef(null);
  const selectedRef = useRef(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const button = selectedRef.current;
    if (!active || !list || !button) return;
    const bounds = list.getBoundingClientRect();
    const item = button.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
    else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  }, [active, bones, selectedBoneName]);

  return (
    <Section index="01" title="Bones" detail={`${bones.length} JOINTS`}>
      <ul ref={listRef} className="bone-list" aria-label="Bones">
        {bones.map(({ name }) => (
          <li key={name}>
            <button
              className="bone-item"
              ref={name === selectedBoneName ? selectedRef : null}
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
