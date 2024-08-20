import { firebase } from '@react-native-firebase/perf';
import { PerformanceMonitoringEndpoint } from '@tloncorp/shared/dist/perf';

type Firebase = typeof firebase;

export class FirebasePerformanceMonitoringEndpoint
  implements PerformanceMonitoringEndpoint
{
  static shared = new FirebasePerformanceMonitoringEndpoint(firebase);

  constructor(private firebase: Firebase) {
    // instrumentationEnabled = automatic measurement of HTTP requests, other stuff?
    // Let's disable this until we need it to avoid overhead
    this.firebase.perf().instrumentationEnabled = false;
  }

  setEnabled(enabled: boolean) {
    firebase.perf().dataCollectionEnabled = enabled;
  }

  async startTrace(identifier: string) {
    return firebase.perf().startTrace(identifier);
  }
}
