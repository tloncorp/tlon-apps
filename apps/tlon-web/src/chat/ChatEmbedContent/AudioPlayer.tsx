import React, {
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router';

import LightBox from '@/components/LightBox';

import { useChatDialog } from '../useChatStore';

function formatTime(num: number) {
  const minutes = Math.floor(num / 60);
  const seconds = Math.floor(num % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AudioPlayer({
  url,
  title,
  embed,
  writId,
}: {
  url: string;
  title?: string;
  embed?: boolean;
  writId?: string;
}) {
  const { chShip, chName } = useParams<{
    chShip: string;
    chName: string;
  }>();
  const whom = `${chShip}/${chName}`;
  const { open: showModal, setOpen: setShowModal } = useChatDialog(
    whom,
    writId || 'not-writ',
    'audio'
  );

  const ref = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const playPause = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const audio = ref.current;

      if (!audio) {
        return;
      }

      if (playing) {
        audio.pause();
      } else {
        audio.play();
      }
      setPlaying(!playing);
    },
    [ref, playing, setPlaying]
  );

  useEffect(() => {
    if (playing) {
      // eslint-disable-next-line no-inner-declarations
      function updateProgress() {
        setProgress(ref.current?.currentTime || 0);
      }

      const time = setInterval(updateProgress, 250);

      return () => time && clearInterval(time);
    }
    return undefined;
  }, [ref, playing]);

  useEffect(() => {
    const audio = ref?.current;
    const updateDuration = () => {
      setDuration(audio?.duration || 0);
    };
    audio?.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio?.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [ref]);

  return (
    <>
      <div className="flex h-20 w-60 flex-col justify-center rounded-lg border-2 border-gray-50 bg-white p-2">
        {!embed && <audio ref={ref} src={url} preload="metadata" />}
        <button
          className="small-button"
          onClick={embed ? () => setShowModal(true) : playPause}
        >
          {!embed && playing ? 'Pause' : 'Play'}
        </button>
        <div className="flex flex-row items-center space-x-2 pt-4 text-sm">
          <span className="font-bold">Audio</span>
          <span className="text-gray-500">&middot;</span>
          {title ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-gray-500 underline"
            >
              {title}
            </a>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="w-24 truncate text-gray-500"
            >
              {url}
            </a>
          )}
          {embed ? null : (
            <>
              <span className="text-gray-500">&middot;</span>
              <p>
                {formatTime(progress)} / {formatTime(duration)}
              </p>
            </>
          )}
        </div>
      </div>
      {embed && (
        <LightBox
          showLightBox={showModal}
          setShowLightBox={setShowModal}
          source={url}
        >
          <div className="mt-2 flex h-20 w-60 flex-col justify-center rounded-lg border-2 border-gray-50 bg-white p-2">
            <audio ref={ref} src={url} preload="metadata" />
            <button className="small-button" onClick={playPause}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <div className="flex flex-row items-center space-x-2 pt-4 text-sm">
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
        </LightBox>
      )}
    </>
  );
}

export default React.memo(AudioPlayer);
