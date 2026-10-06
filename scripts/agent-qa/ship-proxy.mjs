import http from 'node:http';
import https from 'node:https';
export async function connectShip() {
  const upstream = new URL(process.env.QA_SHIP_URL);
  if (upstream.protocol !== 'https:')
    throw new Error('Expected HTTPS backend tunnel');
  const response = await fetch(new URL('/qa-proof/ready', upstream), {
    headers: { 'X-QA-Token': process.env.QA_TUNNEL_TOKEN },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Disposable backend is unavailable');
  const ready = await response.json();
  if (ready.source !== process.env.QA_BACKEND_SHA)
    throw new Error('Wrong backend source');
  const server = http.createServer((req, res) => {
    const request = https.request(
      {
        hostname: upstream.hostname,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: upstream.host,
          'x-qa-token': process.env.QA_TUNNEL_TOKEN,
          'ngrok-skip-browser-warning': '1',
        },
      },
      (incoming) => {
        res.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(res);
      }
    );
    request.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    res.on('close', () => request.destroy());
    req.pipe(request);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(49378, '127.0.0.1', resolve);
  });
  return {
    ready,
    close() {
      server.closeAllConnections();
      server.close();
    },
  };
}
