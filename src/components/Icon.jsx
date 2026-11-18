const paths = {
  box: 'M8 1.7 14.3 5.2v5.6L8 14.3l-6.3-3.5V5.2L8 1.7ZM2 5.2 8 8.6l6-3.4M8 8.6v5.6',
  bone: 'M8 1.8 12.2 6 8 14.2 3.8 6 8 1.8ZM3.8 6h8.4',
  robot: 'M3 5h10v8H3zM8 5V2m-1.5 0h3M1.5 7v3m13-3v3M5.5 8h.5m4 0h.5M6.5 11h3',
  upload: 'M8 10.5v-8m-3 3 3-3 3 3M2.7 9v4.4h10.6V9',
  download: 'M8 2.5v8m-3-3 3 3 3-3M2.7 10.5v3h10.6v-3',
  code: 'm5 4-3.5 4L5 12m6-8 3.5 4-3.5 4M9 3l-2 10',
  info: 'M8 14.4a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8ZM8 7.2v3.9m0-6.4v.2',
  clock: 'M8 14.4a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8ZM8 4.4V8l2.8 1.5',
  layers: 'm8 2 6.4 3.5L8 9 1.6 5.5 8 2ZM1.6 8.4 8 12l6.4-3.6M1.6 11.4 8 15l6.4-3.6',
  close: 'm3.5 3.5 9 9m0-9-9 9',
  expand: 'm4 6 4 4 4-4',
  collapse: 'm4 10 4-4 4 4',
  backFrame: 'm10 3.5-5 4.5 5 4.5',
  forwardFrame: 'm6 3.5 5 4.5-5 4.5',
  previous: 'M3.4 3v10M12.4 3.7 6 8l6.4 4.3V3.7Z',
  next: 'M12.6 3v10M3.6 3.7 10 8l-6.4 4.3V3.7Z',
};

const fills = {
  play: 'M5 2.5 13 8l-8 5.5Z',
  pause: 'M4 3h2.6v10H4zm5.4 0H12v10H9.4z',
  stop: 'M3.5 3.5h9v9h-9z',
};

export default function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      {fills[name]
        ? <path d={fills[name]} fill="currentColor" />
        : <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
}
