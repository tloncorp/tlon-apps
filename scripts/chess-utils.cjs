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
  return getLegalMovesFromState(parseFen(fen), square);
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

  if (promotion && !PROMOTION_PIECES.includes(promotion)) {
    throw new Error(`Invalid promotion piece: ${promotion}`);
  }

  const legalMoves = getLegalMovesFromState(state, fromSquare);
  if (!legalMoves.includes(toSquare)) {
    throw new Error(`Illegal move: ${uci}`);
  }

  const { row: fromRow, col: fromCol } = squareToCoords(fromSquare);
  const { row: toRow, col: toCol } = squareToCoords(toSquare);
  const board = cloneBoard(state.board);
  const piece = board[fromRow][fromCol];
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
  const allMoves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (piece == null) {
        continue;
      }

      const pieceTurn = isWhitePiece(piece) ? 'w' : 'b';
      if (pieceTurn !== state.turn) {
        continue;
      }

      const fromSquare = coordsToSquare(row, col);
      const targets = getLegalMovesFromState(state, fromSquare);
      for (const toSquare of targets) {
        const { row: toRow } = squareToCoords(toSquare);
        const needsPromotion =
          piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7);
        allMoves.push(`${fromSquare}${toSquare}${needsPromotion ? 'q' : ''}`);
      }
    }
  }

  if (allMoves.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * allMoves.length);
  return allMoves[randomIndex];
}

module.exports = {
  parseFen,
  boardToFen,
  applyMove,
  getLegalMoves,
  getRandomMove,
};
