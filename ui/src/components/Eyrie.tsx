import { useEffect, useRef } from 'react';
import '@tloncorp/eyrie';
import cn from 'classnames';
import type { Eyrie as Eyr } from '@tloncorp/eyrie';
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
  const ref = useRef<Eyr>(null);
  const showDevTools = useShowDevTools();
  const show = showDevTools || import.meta.env.DEV;

  useEffect(() => {
    if (!ref.current?.init) return;
    if (show) {
      console.log('initing eyrie');
      if (showDevTools) {
        api.reset();
        setTimeout(() => {
          ref.current?.init({ api });
        }, 1000);
      } else {
        ref.current?.init({ api });
      }
    }
  }, [show, showDevTools]);

  return (
    <tlon-eyrie
      ref={ref}
      class={cn('fixed bottom-4 right-4', {
        hidden: !show,
      })}
    />
  );
}
