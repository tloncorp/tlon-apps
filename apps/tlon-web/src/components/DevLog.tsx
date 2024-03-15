import { useMemo } from 'react';

import { useLocalState } from '@/state/local';

export default function DevLog() {
  const { logs } = useLocalState();
  const prettyLogs = useMemo(() => {
    return logs.map((log) => `${log}\n`).join('');
  }, [logs]);

  return (
    <div className="p-4 w-full h-full flex flex-col">
      <h1 className="text-xl font-bold mb-2">Developer Logs</h1>
      <div className="flex-1 bg-gray-100 rounded p-1 w-full sm:w-[80ch] overflow-y-scroll">
        <pre className="font-mono text-sm h-full">{prettyLogs}</pre>
      </div>
    </div>
  );
}
