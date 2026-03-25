const https = require('https');
const { parseFen, applyMove, getRandomMove, getGameStatus } = require('./chess-utils.cjs');

const BASE = process.env.URBIT_HOST || 'localhost:8080';
const PASSWORD = process.env.URBIT_CODE || '';
const NEST = 'chat/~malmur-halmex/jrob6ssh-general';
const CHANNEL_SCRY = `/~/scry/channels/v4/${NEST}/posts/newest/10/outline.json`;
const CHANNEL_NAME = `chess-agent-${Date.now()}`;

let cookie = null;
let eventId = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: BASE, port: 443, path, method, headers: { 'Content-Type': 'application/json' } };
    if (cookie) opts.headers.Cookie = `urbauth-~malmur-halmex=${cookie}`;
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function login() {
  const r = await req('POST', '/~/login', 'password=' + PASSWORD);
  const sc = r.headers['set-cookie'];
  if (sc) {
    const m = (Array.isArray(sc) ? sc.join(';') : sc).match(/urbauth-~malmur-halmex=([^;]+)/);
    if (m) { cookie = m[1]; console.log('[auth] logged in'); return; }
  }
  throw new Error('login failed: ' + r.status);
}

async function scry(path) {
  const r = await req('GET', path);
  if (r.status === 307) {
    const loc = r.headers.location;
    if (loc) {
      const r2 = await req('GET', loc);
      return JSON.parse(r2.body);
    }
  }
  if (r.status !== 200) throw new Error(`scry ${r.status}: ${r.body.slice(0,100)}`);
  return JSON.parse(r.body);
}

function findChessBlob(posts) {
  const entries = Object.entries(posts).sort((a,b) => b[0].localeCompare(a[0]));
  for (const [id, post] of entries) {
    const blob = post?.essay?.blob;
    if (blob) {
      try {
        const parsed = JSON.parse(blob);
        if (Array.isArray(parsed) && parsed[0]?.type === 'chess') return { id, chess: parsed[0], post };
      } catch {}
    }
  }
  return null;
}

async function postChessBlob(chess) {
  const ts = Date.now();
  const blob = JSON.stringify([chess]);
  const body = JSON.stringify([{
    id: ++eventId, action: 'poke', ship: 'malmur-halmex',
    app: 'channels', mark: 'channel-action-1',
    json: { channel: { nest: NEST, action: { post: { add: {
      content: [{ inline: [`♟ ${chess.turn === 'white' ? "White" : "Black"}'s turn — ${chess.moveHistory.slice(-1)[0] || 'start'}`] }],
      sent: ts, kind: '/chat', author: '~sitrul-nacwyl',
      blob, meta: { title: '', image: '', description: '', cover: '' }
    }}}}}
  }]);
  const r = await req('PUT', `/~/channel/${CHANNEL_NAME}`, body);
  console.log(`[post] chess blob posted: ${r.status}`);
}

async function processAction(act) {
  const userMove = act.action.toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(userMove)) {
    console.log(`[move] ignoring non-move action: ${userMove}`);
    return;
  }
  console.log(`[move] detected: ${userMove} from ${act.ship} (id ${act.id})`);

  // Find the current chess game from channel posts
  const channelData = await scry(CHANNEL_SCRY);
  const posts = channelData?.posts || {};
  const game = findChessBlob(posts);
  if (!game) { console.log('[move] no chess blob found'); return; }

  // Apply user's move
  const afterUser = applyMove(game.chess.fen, userMove);
  const history = [...(game.chess.moveHistory || []), userMove];

  let statusAfterUser = getGameStatus(afterUser);
  console.log(`[move] status after user move: ${statusAfterUser}`);

  // If game is over, post final state
  if (statusAfterUser === 'checkmate' || statusAfterUser === 'stalemate') {
    const state = parseFen(afterUser);
    await postChessBlob({
      type: 'chess', version: 1,
      fen: afterUser,
      players: game.chess.players || { white: '~malmur-halmex', black: '~sitrul-nacwyl' },
      turn: state.turn === 'w' ? 'white' : 'black',
      status: statusAfterUser,
      lastMove: userMove,
      moveHistory: history,
      theme: game.chess.theme || 'blue',
    });
    console.log(`[move] game over: ${statusAfterUser}`);
    return;
  }

  // Agent responds with random move
  const agentMove = getRandomMove(afterUser);
  let finalFen = afterUser;
  let finalStatus = statusAfterUser;

  if (agentMove) {
    finalFen = applyMove(afterUser, agentMove);
    history.push(agentMove);
    finalStatus = getGameStatus(finalFen);
    console.log(`[move] agent responds: ${agentMove}, status: ${finalStatus}`);
  } else {
    console.log(`[move] agent has no legal moves`);
  }

  const state = parseFen(finalFen);
  await postChessBlob({
    type: 'chess', version: 1,
    fen: finalFen,
    players: game.chess.players || { white: '~malmur-halmex', black: '~sitrul-nacwyl' },
    turn: state.turn === 'w' ? 'white' : 'black',
    status: finalStatus,
    lastMove: agentMove || userMove,
    moveHistory: history,
    theme: game.chess.theme || 'blue',
  });
}

function subscribeToActions() {
  // Send subscribe action via channel API
  const subBody = JSON.stringify([{
    id: ++eventId, action: 'subscribe', ship: 'malmur-halmex',
    app: 'a2ui', path: '/actions'
  }]);

  const opts = {
    hostname: BASE, port: 443,
    path: `/~/channel/${CHANNEL_NAME}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `urbauth-~malmur-halmex=${cookie}`
    }
  };

  const r = https.request(opts, res => {
    console.log(`[sub] subscribe sent: ${res.statusCode}`);
  });
  r.write(subBody);
  r.end();

  // Open SSE stream to receive events
  const sseOpts = {
    hostname: BASE, port: 443,
    path: `/~/channel/${CHANNEL_NAME}`,
    method: 'GET',
    headers: {
      Cookie: `urbauth-~malmur-halmex=${cookie}`,
      Accept: 'text/event-stream'
    }
  };

  const stream = https.request(sseOpts, res => {
    console.log(`[sse] connected: ${res.statusCode}`);
    let buffer = '';

    res.on('data', chunk => {
      buffer += chunk.toString();
      // Parse SSE events
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep incomplete chunk

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        let id = null;
        let data = '';
        for (const line of lines) {
          if (line.startsWith('id:')) id = line.slice(3).trim();
          if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;

        try {
          const evt = JSON.parse(data);
          // Ack the event
          if (id) ackEvent(parseInt(id));

          if (evt.ok) {
            console.log('[sse] subscription confirmed');
            continue;
          }

          // Diff event from subscription — contains the action JSON
          const json = evt?.json;
          if (json && json.blobType === 'chess') {
            console.log(`[sse] chess action received: ${json.action} from ${json.ship}`);
            processAction(json).catch(e => console.error('[move] error:', e.message));
          }
        } catch (e) {
          // not JSON or parse error, skip
        }
      }
    });

    res.on('end', () => {
      console.log('[sse] stream ended, reconnecting in 3s...');
      setTimeout(start, 3000);
    });

    res.on('error', e => {
      console.error('[sse] stream error:', e.message);
      setTimeout(start, 3000);
    });
  });

  stream.on('error', e => {
    console.error('[sse] request error:', e.message);
    setTimeout(start, 3000);
  });

  stream.end();
}

function ackEvent(id) {
  const body = JSON.stringify([{ id: ++eventId, action: 'ack', 'event-id': id }]);
  const r = https.request({
    hostname: BASE, port: 443,
    path: `/~/channel/${CHANNEL_NAME}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `urbauth-~malmur-halmex=${cookie}`
    }
  });
  r.write(body);
  r.end();
}

async function start() {
  try {
    if (!cookie) await login();
    console.log('[agent] subscribing to %a2ui /actions...');
    subscribeToActions();
  } catch (e) {
    console.error('[start] error:', e.message);
    cookie = null;
    setTimeout(start, 5000);
  }
}

console.log('[agent] chess agent v2 starting (a2ui subscription mode)');
start();
