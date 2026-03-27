#!/usr/bin/env node

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.URBIT_URL || 'http://localhost:8080';
const LOGIN_URL = `${BASE_URL}/~/login`;
const PRIMARY_POSTS_URL =
  `${BASE_URL}/~/scry/channels/v4/chat/~malmur-halmex/jrob6ssh-general/posts/newest/20/outline.json`;
const FALLBACK_POSTS_URL =
  `${BASE_URL}/~/scry/channels/v3/chat/~malmur-halmex/jrob6ssh-general/posts/newest/20/outline.json`;
const CREATE_POST_URL =
  `${BASE_URL}/v1/channel/chat/~malmur-halmex/jrob6ssh-general/posts`;
const COOKIE_NAME = 'urbauth-~malmur-halmex';
const PASSWORD = process.env.URBIT_CODE || '';
const POLL_INTERVAL_MS = 5000;
const MAX_TRACKED_IDS = 1000;
const MAX_CACHED_MESSAGES = 500;
const DEFAULT_PLAYERS = {
  white: '~malmur-halmex',
  black: '~sitrul-nacwyl',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  parseFen,
  applyMove,
  getAllLegalMoves,
  getGameStatus,
  getPositionKey,
  getRandomMove,
} = loadCommonJsModule(path.join(__dirname, 'chess-utils.cjs'));

function normalizePlayerMove(state, move) {
  const fromSquare = move.slice(0, 2);
  const toSquare = move.slice(2, 4);
  const fromCol = fromSquare.charCodeAt(0) - 97;
  const fromRow = 8 - Number(fromSquare[1]);
  const toRow = 8 - Number(toSquare[1]);
  const piece = state.board[fromRow]?.[fromCol];

  if (
    piece &&
    piece.toLowerCase() === 'p' &&
    (toRow === 0 || toRow === 7)
  ) {
    return `${fromSquare}${toSquare}${move[4]?.toLowerCase() || 'q'}`;
  }

  return move;
}

function loadCommonJsModule(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const wrapper = `(function (exports, require, module, __filename, __dirname) {\n${source}\n})`;
  const script = new vm.Script(wrapper, { filename });
  const evaluate = script.runInThisContext();
  const localRequire = (specifier) => {
    throw new Error(`Unsupported require in ${filename}: ${specifier}`);
  };

  evaluate(module.exports, localRequire, module, filename, path.dirname(filename));
  return module.exports;
}

function isTerminalStatus(status) {
  return status === 'checkmate' || status === 'stalemate' || status === 'draw';
}

function normalizePositionHistory(fen, positionHistory) {
  const history = Array.isArray(positionHistory)
    ? positionHistory.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const currentPosition = getPositionKey(fen);

  if (history.length === 0 || history[history.length - 1] !== currentPosition) {
    history.push(currentPosition);
  }

  return history;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toCanonicalId(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'object') {
    if ('id' in value) {
      return toCanonicalId(value.id);
    }
    if ('post' in value) {
      return toCanonicalId(value.post);
    }
    if ('reply' in value) {
      return toCanonicalId(value.reply);
    }
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const digits = text.match(/\d+/g);
  if (digits && digits.length > 0) {
    return digits.join('');
  }

  return text;
}

function toSortValue(id) {
  if (!id || !/^\d+$/.test(id)) {
    return null;
  }

  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

function compareMessages(a, b) {
  if (a.sortValue != null && b.sortValue != null) {
    if (a.sortValue < b.sortValue) {
      return -1;
    }
    if (a.sortValue > b.sortValue) {
      return 1;
    }
  }

  return a.id.localeCompare(b.id);
}

function extractCookie(setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  for (const cookie of cookies) {
    if (cookie.startsWith(`${COOKIE_NAME}=`)) {
      return cookie.split(';', 1)[0];
    }
  }

  return null;
}

function httpRequest(method, urlString, options = {}) {
  const url = new URL(urlString);
  const body = options.body ?? null;
  const headers = {
    ...options.headers,
  };

  if (body != null && headers['Content-Length'] == null) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(options.timeoutMs ?? 20000, () => {
      request.destroy(new Error(`Request timed out: ${method} ${urlString}`));
    });

    if (body != null) {
      request.write(body);
    }
    request.end();
  });
}

async function login(state) {
  const body = `password=${encodeURIComponent(PASSWORD)}`;
  const response = await httpRequest('POST', LOGIN_URL, {
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
    },
  });

  if (response.statusCode >= 400) {
    throw new Error(`Login failed with status ${response.statusCode}: ${response.body}`);
  }

  const cookie = extractCookie(response.headers['set-cookie']);
  if (!cookie) {
    throw new Error('Login succeeded without the expected auth cookie');
  }

  state.cookie = cookie;
  console.log(`[auth] logged in and stored ${COOKIE_NAME}`);
}

async function authedRequest(state, method, url, options = {}, allowRetry = true) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (state.cookie) {
    headers.Cookie = state.cookie;
  }

  const response = await httpRequest(method, url, {
    ...options,
    headers,
  });

  if (response.statusCode === 401 && allowRetry) {
    console.error('[auth] request returned 401, re-authenticating');
    await login(state);
    return authedRequest(state, method, url, options, false);
  }

  return response;
}

async function requestJson(state, method, url, options = {}, allow404 = false) {
  const response = await authedRequest(state, method, url, options);
  if (allow404 && response.statusCode === 404) {
    return { response, json: null };
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${method} ${url} failed with ${response.statusCode}: ${response.body}`);
  }

  if (!response.body.trim()) {
    return { response, json: null };
  }

  try {
    return {
      response,
      json: JSON.parse(response.body),
    };
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${url}: ${error.message}`);
  }
}

async function fetchRecentPosts(state) {
  if (state.pollEndpoint === 'fallback') {
    const result = await requestJson(state, 'GET', FALLBACK_POSTS_URL);
    return result.json;
  }

  const primary = await requestJson(state, 'GET', PRIMARY_POSTS_URL, {}, true);
  if (primary.response.statusCode === 404) {
    state.pollEndpoint = 'fallback';
    const fallback = await requestJson(state, 'GET', FALLBACK_POSTS_URL);
    return fallback.json;
  }

  state.pollEndpoint = 'primary';
  return primary.json;
}

function extractReplies(raw) {
  const nested = raw?.seal?.replies ?? raw?.replies ?? null;
  if (nested == null) {
    return null;
  }

  if (Array.isArray(nested)) {
    return nested;
  }

  if (typeof nested === 'object') {
    const values = Object.values(nested);
    if (values.length === 0) {
      return nested;
    }
    if (
      values.every(
        (value) =>
          value &&
          typeof value === 'object' &&
          (
            value.seal ||
            value.essay ||
            value['reply-essay'] ||
            value.content
          )
      )
    ) {
      return nested;
    }
  }

  return null;
}

function extractMessageId(raw, fallbackId) {
  return (
    toCanonicalId(raw?.seal?.id) ||
    toCanonicalId(raw?.id) ||
    toCanonicalId(raw?.post?.seal?.id) ||
    toCanonicalId(raw?.post?.id) ||
    toCanonicalId(fallbackId)
  );
}

function extractParentId(raw) {
  return (
    toCanonicalId(raw?.reply) ||
    toCanonicalId(raw?.parentId) ||
    toCanonicalId(raw?.['parent-id']) ||
    toCanonicalId(raw?.seal?.['parent-id']) ||
    toCanonicalId(raw?.replyToPostId) ||
    null
  );
}

function extractStory(raw) {
  return (
    raw?.essay?.content ??
    raw?.['reply-essay']?.content ??
    raw?.memo?.content ??
    raw?.content ??
    raw?.inline ??
    null
  );
}

function extractTextFromNode(node) {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string') {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join('');
  }

  if (typeof node !== 'object') {
    return '';
  }

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (Object.prototype.hasOwnProperty.call(node, 'break')) {
    return '\n';
  }

  if (Array.isArray(node.inline)) {
    return node.inline.map(extractTextFromNode).join('');
  }

  if (node.link && typeof node.link === 'object') {
    if (typeof node.link.content === 'string') {
      return node.link.content;
    }
    return extractTextFromNode(node.link.content ?? node.link.href ?? '');
  }

  if (node.block) {
    return extractTextFromNode(node.block);
  }

  if ('content' in node) {
    return extractTextFromNode(node.content);
  }

  let output = '';
  for (const value of Object.values(node)) {
    output += extractTextFromNode(value);
  }
  return output;
}

function extractMessageText(raw) {
  const directText =
    raw?.text ??
    raw?.body ??
    raw?.message ??
    raw?.plaintext ??
    null;

  if (typeof directText === 'string') {
    return directText.trim();
  }

  return extractTextFromNode(extractStory(raw)).trim();
}

function normalizeMessage(raw, fallbackId, inheritedParentId = null) {
  const id = extractMessageId(raw, fallbackId);
  if (!id) {
    return null;
  }

  const parentId = inheritedParentId || extractParentId(raw);
  return {
    id,
    parentId,
    raw,
    text: extractMessageText(raw),
    sortValue: toSortValue(id),
  };
}

function collectMessagesFromContainer(
  container,
  messages,
  inheritedParentId = null,
  fallbackId = null
) {
  if (container == null) {
    return;
  }

  if (Array.isArray(container)) {
    for (const item of container) {
      collectMessagesFromContainer(item, messages, inheritedParentId, null);
    }
    return;
  }

  if (typeof container !== 'object') {
    return;
  }

  if ('posts' in container) {
    collectMessagesFromContainer(container.posts, messages, inheritedParentId, null);
    return;
  }

  const looksLikeMessage =
    !!container.seal ||
    !!container.essay ||
    !!container['reply-essay'] ||
    !!container.memo ||
    Array.isArray(container.content) ||
    Array.isArray(container.inline) ||
    typeof container.text === 'string' ||
    typeof container.body === 'string' ||
    typeof container.message === 'string' ||
    typeof container.id === 'string';

  if (!looksLikeMessage) {
    const entries = Object.entries(container);
    for (const [key, value] of entries) {
      collectMessagesFromContainer(value, messages, inheritedParentId, key);
    }
    return;
  }

  const message = normalizeMessage(container, fallbackId, inheritedParentId);
  if (!message) {
    return;
  }

  messages.push(message);

  const replies = extractReplies(container);
  if (replies != null) {
    if (Array.isArray(replies)) {
      for (const reply of replies) {
        collectMessagesFromContainer(reply, messages, message.id, null);
      }
    } else {
      for (const [replyId, reply] of Object.entries(replies)) {
        collectMessagesFromContainer(reply, messages, message.id, replyId);
      }
    }
  }
}

function normalizeChannelPayload(payload) {
  const messages = [];
  collectMessagesFromContainer(payload, messages);
  messages.sort(compareMessages);
  return messages;
}

function findChessBlockInNode(node) {
  if (node == null) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findChessBlockInNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof node !== 'object') {
    return null;
  }

  if (node.type === 'chess' && node.version === 1 && typeof node.fen === 'string') {
    return {
      type: 'chess',
      version: 1,
      fen: node.fen,
      players: node.players,
      turn: node.turn,
      status: node.status,
      lastMove: node.lastMove ?? null,
      moveHistory: Array.isArray(node.moveHistory) ? node.moveHistory.slice() : [],
      positionHistory: Array.isArray(node.positionHistory)
        ? node.positionHistory.slice()
        : [],
      theme: node.theme ?? 'blue',
    };
  }

  if (node.chess) {
    const found = findChessBlockInNode(node.chess);
    if (found) {
      return found;
    }
  }

  for (const value of Object.values(node)) {
    const found = findChessBlockInNode(value);
    if (found) {
      return found;
    }
  }

  return null;
}

function parseChessBlob(blob) {
  if (typeof blob !== 'string' || !blob.trim()) {
    return null;
  }

  try {
    return findChessBlockInNode(JSON.parse(blob));
  } catch {
    return null;
  }
}

function extractChessBlock(raw) {
  const blob =
    raw?.essay?.blob ??
    raw?.['reply-essay']?.blob ??
    raw?.blob ??
    null;

  const fromBlob = parseChessBlob(blob);
  if (fromBlob) {
    return fromBlob;
  }

  return findChessBlockInNode(
    raw?.essay?.content ??
      raw?.['reply-essay']?.content ??
      raw?.content ??
      raw
  );
}

function rememberId(state, id) {
  if (state.processedIds.has(id)) {
    return;
  }

  state.processedIds.add(id);
  state.processedOrder.push(id);
  while (state.processedOrder.length > MAX_TRACKED_IDS) {
    const removed = state.processedOrder.shift();
    if (removed) {
      state.processedIds.delete(removed);
    }
  }
}

function rememberMessage(state, message) {
  if (state.messageCache.has(message.id)) {
    return;
  }

  state.messageCache.set(message.id, message);
  state.messageOrder.push(message.id);

  while (state.messageOrder.length > MAX_CACHED_MESSAGES) {
    const removed = state.messageOrder.shift();
    if (removed) {
      state.messageCache.delete(removed);
    }
  }
}

function updateLastSeen(state, messages) {
  for (const message of messages) {
    if (state.lastSeenSortValue == null) {
      state.lastSeenSortValue = message.sortValue;
      state.lastSeenMessageId = message.id;
      continue;
    }

    if (message.sortValue != null && message.sortValue > state.lastSeenSortValue) {
      state.lastSeenSortValue = message.sortValue;
      state.lastSeenMessageId = message.id;
      continue;
    }

    if (message.sortValue == null && message.id > (state.lastSeenMessageId ?? '')) {
      state.lastSeenMessageId = message.id;
    }
  }
}

function isNewMessage(state, message) {
  if (state.lastSeenSortValue == null) {
    return !state.processedIds.has(message.id);
  }

  if (message.sortValue != null) {
    return message.sortValue > state.lastSeenSortValue;
  }

  return !state.processedIds.has(message.id);
}

function buildChessPostBody(
  fen,
  templateBlock,
  moveHistory,
  lastMove,
  status,
  positionHistory
) {
  const state = parseFen(fen);
  return {
    content: [
      {
        inline: [
          {
            block: {
              chess: {
                type: 'chess',
                version: 1,
                fen,
                players: templateBlock.players ?? DEFAULT_PLAYERS,
                turn: state.turn === 'w' ? 'white' : 'black',
                status,
                lastMove,
                moveHistory,
                positionHistory,
                theme: templateBlock.theme ?? 'blue',
              },
            },
          },
        ],
      },
    ],
  };
}

async function postChessBlob(state, body) {
  const response = await authedRequest(state, 'POST', CREATE_POST_URL, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`POST chess blob failed with ${response.statusCode}: ${response.body}`);
  }

  return response;
}

async function handleMoveMessage(state, message) {
  if (!message.parentId) {
    return;
  }

  const moveMatch = /^move:\s*([a-h][1-8][a-h][1-8][qrbn]?)/i.exec(message.text);
  if (!moveMatch) {
    return;
  }

  const move = moveMatch[1].toLowerCase();
  const parentMessage = state.messageCache.get(message.parentId);
  if (!parentMessage) {
    console.error(`[move] parent ${message.parentId} not found for message ${message.id}`);
    return;
  }

  const chessBlock = extractChessBlock(parentMessage.raw);
  if (!chessBlock) {
    return;
  }

  console.log(`[move] detected ${move} in reply ${message.id} to chess post ${parentMessage.id}`);

  try {
    const gameState = parseFen(chessBlock.fen);
    const normalizedMove = normalizePlayerMove(gameState, move);
    const legalMoves = getAllLegalMoves(gameState);

    if (!legalMoves.includes(normalizedMove)) {
      throw new Error(`Illegal move ${move} for FEN ${chessBlock.fen}`);
    }

    const moveHistory = Array.isArray(chessBlock.moveHistory)
      ? chessBlock.moveHistory.slice()
      : [];
    const positionHistory = normalizePositionHistory(
      chessBlock.fen,
      chessBlock.positionHistory
    );

    moveHistory.push(normalizedMove);
    const afterPlayerMove = applyMove(chessBlock.fen, move);
    const afterPlayerPositionHistory = positionHistory.concat(
      getPositionKey(afterPlayerMove)
    );
    const statusAfterUser = getGameStatus(afterPlayerMove, {
      positionHistory: afterPlayerPositionHistory,
    });
    let responseMove = null;
    let finalFen = afterPlayerMove;
    let finalStatus = statusAfterUser;
    let finalPositionHistory = afterPlayerPositionHistory;

    if (!isTerminalStatus(statusAfterUser)) {
      responseMove = getRandomMove(afterPlayerMove);
      if (responseMove) {
        finalFen = applyMove(afterPlayerMove, responseMove);
        moveHistory.push(responseMove);
        finalPositionHistory = afterPlayerPositionHistory.concat(
          getPositionKey(finalFen)
        );
        finalStatus = getGameStatus(finalFen, {
          positionHistory: finalPositionHistory,
        });
      }
    }

    const body = buildChessPostBody(
      finalFen,
      chessBlock,
      moveHistory,
      responseMove ?? normalizedMove,
      finalStatus,
      finalPositionHistory
    );

    const response = await postChessBlob(state, body);
    console.log(
      `[post] posted chess response for ${message.id} with ${responseMove ?? 'no reply move'} (${response.statusCode})`
    );
  } catch (error) {
    console.error(`[move] failed to process ${message.id}:`, error);
  }
}

async function pollOnce(state) {
  console.log(`[poll] cycle started at ${new Date().toISOString()}`);
  const payload = await fetchRecentPosts(state);
  const messages = normalizeChannelPayload(payload);

  for (const message of messages) {
    rememberMessage(state, message);
  }

  if (!state.initialized) {
    for (const message of messages) {
      rememberId(state, message.id);
    }
    updateLastSeen(state, messages);
    state.initialized = true;
    console.log(
      `[poll] primed with ${messages.length} messages; last seen ${state.lastSeenMessageId ?? 'none'}`
    );
    return;
  }

  const freshMessages = messages.filter((message) => isNewMessage(state, message));
  console.log(`[poll] fetched ${messages.length} messages, ${freshMessages.length} new`);

  for (const message of freshMessages) {
    await handleMoveMessage(state, message);
    rememberId(state, message.id);
  }

  updateLastSeen(state, messages);
}

async function main() {
  const state = {
    cookie: null,
    pollEndpoint: 'primary',
    initialized: false,
    processedIds: new Set(),
    processedOrder: [],
    messageCache: new Map(),
    messageOrder: [],
    lastSeenMessageId: null,
    lastSeenSortValue: null,
  };

  for (;;) {
    try {
      if (!state.cookie) {
        await login(state);
      }
      await pollOnce(state);
    } catch (error) {
      console.error('[poll] cycle failed:', error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error('[fatal] unrecoverable error:', error);
  process.exitCode = 1;
});
