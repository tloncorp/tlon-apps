// Lazy WASM loader singleton — caches the init promise so we only
// load/compile the module once. Retries on failure.

interface SignalCoreModule {
  default: () => Promise<void>;
  deriveRootSecret(passphrase: string, salt: Uint8Array): Uint8Array;
  generateSalt(): Uint8Array;
}

let initPromise: Promise<SignalCoreModule> | null = null;

async function load(): Promise<SignalCoreModule> {
  const mod: SignalCoreModule = await import('./pkg/signal_core');
  const initWasm = mod.default;
  await initWasm();
  return mod;
}

function getModule(): Promise<SignalCoreModule> {
  if (!initPromise) {
    initPromise = load().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function argon2DeriveRoot(
  passphrase: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const mod = await getModule();
  return mod.deriveRootSecret(passphrase, salt);
}

export async function argon2GenerateSalt(): Promise<Uint8Array> {
  const mod = await getModule();
  return mod.generateSalt();
}
