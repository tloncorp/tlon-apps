const https = require('https');
const { parseFen, applyMove, getRandomMove, getGameStatus } = require('./chess-utils.cjs');

const BASE = 'localhost:8080';
const PASSWORD = '';
const NEST = 'chat/~malmur-halmex/jrob6ssh-general';
const SCRY_PATH = `/~/scry/channels/v4/${NEST}/posts/newest/10/outline.json`;
const POLL_MS = 5000;

let cookie = null;
let lastSeenId = null;
let initialized = false;

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
    // Follow redirect
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
  // Find the most recent chess blob post
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
    id: 1, action: 'poke', ship: 'malmur-halmex',
    app: 'channels', mark: 'channel-action-1',
    json: { channel: { nest: NEST, action: { post: { add: {
      content: [{ inline: [`♟ ${chess.turn === 'white' ? "White" : "Black"}'s turn — ${chess.moveHistory.slice(-1)[0] || 'start'}`] }],
      sent: ts, kind: '/chat', author: '~sitrul-nacwyl',
      blob, meta: { title: '', image: '', description: '', cover: '' }
    }}}}}
  }]);
  const r = await req('PUT', `/~/channel/chess-resp-${ts}`, body);
  console.log(`[post] chess blob posted: ${r.status}`);
}

async function poll() {
  if (!cookie) await login();
  const data = await scry(SCRY_PATH);
  const posts = data?.posts || {};
  const entries = Object.entries(posts).sort((a,b) => a[0].localeCompare(b[0]));
  
  if (!initialized) {
    if (entries.length) lastSeenId = entries[entries.length - 1][0];
    initialized = true;
    console.log(`[poll] primed with ${entries.length} posts, last: ${lastSeenId?.slice(0,25)}...`);
    return;
  }

  // Find new posts since lastSeenId
  const newPosts = entries.filter(([id]) => !lastSeenId || id > lastSeenId);
  if (newPosts.length) {
    lastSeenId = newPosts[newPosts.length - 1][0];
    console.log(`[poll] ${newPosts.length} new posts`);
  }

  for (const [id, post] of newPosts) {
    const content = post?.essay?.content;
    const text = content?.map(b => b?.inline?.join?.('') || '').join('') || '';
    const moveMatch = text.match(/^move:([a-h][1-8][a-h][1-8][qrbn]?)/i);
    if (!moveMatch) continue;

    const userMove = moveMatch[1].toLowerCase();
    console.log(`[move] detected: ${userMove} in post ${id.slice(0,25)}...`);

    // Find the current chess game
    const game = findChessBlob(posts);
    if (!game) { console.log('[move] no chess blob found'); continue; }

    try {
      // Apply user's move
      const afterUser = applyMove(game.chess.fen, userMove);
      const history = [...(game.chess.moveHistory || []), userMove];

      // Check game status after user's move
      let statusAfterUser = getGameStatus(afterUser);
      console.log(`[move] status after user move: ${statusAfterUser}`);

      // If game is over (checkmate or stalemate), don't generate agent response
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
        // No legal moves for agent (shouldn't happen if statusAfterUser was 'check' or 'active')
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
    } catch (e) {
      console.error(`[move] error processing ${userMove}:`, e.message);
    }
  }
}

(async () => {
  console.log('[agent] chess agent v2 starting');
  while (true) {
    try { await poll(); }
    catch (e) { console.error('[poll] error:', e.message); cookie = null; }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
})();
