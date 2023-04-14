import React, { useEffect, useRef } from 'react';
import type { Eyrie as Eyr } from '@tloncorp/eyrie';
import api from '@/api';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'tlon-eyrie': any;
    }
  }
}

if (import.meta.env.DEV) {
  await import('@tloncorp/eyrie');
}

export default function Eyrie() {
  const ref = useRef<Eyr>(null);

  useEffect(() => {
    ref.current?.init({ api });
  }, []);

  return <tlon-eyrie ref={ref} class="fixed bottom-4 right-4" />;
}
