import http from 'node:http';

export async function liveBackendProof(evidence, nonce, readDeskHashes) {
  if (!/^[a-f0-9-]{36}$/.test(nonce || ''))
    throw new Error('Invalid proof nonce');
  const hashes = await readDeskHashes();
  if (
    hashes.length !== 2 ||
    hashes.some((hash, i) => !hash || hash !== evidence.deskHashes[i])
  )
    throw new Error('Live backend desk verification failed');
  return {
    ...evidence,
    fixtureVerified: true,
    backendVerified: true,
    verificationNonce: nonce,
    verifiedAt: new Date().toISOString(),
  };
}

// Only nginx's authenticated proof route can reach this loopback read-only service.
export function backendProofServer({ evidence, readDeskHashes, persist }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/result') {
      res.writeHead(404).end();
      return;
    }
    let timer;
    try {
      const proof = await Promise.race([
        liveBackendProof(
          evidence,
          url.searchParams.get('nonce'),
          readDeskHashes
        ),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Backend proof timeout')),
            10000
          );
        }),
      ]);
      persist(proof);
      res
        .writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        .end(JSON.stringify(proof));
    } catch {
      res
        .writeHead(503, { 'Cache-Control': 'no-store' })
        .end('Live backend verification failed');
    } finally {
      clearTimeout(timer);
    }
  });
}
