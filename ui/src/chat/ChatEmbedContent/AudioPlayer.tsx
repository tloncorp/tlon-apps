import React, { useCallback, useEffect, useRef, useState } from 'react';

function formatTime(num: number) {
  const minutes = Math.floor(num / 60);
  const seconds = Math.floor(num % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AudioPlayer(props: { url: string; title?: string }) {
  const { url, title = '' } = props;
  const ref = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);

  const playPause = useCallback(
    (e) => {
      e.stopPropagation();
      if (playing) {
        ref.current?.pause();
      } else {
        ref.current?.play();
      }
      setPlaying((p) => !p);
    },
    [ref, playing]
  );

  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (playing) {
      // eslint-disable-next-line no-inner-declarations
      function updateProgress() {
        setProgress(ref.current?.currentTime || 0);
      }

      const time = setInterval(updateProgress, 250);

      return () => time && clearTimeout(time);
    }
    return undefined;
  }, [ref, playing]);

  useEffect(() => {
    ref.current?.addEventListener('loadedmetadata', () => {
      setDuration(ref.current?.duration || 0);
    });
  }, []);

  return (
    <div className="flex h-full w-60 flex-col justify-center rounded-lg border-2 border-gray-50 bg-white p-2">
      <audio ref={ref} src={url} preload="metadata" />
      <button className="small-button mt-2" onClick={playPause}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <div className="mt-4 flex flex-row items-center space-x-2 text-sm">
        <span className="font-bold">Audio</span>
        <span className="text-gray-500">&middot;</span>
        {title ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="w-16 truncate text-gray-500 underline"
          >
            {title}
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="w-16 truncate text-gray-500"
          >
            {url}
          </a>
        )}
        <span className="text-gray-500">&middot;</span>
        <p>
          {formatTime(progress)} / {formatTime(duration)}
        </p>
      </div>
    </div>
  );
}
