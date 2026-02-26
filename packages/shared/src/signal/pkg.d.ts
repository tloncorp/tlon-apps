declare module './pkg/signal_core' {
  export default function init(): Promise<void>;
  export function deriveRootSecret(passphrase: string, salt: Uint8Array): Uint8Array;
  export function generateSalt(): Uint8Array;
}
