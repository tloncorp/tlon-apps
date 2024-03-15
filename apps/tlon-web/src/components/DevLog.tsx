import { useMemo } from 'react';

import { useBottomPadding } from '@/logic/position';
import { toggleDevTools, useLocalState } from '@/state/local';

export default function DevLog() {
  const { paddingBottom } = useBottomPadding();
  const { logs } = useLocalState();
  const prettyLogs = useMemo(() => {
    return logs.map((log) => `${log}\n`).join('');
  }, [logs]);

  return (
    <div className="w-full h-full" style={{ paddingBottom }}>
      <div className="p-4 w-full sm:w-[80ch] h-full flex flex-col">
        <div className="flex mb-2">
          <h1 className="text-xl font-bold">Developer Logs</h1>
          <button
            className="small-button ml-auto flex-none self-center"
            onClick={toggleDevTools}
          >
            Toggle Tools
          </button>
        </div>
        <div className="flex-1 bg-gray-100 rounded p-1 w-full overflow-y-scroll">
          <pre className="font-mono text-sm h-full">{prettyLogs}</pre>
        </div>
      </div>
    </div>
  );
}
