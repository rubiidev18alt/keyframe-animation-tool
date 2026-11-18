import { useState } from 'react';
import Icon from './Icon';

export default function FilePicker({ id, accept, title, hint, disabled, onFile }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="file-input-wrapper">
      <input
        type="file"
        id={id}
        className="visually-hidden file-picker-input"
        accept={accept}
        disabled={disabled}
        onChange={event => {
          const [file] = event.target.files;
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <label
        htmlFor={id}
        className={`file-input-label${disabled ? ' disabled' : ''}${dragging ? ' drag-over' : ''}`}
        onDragOver={event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && event.dataTransfer.files.length) onFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="file-input-icon"><Icon name="upload" /></span>
        <span className="file-input-copy">
          <strong title={title}>{title}</strong>
          <small>{hint}</small>
        </span>
      </label>
    </div>
  );
}
