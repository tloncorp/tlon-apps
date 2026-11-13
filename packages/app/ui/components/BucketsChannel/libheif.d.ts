declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    display(
      image: ImageData,
      callback: (result: ImageData | null) => void
    ): void;
    free(): void;
  }
  export default function createLibheif(): Promise<{
    HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] };
  }>;
}
