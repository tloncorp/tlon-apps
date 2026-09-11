import http from 'node:http';
import https from 'node:https';

export function verifyPeer(proof, sha, tag, complete = false, plan = null) {
  if (
    proof.source !== sha ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !/^[a-zA-Z0-9-]+$/.test(tag) ||
    !proof.group?.groupId?.startsWith(`~zod/cloud-${tag}-`) ||
    !proof.deskHashes?.[0] ||
    proof.deskHashes.length !== 2 ||
    proof.deskHashes[0] !== proof.deskHashes[1] ||
    (complete &&
      (plan ? proof.fixtureVerified !== true : proof.replyVerified !== true))
  ) {
    throw new Error(
      'Backend proof does not match the requested source, fixture, or peer receipt'
    );
  }
  if (plan) {
    for (const recipe of plan.setup.fixtures) {
      const fixture = proof.fixtures?.find((f) => f.recipe === recipe);
      if (
        !fixture?.verified ||
        fixture.groupId !== proof.group.groupId ||
        !fixture.writable ||
        (recipe === 'chat-v1'
          ? !fixture.channelId?.startsWith('chat/~zod/') ||
            fixture.channelId !== proof.group.chatChannel ||
            fixture.peerMessage !== `${tag} from ten` ||
            fixture.peerMessageVerified !== true
          : !fixture.channelId?.startsWith('notes/~zod/') ||
            fixture.noteCount < 1 ||
            !fixture.searchVerified)
      )
        throw new Error('Requested fixture was not provisioned and verified');
    }
    for (const result of proof.regressionResults || []) {
      if (result.source !== plan.headSha)
        throw new Error('Regression evidence source mismatch');
    }
  }
  return proof;
}

export async function connectShips(env) {
  const upstream = new URL(env.QA_SHIP_URL);
  if (
    upstream.protocol !== 'https:' ||
    upstream.username ||
    upstream.password ||
    upstream.pathname !== '/' ||
    upstream.port ||
    upstream.search ||
    upstream.hash ||
    !/^[a-z0-9-]+\.(ngrok-free\.(?:app|dev)|ngrok\.app|ngrok\.io)$/.test(
      upstream.hostname
    ) ||
    !/^[a-f0-9]{64}$/.test(env.QA_TUNNEL_TOKEN || '')
  ) {
    throw new Error('Expected an authenticated QA ngrok origin');
  }
  const proof = async (complete) => {
    const response = await fetch(
      new URL(`/qa-proof/${complete ? 'result' : 'ready'}`, upstream),
      {
        headers: { 'X-QA-Token': env.QA_TUNNEL_TOKEN },
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!response.ok)
      throw new Error(`Backend evidence unavailable (HTTP ${response.status})`);
    return verifyPeer(
      await response.json(),
      env.QA_BACKEND_SHA,
      env.QA_RUN_TAG,
      complete,
      env.QA_MODE === 'pull_request' ? JSON.parse(env.QA_ASSESSMENT_JSON) : null
    );
  };
  const ready = await proof(false);
  const server = http.createServer((req, res) => {
    // Origin-form paths only: app input cannot redirect the credential elsewhere.
    if (
      !req.url.startsWith('/') ||
      req.url.startsWith('//') ||
      req.url.startsWith('/qa-proof/')
    ) {
      res.writeHead(403).end();
      return;
    }
    const outgoing = https.request(
      {
        hostname: upstream.hostname,
        port: 443,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: upstream.host,
          'x-qa-token': env.QA_TUNNEL_TOKEN,
          'ngrok-skip-browser-warning': '1',
        },
      },
      (incoming) => {
        res.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(res);
      }
    );
    outgoing.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    res.on('close', () => outgoing.destroy());
    req.pipe(outgoing);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(49378, '127.0.0.1', resolve);
  });
  return {
    ready,
    url: 'http://127.0.0.1:49378',
    verify: () => proof(true),
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}
