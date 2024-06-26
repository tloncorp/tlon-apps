import perf from '@react-native-firebase/perf';

export type PerformanceMonitor = {
  startTrace: (traceName: string) => Promise<void>;
  stopTrace: (traceName: string) => Promise<void>;
};

export class FirebasePerformanceMonitor implements PerformanceMonitor {
  private traces: { [key: string]: any } = {};

  async startTrace(traceName: string) {
    if (!this.traces[traceName]) {
      this.traces[traceName] = perf().newTrace(traceName);
      await this.traces[traceName].start();
    }
  }

  async stopTrace(traceName: string) {
    if (this.traces[traceName]) {
      await this.traces[traceName].stop();
      delete this.traces[traceName];
    }
  }
}

let performanceMonitorInstance: PerformanceMonitor | null = null;

export function setPerformanceMonitor<T extends PerformanceMonitor>(client: T) {
  performanceMonitorInstance = client;
}

export const PerformanceMonitor = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!performanceMonitorInstance) {
        throw new Error('Performance monitor not set!');
      }
      return Reflect.get(performanceMonitorInstance, prop, receiver);
    },
  }
) as PerformanceMonitor;
