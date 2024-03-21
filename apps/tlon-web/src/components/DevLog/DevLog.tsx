import { useMemo } from 'react';

import { useIsMobile } from '@/logic/useMedia';
import { toggleDevTools, useLocalState } from '@/state/local';

export default function DevLog() {
  const isMobile = useIsMobile();
  const { logs } = useLocalState();
  const prettyLogs = useMemo(
    () => logs.map((log) => `${log}\n`).join(''),
    [logs]
  );

  return (
    <div className="h-full w-full">
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-4 flex">
          {!isMobile && <h1 className="text-xl font-bold">Developer Logs</h1>}
          <button
            className="small-button ml-auto flex-none self-center"
            onClick={toggleDevTools}
          >
            Toggle Tools
          </button>
        </div>
        <div className="w-full flex-1 overflow-y-scroll rounded bg-gray-100 p-1">
          <pre className="h-full font-mono text-sm">{prettyLogs}</pre>
        </div>
      </div>
    </div>
  );
}
