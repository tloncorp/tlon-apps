import { createFakeModelServer } from './server-core.mjs';

if (process.stdout._handle?.setBlocking) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle?.setBlocking) {
  process.stderr._handle.setBlocking(true);
}

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

console.log(
  `[fake-model] starting (pid ${process.pid}, node ${process.version})`
);

const controller = createFakeModelServer();
const listener = await controller.listen({ port, host });

console.log(`[fake-model] listening on :${listener.port}`);

async function shutdown(signal) {
  console.log(`[fake-model] received ${signal}, shutting down`);
  await listener.close().catch((error) => {
    console.error('[fake-model] shutdown error:', error);
  });
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('uncaughtException', (err) => {
  console.error('[fake-model] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[fake-model] unhandledRejection:', reason);
});
