// Stub implementation of crashlytics for desktop environments
// This provides the same interface as @react-native-firebase/crashlytics
// but doesn't do anything

// Define the CrashlyticsStub interface to match the original implementation
interface CrashlyticsStub {
  setAttribute: (name: string, value: string) => void;
  // Add other methods as needed
  recordError: (error: Error, jsErrorName?: string) => void;
  log: (message: string) => void;
  setUserId: (userId: string) => void;
  setCrashlyticsCollectionEnabled: (enabled: boolean) => void;
}

// Create a stub implementation that does nothing
const crashlytics = (): CrashlyticsStub => {
  return {
    setAttribute: (name: string, value: string) => {
      // No-op in desktop environment
      console.log(`[Crashlytics Stub] setAttribute: ${name} = ${value}`);
    },
    recordError: (error: Error, jsErrorName?: string) => {
      // No-op in desktop environment
      console.log(`[Crashlytics Stub] recordError: ${error.message}`);
    },
    log: (message: string) => {
      // No-op in desktop environment
      console.log(`[Crashlytics Stub] log: ${message}`);
    },
    setUserId: (userId: string) => {
      // No-op in desktop environment
      console.log(`[Crashlytics Stub] setUserId: ${userId}`);
    },
    setCrashlyticsCollectionEnabled: (enabled: boolean) => {
      // No-op in desktop environment
      console.log(`[Crashlytics Stub] setCrashlyticsCollectionEnabled: ${enabled}`);
    }
  };
};

// Export default to match the original module's structure
export default crashlytics;
