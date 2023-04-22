import React from 'react';
import BulletIcon from './icons/BulletIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';

interface RecorderProps {
  onRecord: (blob: Blob) => void;
}

export default function Recorder({ onRecord }: RecorderProps) {
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);

  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const rcrdr = new MediaRecorder(stream);
        rcrdr.start();
        setRecorder(rcrdr);
        setIsRecording(true);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const stopRecording = () => {
    if (!recorder) return;
    recorder.stop();
    setIsRecording(false);
  };

  React.useEffect(() => {
    if (!recorder) return;
    recorder.ondataavailable = (event) => {
      onRecord(event.data);
    };
  }, [recorder, onRecord]);

  return (
    <div>
      {isRecording ? (
        <button
          className="button"
          onClick={stopRecording}
          aria-label={'Stop Recording'}
        >
          <BulletIcon className="h-6 w-6 text-red" />
        </button>
      ) : (
        <button
          className="button"
          onClick={startRecording}
          aria-label={'Start Recording'}
        >
          <MicrophoneIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
