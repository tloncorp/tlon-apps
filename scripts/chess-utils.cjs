'use strict';

const FILES = 'abcdefgh';
const CASTLING_ORDER = 'KQkq';
const PROMOTION_PIECES = 'qrbn';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPiece(piece) {
  return typeof piece === 'string' && /^[KQRBNPkqrbnp]$/.test(piece);
}

function isWhitePiece(piece) {
  return isPiece(piece) && piece === piece.toUpperCase();
}

function sameColor(a, b) {
  return isPiece(a) && isPiece(b) && isWhitePiece(a) === isWhitePiece(b);
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function normalizeCastling(castling) {
  if (!castling || castling === '-') {
    return '-';
  }

  let rights = '';
  for (const right of CASTLING_ORDER) {
    if (castling.includes(right)) {
      rights += right;
    }
  }
  return rights || '-';
}

function normalizeEnPassant(square) {
  if (!square || square === '-') {
    return '-';
  }
  squareToCoords(square);
  return square;
}

function squareToCoords(square) {
  assert(typeof square === 'string', 'Square must be a string');
  const value = square.trim().toLowerCase();
  assert(/^[a-h][1-8]$/.test(value), `Invalid square: ${square}`);

  const col = FILES.indexOf(value[0]);
  const rank = Number(value[1]);
  return { row: 8 - rank, col };
}

function coordsToSquare(row, col) {
  assert(inBounds(row, col), `Invalid coordinates: ${row},${col}`);
  return `${FILES[col]}${8 - row}`;
}

function validateBoard(board) {
  assert(Array.isArray(board) && board.length === 8, 'Board must have 8 rows');
  for (const row of board) {
    assert(Array.isArray(row) && row.length === 8, 'Each board row must have 8 columns');
    for (const square of row) {
      assert(square == null || isPiece(square), `Invalid board square: ${square}`);
    }
  }
}

function parseFen(fen) {
  assert(typeof fen === 'string', 'FEN must be a string');
  const parts = fen.trim().split(/\s+/);
  assert(parts.length === 6, `Invalid FEN: ${fen}`);

  const [placement, turn, castling, enPassant, halfMoveText, fullMoveText] = parts;
  assert(turn === 'w' || turn === 'b', `Invalid turn in FEN: ${turn}`);

  const ranks = placement.split('/');
  assert(ranks.length === 8, `Invalid board layout in FEN: ${placement}`);

  const board = ranks.map((rank) => {
    const row = [];
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        const emptyCount = Number(char);
        for (let index = 0; index < emptyCount; index += 1) {
          row.push(null);
        }
      } else {
        assert(isPiece(char), `Invalid piece in FEN: ${char}`);
        row.push(char);
      }
    }
    assert(row.length === 8, `Invalid rank width in FEN: ${rank}`);
    return row;
  });

  const halfMove = Number.parseInt(halfMoveText, 10);
  const fullMove = Number.parseInt(fullMoveText, 10);
  assert(Number.isInteger(halfMove) && halfMove >= 0, `Invalid halfmove clock: ${halfMoveText}`);
  assert(Number.isInteger(fullMove) && fullMove >= 1, `Invalid fullmove counter: ${fullMoveText}`);

  return {
    board,
    turn,
    castling: normalizeCastling(castling),
    enPassant: normalizeEnPassant(enPassant),
    halfMove,
    fullMove,
  };
}

function boardToFen(board, turn, castling, enPassant, halfMove, fullMove) {
  validateBoard(board);
  assert(turn === 'w' || turn === 'b', `Invalid turn: ${turn}`);

  const ranks = board.map((row) => {
    let emptyCount = 0;
    let rank = '';

    for (const square of row) {
      if (square == null) {
        emptyCount += 1;
        continue;
      }

      if (emptyCount > 0) {
        rank += String(emptyCount);
        emptyCount = 0;
      }
      rank += square;
    }

    if (emptyCount > 0) {
      rank += String(emptyCount);
    }
    return rank;
  });

  const normalizedCastling = normalizeCastling(castling);
  const normalizedEnPassant = normalizeEnPassant(enPassant);
  assert(Number.isInteger(halfMove) && halfMove >= 0, `Invalid halfmove clock: ${halfMove}`);
  assert(Number.isInteger(fullMove) && fullMove >= 1, `Invalid fullmove counter: ${fullMove}`);

  return [
    ranks.join('/'),
    turn,
    normalizedCastling,
    normalizedEnPassant,
    String(halfMove),
    String(fullMove),
  ].join(' ');
}

function boardToPlacement(board) {
  validateBoard(board);

  return board.map((row) => {
    let emptyCount = 0;
    let rank = '';

    for (const square of row) {
      if (square == null) {
        emptyCount += 1;
        continue;
      }

      if (emptyCount > 0) {
        rank += String(emptyCount);
        emptyCount = 0;
      }
      rank += square;
    }

    if (emptyCount > 0) {
      rank += String(emptyCount);
    }

    return rank;
  }).join('/');
}

function addRayMoves(state, row, col, directions, moves) {
  const board = state.board;
  const sourcePiece = board[row][col];

  for (const [rowDelta, colDelta] of directions) {
    let nextRow = row + rowDelta;
    let nextCol = col + colDelta;

    while (inBounds(nextRow, nextCol)) {
      const targetPiece = board[nextRow][nextCol];
      if (targetPiece == null) {
        moves.push(coordsToSquare(nextRow, nextCol));
      } else {
        if (!sameColor(sourcePiece, targetPiece)) {
          moves.push(coordsToSquare(nextRow, nextCol));
        }
        break;
      }

      nextRow += rowDelta;
      nextCol += colDelta;
    }
  }
}

function getPawnMoves(state, row, col, moves) {
  const board = state.board;
  const piece = board[row][col];
  const white = isWhitePiece(piece);
  const direction = white ? -1 : 1;
  const startRow = white ? 6 : 1;
  const oneStepRow = row + direction;

  if (inBounds(oneStepRow, col) && board[oneStepRow][col] == null) {
    moves.push(coordsToSquare(oneStepRow, col));

    const twoStepRow = row + direction * 2;
    if (row === startRow && board[twoStepRow][col] == null) {
      moves.push(coordsToSquare(twoStepRow, col));
    }
  }

  for (const colDelta of [-1, 1]) {
    const targetRow = row + direction;
    const targetCol = col + colDelta;
    if (!inBounds(targetRow, targetCol)) {
      continue;
    }

    const targetPiece = board[targetRow][targetCol];
    if (targetPiece != null && !sameColor(piece, targetPiece)) {
      moves.push(coordsToSquare(targetRow, targetCol));
      continue;
    }

    if (state.enPassant !== '-') {
      const enPassant = squareToCoords(state.enPassant);
      if (enPassant.row === targetRow && enPassant.col === targetCol) {
        const capturedPiece = board[row][targetCol];
        if (
          capturedPiece != null &&
          !sameColor(piece, capturedPiece) &&
          capturedPiece.toLowerCase() === 'p'
        ) {
          moves.push(coordsToSquare(targetRow, targetCol));
        }
      }
    }
  }
}

function getKnightMoves(state, row, col, moves) {
  const board = state.board;
  const piece = board[row][col];
  const deltas = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];

  for (const [rowDelta, colDelta] of deltas) {
    const targetRow = row + rowDelta;
    const targetCol = col + colDelta;
    if (!inBounds(targetRow, targetCol)) {
      continue;
    }

    const targetPiece = board[targetRow][targetCol];
    if (targetPiece == null || !sameColor(piece, targetPiece)) {
      moves.push(coordsToSquare(targetRow, targetCol));
    }
  }
}

function getKingMoves(state, row, col, moves) {
  const board = state.board;
  const piece = board[row][col];

  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) {
        continue;
      }

      const targetRow = row + rowDelta;
      const targetCol = col + colDelta;
      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const targetPiece = board[targetRow][targetCol];
      if (targetPiece == null || !sameColor(piece, targetPiece)) {
        moves.push(coordsToSquare(targetRow, targetCol));
      }
    }
  }

  const white = isWhitePiece(piece);
  const homeRow = white ? 7 : 0;
  const kingsideRight = white ? 'K' : 'k';
  const queensideRight = white ? 'Q' : 'q';
  const rook = white ? 'R' : 'r';

  if (row !== homeRow || col !== 4) {
    return;
  }

  if (
    state.castling.includes(kingsideRight) &&
    board[homeRow][5] == null &&
    board[homeRow][6] == null &&
    board[homeRow][7] === rook
  ) {
    moves.push(coordsToSquare(homeRow, 6));
  }

  if (
    state.castling.includes(queensideRight) &&
    board[homeRow][1] == null &&
    board[homeRow][2] == null &&
    board[homeRow][3] == null &&
    board[homeRow][0] === rook
  ) {
    moves.push(coordsToSquare(homeRow, 2));
  }
}

function getLegalMovesFromState(state, square) {
  const { row, col } = squareToCoords(square);
  const piece = state.board[row][col];
  if (piece == null) {
    return [];
  }

  const pieceTurn = isWhitePiece(piece) ? 'w' : 'b';
  if (pieceTurn !== state.turn) {
    return [];
  }

  const moves = [];
  switch (piece.toLowerCase()) {
    case 'p':
      getPawnMoves(state, row, col, moves);
      break;
    case 'r':
      addRayMoves(state, row, col, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
      break;
    case 'b':
      addRayMoves(state, row, col, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
      break;
    case 'q':
      addRayMoves(
        state,
        row,
        col,
        [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
        moves
      );
      break;
    case 'n':
      getKnightMoves(state, row, col, moves);
      break;
    case 'k':
      getKingMoves(state, row, col, moves);
      break;
    default:
      break;
  }

  return moves;
}

function getLegalMoves(fen, square) {
  const normalizedSquare = square.trim().toLowerCase();
  const state = parseFen(fen);
  return getAllLegalMoves(state)
    .filter((move) => move.startsWith(normalizedSquare))
    .map((move) => move.slice(2, 4));
}

function updateCastlingRights(castling, piece, fromSquare, toSquare, capturedPiece) {
  let rights = normalizeCastling(castling);
  if (rights === '-') {
    rights = '';
  }

  const removeRight = (right) => {
    rights = rights.replace(right, '');
  };

  switch (piece) {
    case 'K':
      removeRight('K');
      removeRight('Q');
      break;
    case 'k':
      removeRight('k');
      removeRight('q');
      break;
    case 'R':
      if (fromSquare === 'a1') {
        removeRight('Q');
      } else if (fromSquare === 'h1') {
        removeRight('K');
      }
      break;
    case 'r':
      if (fromSquare === 'a8') {
        removeRight('q');
      } else if (fromSquare === 'h8') {
        removeRight('k');
      }
      break;
    default:
      break;
  }

  switch (capturedPiece) {
    case 'R':
      if (toSquare === 'a1') {
        removeRight('Q');
      } else if (toSquare === 'h1') {
        removeRight('K');
      }
      break;
    case 'r':
      if (toSquare === 'a8') {
        removeRight('q');
      } else if (toSquare === 'h8') {
        removeRight('k');
      }
      break;
    default:
      break;
  }

  return rights || '-';
}

function applyMove(fen, uci) {
  assert(typeof uci === 'string' && /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(uci), `Invalid UCI move: ${uci}`);

  const state = parseFen(fen);
  const fromSquare = uci.slice(0, 2).toLowerCase();
  const toSquare = uci.slice(2, 4).toLowerCase();
  const promotion = uci.length === 5 ? uci[4].toLowerCase() : '';
  const { row: fromRow, col: fromCol } = squareToCoords(fromSquare);
  const { row: toRow, col: toCol } = squareToCoords(toSquare);
  const piece = state.board[fromRow][fromCol];

  if (promotion && !PROMOTION_PIECES.includes(promotion)) {
    throw new Error(`Invalid promotion piece: ${promotion}`);
  }

  if (piece == null) {
    throw new Error(`No piece on ${fromSquare}`);
  }

  const normalizedUci =
    piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)
      ? `${fromSquare}${toSquare}${promotion || 'q'}`
      : `${fromSquare}${toSquare}`;

  const legalMoves = getAllLegalMoves(state);
  if (!legalMoves.includes(normalizedUci)) {
    throw new Error(`Illegal move: ${uci}`);
  }

  const board = cloneBoard(state.board);
  const targetPiece = state.board[toRow][toCol];

  let capture = targetPiece != null;
  let capturedPiece = targetPiece;

  board[fromRow][fromCol] = null;

  if (
    piece.toLowerCase() === 'p' &&
    fromCol !== toCol &&
    targetPiece == null &&
    state.enPassant === toSquare
  ) {
    const direction = isWhitePiece(piece) ? -1 : 1;
    const capturedRow = toRow - direction;
    capturedPiece = board[capturedRow][toCol];
    board[capturedRow][toCol] = null;
    capture = true;
  }

  if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
    if (toCol === 6) {
      board[toRow][5] = board[toRow][7];
      board[toRow][7] = null;
    } else if (toCol === 2) {
      board[toRow][3] = board[toRow][0];
      board[toRow][0] = null;
    }
  }

  let placedPiece = piece;
  if (piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)) {
    const promotionPiece = promotion || 'q';
    placedPiece = isWhitePiece(piece)
      ? promotionPiece.toUpperCase()
      : promotionPiece;
  }

  board[toRow][toCol] = placedPiece;

  const nextCastling = updateCastlingRights(
    state.castling,
    piece,
    fromSquare,
    toSquare,
    capturedPiece
  );

  const nextEnPassant =
    piece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2
      ? coordsToSquare((fromRow + toRow) / 2, fromCol)
      : '-';

  const nextHalfMove =
    piece.toLowerCase() === 'p' || capture ? 0 : state.halfMove + 1;
  const nextFullMove = state.fullMove + (state.turn === 'b' ? 1 : 0);
  const nextTurn = state.turn === 'w' ? 'b' : 'w';

  return boardToFen(
    board,
    nextTurn,
    nextCastling,
    nextEnPassant,
    nextHalfMove,
    nextFullMove
  );
}

function getRandomMove(fen) {
  const state = parseFen(fen);
  const allMoves = getAllLegalMoves(state);

  if (allMoves.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * allMoves.length);
  return allMoves[randomIndex];
}

// ── Check/Checkmate/Stalemate Detection ─────────────────────────────────

/**
 * Find the position of a king on the board
 * @param {(string|null)[][]} board
 * @param {boolean} white - true for white king, false for black king
 * @returns {{row: number, col: number} | null}
 */
function findKing(board, white) {
  const king = white ? 'K' : 'k';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col] === king) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Check if a square is attacked by any piece of the given color
 * @param {(string|null)[][]} board
 * @param {number} targetRow
 * @param {number} targetCol
 * @param {boolean} byWhite - true to check if white pieces attack, false for black
 * @returns {boolean}
 */
function isSquareAttacked(board, targetRow, targetCol, byWhite) {
  // Check attacks from knights
  const knightDeltas = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightDeltas) {
    const r = targetRow + dr;
    const c = targetCol + dc;
    if (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece && piece.toLowerCase() === 'n' && isWhitePiece(piece) === byWhite) {
        return true;
      }
    }
  }

  // Check attacks from pawns
  const pawnDir = byWhite ? 1 : -1; // White pawns attack upward (negative row), so from our target's perspective, attackers are below
  for (const dc of [-1, 1]) {
    const r = targetRow + pawnDir;
    const c = targetCol + dc;
    if (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece && piece.toLowerCase() === 'p' && isWhitePiece(piece) === byWhite) {
        return true;
      }
    }
  }

  // Check attacks from king (adjacent squares)
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = targetRow + dr;
      const c = targetCol + dc;
      if (inBounds(r, c)) {
        const piece = board[r][c];
        if (piece && piece.toLowerCase() === 'k' && isWhitePiece(piece) === byWhite) {
          return true;
        }
      }
    }
  }

  // Check attacks along rook/queen lines (horizontal and vertical)
  const rookDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of rookDirs) {
    let r = targetRow + dr;
    let c = targetCol + dc;
    while (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece) {
        if (isWhitePiece(piece) === byWhite) {
          const p = piece.toLowerCase();
          if (p === 'r' || p === 'q') {
            return true;
          }
        }
        break; // Blocked by a piece
      }
      r += dr;
      c += dc;
    }
  }

  // Check attacks along bishop/queen lines (diagonals)
  const bishopDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of bishopDirs) {
    let r = targetRow + dr;
    let c = targetCol + dc;
    while (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece) {
        if (isWhitePiece(piece) === byWhite) {
          const p = piece.toLowerCase();
          if (p === 'b' || p === 'q') {
            return true;
          }
        }
        break; // Blocked by a piece
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

/**
 * Check if the side to move is in check
 * @param {string} fen
 * @returns {boolean}
 */
function isInCheck(fen) {
  const state = parseFen(fen);
  const isWhiteTurn = state.turn === 'w';
  const kingPos = findKing(state.board, isWhiteTurn);
  if (!kingPos) return false;
  
  // King is in check if attacked by opponent's pieces
  return isSquareAttacked(state.board, kingPos.row, kingPos.col, !isWhiteTurn);
}

/**
 * Apply a move on a board and return the new board (doesn't validate legality)
 * Used for testing if a move leaves the king in check
 * @param {(string|null)[][]} board
 * @param {string} fromSquare
 * @param {string} toSquare
 * @param {string} enPassant
 * @returns {(string|null)[][]}
 */
function applyMoveToBoard(board, fromSquare, toSquare, enPassant) {
  const newBoard = cloneBoard(board);
  const { row: fromRow, col: fromCol } = squareToCoords(fromSquare);
  const { row: toRow, col: toCol } = squareToCoords(toSquare);
  const piece = newBoard[fromRow][fromCol];
  
  if (!piece) return newBoard;

  // Handle en passant capture
  if (
    piece.toLowerCase() === 'p' &&
    fromCol !== toCol &&
    newBoard[toRow][toCol] == null &&
    enPassant === toSquare
  ) {
    const direction = isWhitePiece(piece) ? -1 : 1;
    const capturedRow = toRow - direction;
    newBoard[capturedRow][toCol] = null;
  }

  // Handle castling - move the rook too
  if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
    if (toCol === 6) {
      // Kingside
      newBoard[toRow][5] = newBoard[toRow][7];
      newBoard[toRow][7] = null;
    } else if (toCol === 2) {
      // Queenside
      newBoard[toRow][3] = newBoard[toRow][0];
      newBoard[toRow][0] = null;
    }
  }

  // Move the piece
  newBoard[fromRow][fromCol] = null;
  
  // Handle pawn promotion (default to queen)
  let placedPiece = piece;
  if (piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)) {
    placedPiece = isWhitePiece(piece) ? 'Q' : 'q';
  }
  newBoard[toRow][toCol] = placedPiece;

  return newBoard;
}

/**
 * Check if a move would leave the moving side's king in check
 * Also handles castling through/into check
 * @param {object} state - parsed FEN state
 * @param {string} fromSquare
 * @param {string} toSquare
 * @returns {boolean} true if the move is illegal (leaves king in check)
 */
function moveWouldLeaveInCheck(state, fromSquare, toSquare) {
  const { row: fromRow, col: fromCol } = squareToCoords(fromSquare);
  const piece = state.board[fromRow][fromCol];
  const isWhiteTurn = state.turn === 'w';
  const opponentIsWhite = !isWhiteTurn;

  // Special handling for castling - can't castle through or into check
  if (piece && piece.toLowerCase() === 'k') {
    const { col: toCol } = squareToCoords(toSquare);
    if (Math.abs(toCol - fromCol) === 2) {
      // This is a castling move
      // Can't castle if currently in check
      if (isSquareAttacked(state.board, fromRow, fromCol, opponentIsWhite)) {
        return true;
      }
      
      // Can't castle through check (the square the king passes through)
      const throughCol = fromCol + (toCol > fromCol ? 1 : -1);
      if (isSquareAttacked(state.board, fromRow, throughCol, opponentIsWhite)) {
        return true;
      }
      
      // Final destination will be checked below with normal logic
    }
  }

  // Apply the move to get the resulting board
  const newBoard = applyMoveToBoard(state.board, fromSquare, toSquare, state.enPassant);
  
  // Find king position after the move
  const kingPos = findKing(newBoard, isWhiteTurn);
  if (!kingPos) return true; // No king found - shouldn't happen, but treat as illegal
  
  // Check if the king is attacked after the move
  return isSquareAttacked(newBoard, kingPos.row, kingPos.col, opponentIsWhite);
}

function canCaptureEnPassant(state) {
  if (state.enPassant === '-') {
    return false;
  }

  const { row: targetRow, col: targetCol } = squareToCoords(state.enPassant);
  const pawnRow = targetRow + (state.turn === 'w' ? 1 : -1);
  const pawn = state.turn === 'w' ? 'P' : 'p';

  if (!inBounds(pawnRow, targetCol)) {
    return false;
  }

  for (const fromCol of [targetCol - 1, targetCol + 1]) {
    if (!inBounds(pawnRow, fromCol)) {
      continue;
    }

    if (state.board[pawnRow][fromCol] !== pawn) {
      continue;
    }

    const fromSquare = coordsToSquare(pawnRow, fromCol);
    if (!moveWouldLeaveInCheck(state, fromSquare, state.enPassant)) {
      return true;
    }
  }

  return false;
}

function getPositionKey(position) {
  const state = typeof position === 'string' ? parseFen(position) : position;

  return [
    boardToPlacement(state.board),
    state.turn,
    normalizeCastling(state.castling),
    canCaptureEnPassant(state) ? state.enPassant : '-',
  ].join(' ');
}

/**
 * Get all truly legal moves for the current position (filtering out moves that leave king in check)
 * @param {object} state - parsed FEN state
 * @returns {string[]} array of UCI moves
 */
function getAllLegalMoves(state) {
  const allMoves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (piece == null) continue;

      const pieceTurn = isWhitePiece(piece) ? 'w' : 'b';
      if (pieceTurn !== state.turn) continue;

      const fromSquare = coordsToSquare(row, col);
      const pseudoLegalMoves = getLegalMovesFromState(state, fromSquare);

      for (const toSquare of pseudoLegalMoves) {
        // Check if this move would leave our king in check
        if (moveWouldLeaveInCheck(state, fromSquare, toSquare)) {
          continue;
        }

        const { row: toRow } = squareToCoords(toSquare);
        const needsPromotion =
          piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7);
        allMoves.push(`${fromSquare}${toSquare}${needsPromotion ? 'q' : ''}`);
      }
    }
  }

  return allMoves;
}

/**
 * Check if the side to move is in checkmate
 * (in check AND has no legal moves)
 * @param {string} fen
 * @returns {boolean}
 */
function isCheckmate(fen) {
  const state = parseFen(fen);
  
  // Must be in check to be checkmate
  if (!isInCheck(fen)) {
    return false;
  }
  
  // If there are any legal moves, it's not checkmate
  const legalMoves = getAllLegalMoves(state);
  return legalMoves.length === 0;
}

/**
 * Check if the side to move is in stalemate
 * (NOT in check AND has no legal moves)
 * @param {string} fen
 * @returns {boolean}
 */
function isStalemate(fen) {
  const state = parseFen(fen);
  
  // Must NOT be in check to be stalemate
  if (isInCheck(fen)) {
    return false;
  }
  
  // If there are any legal moves, it's not stalemate
  const legalMoves = getAllLegalMoves(state);
  return legalMoves.length === 0;
}

function hasInsufficientMaterial(state) {
  const nonKings = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.toLowerCase() === 'k') {
        continue;
      }

      const normalized = piece.toLowerCase();
      if (normalized === 'p' || normalized === 'q' || normalized === 'r') {
        return false;
      }

      nonKings.push({
        piece: normalized,
        squareColor: (row + col) % 2,
      });
    }
  }

  if (nonKings.length === 0) {
    return true;
  }

  if (
    nonKings.length === 1 &&
    (nonKings[0].piece === 'b' || nonKings[0].piece === 'n')
  ) {
    return true;
  }

  return (
    nonKings.length === 2 &&
    nonKings[0].piece === 'b' &&
    nonKings[1].piece === 'b' &&
    nonKings[0].squareColor === nonKings[1].squareColor
  );
}

/**
 * Get the game status for a position
 * @param {string} fen
 * @param {{ positionHistory?: string[] }} [options]
 * @returns {'active' | 'check' | 'checkmate' | 'stalemate' | 'draw'}
 */
function getGameStatus(fen, options = {}) {
  const state = parseFen(fen);
  const inCheck = isInCheck(fen);
  const legalMoves = getAllLegalMoves(state);
  const hasLegalMoves = legalMoves.length > 0;
  const positionKey = getPositionKey(state);
  const occurrences = Array.isArray(options.positionHistory)
    ? options.positionHistory.filter((entry) => entry === positionKey).length
    : 0;

  if (occurrences >= 3 || state.halfMove >= 100 || hasInsufficientMaterial(state)) {
    return 'draw';
  }

  if (inCheck && !hasLegalMoves) {
    return 'checkmate';
  }
  
  if (!inCheck && !hasLegalMoves) {
    return 'stalemate';
  }
  
  if (inCheck) {
    return 'check';
  }
  
  return 'active';
}

module.exports = {
  parseFen,
  boardToFen,
  applyMove,
  getLegalMoves,
  getAllLegalMoves,
  getRandomMove,
  getPositionKey,
  isInCheck,
  isCheckmate,
  isStalemate,
  getGameStatus,
};
