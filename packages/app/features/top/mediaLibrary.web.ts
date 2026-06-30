// Web stub for the native-only expo-media-library; never invoked on web.
export const Asset = {
  async create(_filePath: string): Promise<never> {
    throw new Error('expo-media-library is not available on web');
  },
};

export async function requestPermissionsAsync(): Promise<never> {
  throw new Error('expo-media-library is not available on web');
}
