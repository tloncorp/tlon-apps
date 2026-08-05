export function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
