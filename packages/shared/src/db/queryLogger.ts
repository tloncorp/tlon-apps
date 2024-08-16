export type QueryLogLine = [
  timestamp: number,
  label: string,
  durationMs: number,
];
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace QueryLogLine {
  export function create(
    timestamp: number,
    label: string,
    durationMs: number
  ): QueryLogLine {
    return [timestamp, label, durationMs];
  }

  export function timestamp(log: QueryLogLine): number {
    return log[0];
  }
  export function label(log: QueryLogLine): string {
    return log[1];
  }
  export function durationMs(log: QueryLogLine): number {
    return log[2];
  }
}

export class QueryLogger {
  static shared = new QueryLogger();

  // Set to `false` to enable logging from app start
  paused: boolean = true;

  private logs: QueryLogLine[] = [];

  log(label: string, durationMs: number) {
    if (this.paused) {
      return;
    }
    this.logs.push(QueryLogLine.create(Date.now(), label, durationMs));
  }

  clear() {
    this.logs = [];
  }

  toCsv(): string | null {
    if (this.logs.length === 0) {
      return null;
    }

    const grouped: { [timestamp: number]: { [label: string]: QueryLogLine } } =
      {};
    const allLabels: Set<string> = new Set();
    for (const log of this.logs) {
      const timestamp = QueryLogLine.timestamp(log);
      const label = QueryLogLine.label(log);
      allLabels.add(label);
      if (!grouped[timestamp]) {
        grouped[timestamp] = {};
      }
      grouped[timestamp][label] = log;
    }
    const sortedLabels = Array.from(allLabels).sort();
    const dataLines = Object.entries(grouped)
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(
        ([timestamp, logs]) =>
          `${timestamp},${sortedLabels.map((label) => (logs[label] == null ? '' : QueryLogLine.durationMs(logs[label]))).join(',')}`
      );

    return [`timestamp,${sortedLabels.join(',')}`, ...dataLines].join('\n');
  }
}
