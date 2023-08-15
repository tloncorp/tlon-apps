import { useEffect, useRef } from 'react';
import '@tloncorp/eyrie';
import cn from 'classnames';
import { startEyrie } from '@tloncorp/eyrie';
import { useShowDevTools } from '@/state/local';
import api from '@/api';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'tlon-eyrie': any;
    }
  }
}

export default function Eyrie() {
  const show = useShowDevTools();

  useEffect(() => {
    if (show) {
      startEyrie({ api });
    }
  }, [show]);

  return (
    <tlon-eyrie
      class={cn('fixed bottom-4 right-4', {
        hidden: !show,
      })}
    />
  );
}
