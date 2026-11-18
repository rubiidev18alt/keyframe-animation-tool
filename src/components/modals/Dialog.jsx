import { useEffect, useId, useRef } from 'react';
import Icon from '../Icon';

export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="dialog-card">
        <div className="window-bar dialog-title">
          <h2 id={titleId} className="window-title">{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
