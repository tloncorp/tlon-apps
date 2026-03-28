import { isValidUrl, makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import type * as cn from '@tloncorp/shared/logic';
import {
  Button,
  ForwardingProps,
  Icon,
  Image,
  Pressable,
  Text,
  useCopy,
} from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { clamp } from 'lodash';
import React, {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, Linking, Platform } from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { ScrollView, View, ViewStyle, XStack, YStack, styled } from 'tamagui';

import { useNowPlayingController } from '../../contexts/nowPlaying';
import { Waveform } from '../AudioRecorder/Waveform';
import {
  ContentReferenceLoader,
  IsInsideReferenceContext,
  Reference,
} from '../ContentReference';
import { VideoEmbed } from '../Embed';
import { FileUploadPreview } from '../FileUploadPreview';
import { HighlightedCode } from '../HighlightedCode';
import { BlockquoteSideBorder } from './BlockquoteSideBorder';
import { InlineRenderer } from './InlineRenderer';
import { ContentContext, useContentContext } from './contentUtils';
import * as store from '@tloncorp/shared/store';

const DUMMY_WAVEFORM_VALUES = [
  1, 0.5, 1, 0.2, 0.8, 0.4, 0.6, 0.3, 0.7, 0.1, 0.9, 0.5, 1, 0.4, 0.6,
];

export const BlockWrapper = styled(View, {
  name: 'ContentBlock',
  context: ContentContext,
  padding: '$l',
  cursor: 'default',
  variants: {
    isNotice: {
      true: {
        paddingLeft: '$4xl',
        paddingRight: '$4xl',
        width: '100%',
        alignItems: 'center',
      },
    },
    type: {} as Record<cn.BlockData['type'], ViewStyle>,
  } as const,
});

export function ListBlock({
  block,
  ...props
}: { block: cn.ListBlockData } & Omit<
  ComponentProps<typeof ListNode>,
  'node'
>) {
  return <ListNode node={block.list} {...props} />;
}

function ListNode({
  node,
}: {
  node: cn.ListData;
} & ComponentProps<typeof View>) {
  return (
    <View flex={1}>
      {node.content.length ? (
        <LineRenderer trimmed={false} inlines={node.content} />
      ) : null}
      {node.children?.map((childNode, i) => (
        <XStack key={i} gap="$m">
          <ListItemMarker index={i} type={node.type ?? 'unordered'} />
          <ListNode key={i} node={childNode} />
        </XStack>
      ))}
    </View>
  );
}

function ListItemMarker({
  type,
  index,
}: {
  type: 'ordered' | 'unordered' | 'tasklist';
  index: number;
}) {
  switch (type) {
    case 'ordered':
      return <TextContent trimmed={false}>{index + 1}.</TextContent>;
    case 'unordered':
      return <TextContent trimmed={false}>•︎</TextContent>;
    case 'tasklist':
      // We return null here because the tasklist marker is rendered in the
      // InlineTask component in the InlineRenderer
      return null;
  }
}

/**
 * Renders a list of inlines as a single line of text (can be broken up by line breaks)
 */
export const LineRenderer = memo(function LineRendererComponent({
  inlines,
  ...props
}: {
  inlines: cn.InlineData[];
  color?: string;
  trimmed?: boolean;
} & ComponentProps<typeof TextContent>) {
  return (
    // Spread color prop as undefined value will override when we don't want it to
    <TextContent {...props}>
      {inlines.map((child, i) => {
        return <InlineRenderer key={i} inline={child} />;
      })}
    </TextContent>
  );
});

function TextContent(props: ComponentProps<typeof LineText>) {
  const context = useContentContext();
  const TextComponent =
    useContext(BlockRendererContext)?.renderers?.lineText ?? LineText;
  const defaultProps =
    useContext(BlockRendererContext)?.settings?.lineText ?? {};

  return (
    <TextComponent {...defaultProps} {...props} isNotice={context.isNotice} />
  );
}

export const LineText = styled(Text, {
  color: '$primaryText',
  size: '$body',
  context: ContentContext,
  userSelect: 'text',
  cursor: 'text',
  variants: {
    isNotice: {
      true: {
        color: '$tertiaryText',
        size: '$label/m',
        textAlign: 'center',
      },
    },
  } as const,
});

export function CodeBlock({
  block,
  textProps,
  ...props
}: { block: cn.CodeBlockData } & ComponentProps<typeof Reference.Frame> & {
    textProps?: ComponentProps<typeof Text>;
  }) {
  const { doCopy, didCopy } = useCopy(block.content);
  const handleStartShouldSetResponder = useCallback(() => true, []);

  return (
    <Reference.Frame {...props}>
      <Reference.Header paddingVertical="$l">
        <Reference.Title>
          <Reference.TitleText>{'Code'}</Reference.TitleText>
        </Reference.Title>
        <Reference.TitleText onPress={doCopy}>
          {didCopy ? 'Copied' : 'Copy'}
        </Reference.TitleText>
      </Reference.Header>
      <ScrollView horizontal>
        <Reference.Body
          pointerEvents="auto"
          // Hack to prevent touch events from being eaten by Pressables higher
          // in the stack.
          onStartShouldSetResponder={handleStartShouldSetResponder}
        >
          <Text size={'$mono/m'} padding="$l" {...textProps}>
            <HighlightedCode code={block.content} lang={block.lang} />
          </Text>
        </Reference.Body>
      </ScrollView>
    </Reference.Frame>
  );
}

export function ParagraphBlock({
  block,
  ...props
}: { block: cn.ParagraphBlockData } & Omit<
  ComponentProps<typeof LineRenderer>,
  'inlines'
>) {
  return <LineRenderer inlines={block.content} {...props} />;
}

export function ReferenceBlock({
  block,
  ...props
}: { block: cn.ReferenceBlockData } & Omit<
  ComponentProps<typeof ContentReferenceLoader>,
  'reference'
>) {
  const isInsideReference = useContext(IsInsideReferenceContext);

  if (isInsideReference) {
    return null;
  }

  return <ContentReferenceLoader reference={block} {...props} />;
}

export function VoiceMemoBlock({
  block,
  ...props
}: { block: cn.VoiceMemoBlockData } & ComponentProps<
  typeof Reference.Frame
>) {
  const { togglePlayback, progress, status, isThisSourceLoaded } =
    useNowPlayingController({ sourceUri: block.voiceMemo.fileUri });

  const candlePlaybackPosition = useMemo(() => {
    const candleCount = block.voiceMemo.waveformPreview
      ? block.voiceMemo.waveformPreview.length
      : DUMMY_WAVEFORM_VALUES.length;
    if (
      progress?.loadState !== 'loaded' ||
      !isThisSourceLoaded ||
      progress.duration === 0
    ) {
      return 0;
    }
    return clamp(
      Math.floor((progress.currentTime / progress.duration) * candleCount),
      0,
      candleCount - 1
    );
  }, [progress, block.voiceMemo.waveformPreview, isThisSourceLoaded]);

  return (
    <Reference.Frame {...props}>
      <Reference.Header alignItems="center">
        <Reference.Title>
          <Reference.TitleText>Voice Memo</Reference.TitleText>
        </Reference.Title>

        <Reference.TitleIcon type="Wave" color="$primaryText" />
      </Reference.Header>

      <Reference.Body
        flexDirection="column"
        alignItems="stretch"
        gap="$l"
        padding="$l"
        // Reference.Body definition sets `pointerEvents: none`
        pointerEvents="auto"
      >
        <XStack gap="$xl" alignItems="center">
          <Pressable
            backgroundColor="$background"
            width="$4xl"
            aspectRatio={1}
            alignItems="center"
            justifyContent="center"
            borderRadius={8}
            cursor="pointer"
            hoverStyle={{ backgroundColor: '$positiveBackground' }}
            pressStyle={{ opacity: 0.5 }}
            onPress={togglePlayback}
          >
            {(() => {
              switch (status) {
                case null:
                  return <Icon type={'Play'} color="$primaryText" />;
                case 'loading':
                  return <ActivityIndicator />;
                case 'playing':
                  return <Icon type={'Stop'} color="$primaryText" />;
                case 'paused':
                  return <Icon type={'Play'} color="$primaryText" />;
              }
            })()}
          </Pressable>
          <XStack flex={1} gap={9} alignItems="center">
            <Waveform
              candleWidth={3}
              candleSpacing={1}
              candlePlaybackPosition={candlePlaybackPosition}
              values={block.voiceMemo.waveformPreview ?? DUMMY_WAVEFORM_VALUES}
              style={{ flex: 1, height: 22 }}
            />
            {block.voiceMemo.duration != null && (
              <Text size="$label/s" color="$secondaryText">
                {progress?.loadState === 'loaded'
                  ? makePrettyTimeFromMs(progress.currentTime * 1000)
                  : makePrettyTimeFromMs(block.voiceMemo.duration * 1000)}
              </Text>
            )}
          </XStack>
        </XStack>

        {block.voiceMemo.transcription && (
          <VoiceMemoTranscription
            transcription={block.voiceMemo.transcription}
          />
        )}
      </Reference.Body>
    </Reference.Frame>
  );
}

function VoiceMemoTranscription({ transcription }: { transcription: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <XStack gap="$s" alignItems="baseline">
      <Text
        flex={1}
        size="$label/m"
        numberOfLines={expanded ? undefined : 1}
        ellipsizeMode="tail"
        selectable
      >
        {transcription}
      </Text>
      {!expanded && (
        <Pressable onPress={() => setExpanded(true)}>
          <Text size="$label/m" color="$tertiaryText">
            See more
          </Text>
        </Pressable>
      )}
    </XStack>
  );
}

// Ochre-aligned chart palette
const CHART_COLORS = [
  '#3B80E8',
  '#E8913B',
  '#7B61FF',
  '#36B37E',
  '#E22A2A',
  '#00B8D9',
];

const CHART_SVG_WIDTH = 320;
const GRID_COLOR = '#E5E5E5';
const CHART_PADDING = { top: 8, right: 8, bottom: 4, left: 28 };

// ── Chess Board Renderer ────────────────────────────────────────────────

const CHESS_PIECE_MAP: Record<string, string> = {
  // Both colors use filled glyphs — white pieces get fill+stroke to distinguish
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

// Ochre chess board themes
const CHESS_THEMES: Record<string, { light: string; dark: string; lastMove: string; whitePiece: string; blackPiece: string; whiteStroke: string; blackStroke: string }> = {
  // Theme A: Blue/Cream — current
  blue: {
    light: '#EEE8DC', dark: '#3B80E8', lastMove: 'rgba(232,145,59,0.45)',
    whitePiece: '#F0E6C8', blackPiece: '#1A1818', whiteStroke: 'none', blackStroke: 'none',
  },
  // Theme B: Slate/Warm — dark charcoal squares, cream light
  slate: {
    light: '#F5F0E8', dark: '#2D3748', lastMove: 'rgba(59,128,232,0.4)',
    whitePiece: '#1A1818', blackPiece: '#F5F0E8', whiteStroke: '#AAAAAA', blackStroke: '#555555',
  },
  // Theme C: Green/Ivory — classic tournament feel, Ochre green accent
  green: {
    light: '#F0ECD8', dark: '#36B37E', lastMove: 'rgba(232,145,59,0.4)',
    whitePiece: '#1A1818', blackPiece: '#FFFFFF', whiteStroke: '#BBBBBB', blackStroke: '#36B37E',
  },
  // Theme D: Purple/White — bold, Ochre purple accent
  purple: {
    light: '#FAF8FF', dark: '#7B61FF', lastMove: 'rgba(232,145,59,0.4)',
    whitePiece: '#1A1818', blackPiece: '#FFFFFF', whiteStroke: '#CCCCCC', blackStroke: '#7B61FF',
  },
};
const CHESS_COORD_COLOR = '#666666';
const CHESS_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function parseFen(fen: string): (string | null)[][] {
  const ranks = fen.split(' ')[0].split('/');
  const board: (string | null)[][] = [];
  for (const rank of ranks) {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < Number(ch); i++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    board.push(row);
  }
  return board;
}

function parseLastMove(move: string | null | undefined): { from: [number, number]; to: [number, number] } | null {
  if (!move || move.length < 4) return null;
  const fc = move.charCodeAt(0) - 97; // file index 0-7
  const fr = 8 - Number(move[1]);     // rank index 0-7
  const tc = move.charCodeAt(2) - 97;
  const tr = 8 - Number(move[3]);
  if ([fc, fr, tc, tr].some(v => v < 0 || v > 7)) return null;
  return { from: [fr, fc], to: [tr, tc] };
}

function squareToAlgebraic(row: number, col: number): string {
  return `${CHESS_FILES[col]}${8 - row}`;
}

/** Apply a move to a FEN string and return the updated FEN (best-effort, handles basic moves + castling) */
function applyMoveFen(fen: string, from: [number, number], to: [number, number]): string {
  const rows = fen.split(' ')[0].split('/');
  const board: (string | null)[][] = rows.map(rank => {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') { for (let i = 0; i < Number(ch); i++) row.push(null); }
      else row.push(ch);
    }
    return row;
  });
  const piece = board[from[0]][from[1]];
  if (!piece) return fen;
  // Castling: king moves 2 squares
  if (piece === 'K' && from[0] === 7 && from[1] === 4) {
    if (to[1] === 6) { board[7][5] = board[7][7]; board[7][7] = null; }
    if (to[1] === 2) { board[7][3] = board[7][0]; board[7][0] = null; }
  }
  if (piece === 'k' && from[0] === 0 && from[1] === 4) {
    if (to[1] === 6) { board[0][5] = board[0][7]; board[0][7] = null; }
    if (to[1] === 2) { board[0][3] = board[0][0]; board[0][0] = null; }
  }
  board[from[0]][from[1]] = null;
  // Pawn promotion → queen
  let placed = piece;
  if (piece === 'P' && to[0] === 0) placed = 'Q';
  if (piece === 'p' && to[0] === 7) placed = 'q';
  board[to[0]][to[1]] = placed;
  // Rebuild FEN position
  const newPos = board.map(row => {
    let s = ''; let e = 0;
    for (const sq of row) { if (sq == null) { e++; } else { if (e) { s += e; e = 0; } s += sq; } }
    if (e) s += e;
    return s;
  }).join('/');
  const parts = fen.split(' ');
  parts[0] = newPos;
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}

/** Chess legal move computation (no check detection, MVP) */
const CHESS_LEGAL_FILES = 'abcdefgh';
function fenToBoard(fen: string): (string | null)[][] {
  return fen.split(' ')[0].split('/').map(rank => {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') { for (let i = 0; i < Number(ch); i++) row.push(null); }
      else row.push(ch);
    }
    return row;
  });
}
function isWhite(p: string) { return p === p.toUpperCase(); }
function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function getEnPassantTarget(fen: string): [number, number] | null {
  const ep = fen.split(' ')[3];
  if (!ep || ep === '-') return null;
  const col = CHESS_LEGAL_FILES.indexOf(ep[0]);
  const row = 8 - Number(ep[1]);
  return inBounds(row, col) ? [row, col] : null;
}
function getCastlingRights(fen: string) { return fen.split(' ')[2] ?? '-'; }
function getLegalMovesForPiece(fen: string, row: number, col: number): [number, number][] {
  const board = fenToBoard(fen);
  const piece = board[row][col];
  if (!piece) return [];
  const white = isWhite(piece);
  const moves: [number, number][] = [];
  const addRay = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const t = board[r][c];
      if (t == null) { moves.push([r, c]); }
      else { if (isWhite(t) !== white) moves.push([r, c]); break; }
      r += dr; c += dc;
    }
  };
  const p = piece.toLowerCase();
  if (p === 'r') { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => addRay(dr,dc)); }
  else if (p === 'b') { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => addRay(dr,dc)); }
  else if (p === 'q') { [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => addRay(dr,dc)); }
  else if (p === 'n') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
      const r = row+dr, c = col+dc;
      if (inBounds(r,c)) { const t = board[r][c]; if (!t || isWhite(t) !== white) moves.push([r,c]); }
    });
  } else if (p === 'k') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row+dr, c = col+dc;
      if (inBounds(r,c)) { const t = board[r][c]; if (!t || isWhite(t) !== white) moves.push([r,c]); }
    }
    // Castling
    const cr = getCastlingRights(fen);
    const homeRow = white ? 7 : 0;
    if (row === homeRow && col === 4) {
      if (white && cr.includes('K') && !board[homeRow][5] && !board[homeRow][6] && board[homeRow][7] === 'R')
        moves.push([homeRow, 6]);
      if (white && cr.includes('Q') && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] && board[homeRow][0] === 'R')
        moves.push([homeRow, 2]);
      if (!white && cr.includes('k') && !board[homeRow][5] && !board[homeRow][6] && board[homeRow][7] === 'r')
        moves.push([homeRow, 6]);
      if (!white && cr.includes('q') && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] && board[homeRow][0] === 'r')
        moves.push([homeRow, 2]);
    }
  } else if (p === 'p') {
    const dir = white ? -1 : 1;
    const startRow = white ? 6 : 1;
    if (inBounds(row+dir, col) && !board[row+dir][col]) {
      moves.push([row+dir, col]);
      if (row === startRow && !board[row+dir*2][col]) moves.push([row+dir*2, col]);
    }
    const ep = getEnPassantTarget(fen);
    for (const dc of [-1, 1]) {
      const r = row+dir, c = col+dc;
      if (!inBounds(r,c)) continue;
      const t = board[r][c];
      if (t && isWhite(t) !== white) moves.push([r,c]);
      else if (!t && ep && ep[0] === r && ep[1] === c) moves.push([r,c]);
    }
  }
  return moves;
}

export function ChessBlock({
  block,
  postId,
  channelId,
  ...props
}: { block: cn.ChessBlockData; postId?: string; channelId?: string } & ComponentProps<typeof Reference.Frame>) {
  const theme = CHESS_THEMES[block.theme ?? 'blue'] ?? CHESS_THEMES.blue;
  const [availableWidth, setAvailableWidth] = useState(280);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [candidate, setCandidate] = useState<[number, number] | null>(null);
  const [staged, setStaged] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  // Optimistic FEN: updated immediately when user confirms a move, before agent responds
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  // Legal target squares for selected piece [row, col][]
  const [legalTargets, setLegalTargets] = useState<[number, number][]>([]);
  const boardSize = Math.min(availableWidth, 400);

  // When the blob's FEN changes (agent responded), clear optimistic state
  React.useEffect(() => {
    setOptimisticFen(null);
  }, [block.fen]);

  // Debug: log context on mount
  React.useEffect(() => {
    console.log('[chess] mount', { postId, channelId, fen: block.fen });
  }, []);

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const { width } = e.nativeEvent.layout;
      if (width > 0) {
        setAvailableWidth(width);
      }
    },
    []
  );

  const sq = boardSize / 8;
  const activeFen = optimisticFen ?? block.fen;
  const board = useMemo(() => parseFen(activeFen), [activeFen]);
  // Visual board: apply staged move so piece snaps to target square before confirm
  const visualBoard = useMemo(() => {
    if (!staged) return board;
    const b = board.map(row => row.slice());
    const piece = b[staged.from[0]][staged.from[1]];
    b[staged.from[0]][staged.from[1]] = null;
    b[staged.to[0]][staged.to[1]] = piece;
    return b;
  }, [board, staged]);
  const lastMove = useMemo(() => parseLastMove(block.lastMove), [block.lastMove]);

  // Identity check — hardcoded to ~malmur-halmex for demo
  const currentUser = '~malmur-halmex';
  const myColor = block.players?.white === currentUser ? 'white'
    : block.players?.black === currentUser ? 'black'
    : null;
  const isMyTurn = myColor != null
    && block.turn === myColor
    && block.status === 'active';
  // Only allow moving your own pieces
  const canMovePiece = useCallback((piece: string | null) => {
    if (!piece || !myColor) return false;
    const isWhitePiece = piece === piece.toUpperCase();
    return myColor === 'white' ? isWhitePiece : !isWhitePiece;
  }, [myColor]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (staged) return;
    const piece = board[row][col];
    if (selected) {
      const isTarget = legalTargets.some(([r,c]) => r === row && c === col);
      if (isTarget) {
        setStaged({ from: selected, to: [row, col] });
        setCandidate([row, col]);
        setLegalTargets([]);
        setSelected(null);
        return;
      }
      if (piece && canMovePiece(piece)) {
        const targets = getLegalMovesForPiece(activeFen, row, col);
        setSelected([row, col]);
        setLegalTargets(targets);
        setCandidate(null);
        return;
      }
      setSelected(null);
      setLegalTargets([]);
      setCandidate(null);
      return;
    }
    if (piece && canMovePiece(piece)) {
      const targets = getLegalMovesForPiece(activeFen, row, col);
      setSelected([row, col]);
      setLegalTargets(targets);
    }
  }, [staged, selected, legalTargets, board, activeFen, canMovePiece]);

  const resetState = useCallback(() => {
    setSelected(null);
    setCandidate(null);
    setStaged(null);
    setLegalTargets([]);
  }, []);

  const handleDone = useCallback(async () => {
    if (!staged) { resetState(); return; }
    const move = `${squareToAlgebraic(staged.from[0], staged.from[1])}${squareToAlgebraic(staged.to[0], staged.to[1])}`;
    console.log('[chess] handleDone', { move, postId, channelId });
    // Apply optimistically so board updates immediately
    try {
      const newFen = applyMoveFen(activeFen, staged.from, staged.to);
      setOptimisticFen(newFen);
    } catch (e) {
      console.warn('Optimistic FEN update failed:', e);
    }
    resetState();
    if (postId && channelId) {
      try {
        // Post move as a top-level message with game reference
        const ship = channelId.split('/')[1] ?? '~malmur-halmex';
        const ts = Date.now();
        const body = JSON.stringify([{
          id: ts, action: 'poke', ship: ship.replace('~',''),
          app: 'channels', mark: 'channel-action-1',
          json: {
            channel: {
              nest: channelId,
              action: {
                post: {
                  add: {
                    content: [{ inline: [`move:${move}`] }],
                    sent: ts,
                    kind: '/chat',
                    author: ship,
                    blob: null,
                    meta: { title: '', image: '', description: '', cover: '' },
                  }
                }
              }
            }
          }
        }]);
        const resp = await fetch(`/~/channel/chess-move-${ts}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (resp.ok) {
          console.log('[chess] move sent:', move);
        } else {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text.slice(0,100)}`);
        }
      } catch (e) {
        console.error('[chess] Failed to send move:', e);
        setOptimisticFen(null);
      }
    }
  }, [staged, activeFen, postId, channelId, resetState]);

  const statusLabel = block.status === 'check' ? '🔴 Check'
    : block.status === 'checkmate' ? '🏁 Checkmate'
    : block.status === 'stalemate' ? '🤝 Stalemate'
    : block.status === 'draw' ? '🤝 Draw'
    : block.turn ? `${block.turn === 'white' ? '⬜' : '⬛'} ${block.turn}'s move`
    : null;

  return (
    <Reference.Frame padding="$l" {...props}>
      <Reference.Header>
        <Reference.Title>
          <Text>♟ </Text>
          <Reference.TitleText>Chess</Reference.TitleText>
        </Reference.Title>
        {statusLabel ? (
          <Text size="$label/s" color="$tertiaryText">{statusLabel}</Text>
        ) : null}
      </Reference.Header>

      <View onLayout={handleLayout} style={{ width: '100%' }}>
        <YStack alignItems="center" width="100%" gap="$s">
          <View
            style={{ position: 'relative', width: boardSize, height: boardSize }}
          >
            <Svg width={boardSize} height={boardSize} viewBox={`0 0 ${boardSize} ${boardSize}`}>
              {/* Squares */}
              {Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => {
                  const isLight = (r + c) % 2 === 0;
                  return (
                    <Rect key={`sq-${r}-${c}`} x={c * sq} y={r * sq} width={sq} height={sq} fill={isLight ? theme.light : theme.dark} />
                  );
                })
              )}

              {/* Last-move highlights */}
              {!selected && lastMove && (
                <>
                  <Rect x={lastMove.from[1] * sq} y={lastMove.from[0] * sq} width={sq} height={sq} fill={theme.lastMove} />
                  <Rect x={lastMove.to[1] * sq} y={lastMove.to[0] * sq} width={sq} height={sq} fill={theme.lastMove} />
                </>
              )}

              {/* Selected square highlight */}
              {selected && (
                <Rect x={selected[1] * sq} y={selected[0] * sq} width={sq} height={sq} fill="rgba(59,128,232,0.45)" />
              )}

              {/* Candidate/staged square highlight */}
              {candidate && !(candidate[0] === selected?.[0] && candidate[1] === selected?.[1]) && (
                <Rect x={candidate[1] * sq} y={candidate[0] * sq} width={sq} height={sq} fill="rgba(232,145,59,0.5)" />
              )}

              {/* Legal move dots — only show squares from legalTargets */}
              {selected && !staged && legalTargets.map(([r, c]) => {
                const targetPiece = board[r]?.[c];
                return (
                  <Circle
                    key={`dot-${r}-${c}`}
                    cx={c * sq + sq / 2}
                    cy={r * sq + sq / 2}
                    r={sq * (targetPiece ? 0.46 : 0.18)}
                    fill={targetPiece ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)'}
                    stroke={targetPiece ? 'rgba(0,0,0,0.35)' : 'none'}
                    strokeWidth={targetPiece ? sq * 0.07 : 0}
                  />
                );
              })}

              {/* File labels */}
              {CHESS_FILES.map((f, i) => (
                <SvgText key={`file-${i}`} x={i * sq + sq - 3} y={boardSize - 2} fontSize={sq * 0.18}
                  fill={(7 + i) % 2 === 0 ? theme.dark : theme.light} textAnchor="end" fontWeight="600">
                  {f}
                </SvgText>
              ))}

              {/* Rank labels */}
              {Array.from({ length: 8 }, (_, r) => (
                <SvgText key={`rank-${r}`} x={3} y={r * sq + sq * 0.22} fontSize={sq * 0.18}
                  fill={CHESS_COORD_COLOR} textAnchor="start" fontWeight="600">
                  {String(8 - r)}
                </SvgText>
              ))}

              {/* Pieces: use visualBoard so staged move snaps piece to target */}
              {visualBoard.map((row, r) =>
                row.map((piece, c) => {
                  if (!piece) return null;
                  const unicode = CHESS_PIECE_MAP[piece];
                  if (!unicode) return null;
                  const isWhitePiece = piece === piece.toUpperCase();
                  const x = c * sq + sq / 2;
                  const y = r * sq + sq * 0.75;
                  const fontSize = sq * 0.7;
                  if (isWhitePiece) {
                    // White: dark shadow layer + light fill layer for clear contrast
                    return (
                      <React.Fragment key={`p-${r}-${c}`}>
                        <SvgText x={x + 0.8} y={y + 0.8} fontSize={fontSize} textAnchor="middle" fill="#333333" opacity={0.6}>
                          {unicode}
                        </SvgText>
                        <SvgText x={x} y={y} fontSize={fontSize} textAnchor="middle" fill="#F5EDD0">
                          {unicode}
                        </SvgText>
                      </React.Fragment>
                    );
                  }
                  return (
                    <SvgText key={`p-${r}-${c}`} x={x} y={y} fontSize={fontSize} textAnchor="middle" fill="#1A1818">
                      {unicode}
                    </SvgText>
                  );
                })
              )}

            </Svg>

            {/* Click overlay — Pressable grid absolutely over the board (works on web) */}
            {isMyTurn && (
              <View style={{ position: 'absolute', top: 0, left: 0, width: boardSize, height: boardSize }}>
                {Array.from({ length: 8 }, (_, r) =>
                  Array.from({ length: 8 }, (_, col) => (
                    <Pressable
                      key={`click-${r}-${col}`}
                      onPress={() => handleSquareClick(r, col)}
                      style={{
                        position: 'absolute',
                        left: col * sq,
                        top: r * sq,
                        width: sq,
                        height: sq,
                      }}
                    />
                  ))
                )}
              </View>
            )}

            {!isMyTurn && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="$label/s" color="$tertiaryText">
                  Waiting for {block.players?.[block.turn === 'white' ? 'white' : 'black'] ?? 'opponent'}…
                </Text>
              </View>
            )}
          </View>

          {block.players && (
            <XStack justifyContent="space-between" alignItems="center" width={boardSize} paddingTop={14} paddingBottom={6}>
              <Text size="$label/s" color="$secondaryText">🟦 {block.players.white}</Text>
              <Text size="$label/s" color="$secondaryText">⬜ {block.players.black}</Text>
            </XStack>
          )}

          {staged && (
            <XStack gap="$m" width={boardSize}>
              <Button
                flex={1}
                preset="primary"
                label="✓ Move"
                onPress={handleDone}
              />
              <Button
                flex={1}
                preset="secondaryOutline"
                label="✕ Cancel"
                onPress={resetState}
              />
            </XStack>
          )}

          {block.moveHistory && block.moveHistory.length > 0 && (
            <Text size="$label/s" color="$tertiaryText" width={boardSize} numberOfLines={1}>
              Moves: {block.moveHistory.join(', ')}
            </Text>
          )}
        </YStack>
      </View>
    </Reference.Frame>
  );
}

// ── Chart Helpers ───────────────────────────────────────────────────────

function chartIcon(type: string): string {
  if (type === 'pie') return '\uD83E\uDD67';
  if (type === 'sparkline') return '\u26A1';
  if (type === 'line') return '\uD83D\uDCC8';
  if (type === 'area') return '\uD83D\uDCC9';
  return '\uD83D\uDCCA';
}

function getSeriesColor(series: cn.ChartBlockData['series'][number], i: number) {
  return series.color ?? CHART_COLORS[i % CHART_COLORS.length];
}

function GridLines({
  width,
  height,
  maxVal,
}: {
  width: number;
  height: number;
  maxVal?: number;
}) {
  const lines = [0.25, 0.5, 0.75, 1.0];
  return (
    <>
      {lines.map((frac) => {
        const y = CHART_PADDING.top + (1 - frac) * height;
        const label = maxVal != null ? `${Math.round(maxVal * frac)}` : null;
        return (
          <React.Fragment key={frac}>
            <Line
              x1={CHART_PADDING.left}
              y1={y}
              x2={width - CHART_PADDING.right}
              y2={y}
              stroke={GRID_COLOR}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            {label != null && (
              <SvgText
                x={2}
                y={y + 3}
                fontSize={8}
                fill="#AAAAAA"
                textAnchor="start"
              >
                {label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

function BarChartSvg({ block, width = CHART_SVG_WIDTH }: { block: cn.ChartBlockData; width?: number }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = width - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const groupCount = Math.max(...block.series.map((s) => s.values.length), 1);
  const seriesCount = block.series.length;
  const groupWidth = drawW / groupCount;
  const groupGap = Math.max(groupWidth * 0.1, 2);
  const barsWidth = groupWidth - groupGap;
  const barGap = 1;
  const barWidth = (barsWidth - barGap * (seriesCount - 1)) / seriesCount;

  return (
    <Svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`}>
      <GridLines width={width} height={drawH} maxVal={maxVal} />
      {Array.from({ length: groupCount }).map((_, gi) =>
        block.series.map((s, si) => {
          const val = s.values[gi] ?? 0;
          const pct = (val - Math.min(minFloor, 0)) / range;
          const barH = Math.max(pct * drawH, 1);
          const x = CHART_PADDING.left + gi * groupWidth + groupGap / 2 + si * (barWidth + barGap);
          const y = CHART_PADDING.top + drawH - barH;
          const color = getSeriesColor(s, si);
          const rx = 3;
          return (
            <React.Fragment key={`${gi}-${si}`}>
              <Rect x={x} y={y} width={barWidth - 1} height={barH} rx={rx} ry={rx} fill={color} />
              {barH > rx && (
                <Rect
                  x={x}
                  y={y + barH - rx}
                  width={barWidth - 1}
                  height={rx}
                  fill={color}
                />
              )}
            </React.Fragment>
          );
        })
      )}
    </Svg>
  );
}

function LineChartSvg({ block, width = CHART_SVG_WIDTH }: { block: cn.ChartBlockData; width?: number }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = width - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const maxLen = Math.max(...block.series.map((s) => s.values.length), 1);

  function toPoint(vi: number, val: number): [number, number] {
    const x = CHART_PADDING.left + (maxLen > 1 ? (vi / (maxLen - 1)) * drawW : drawW / 2);
    const y = CHART_PADDING.top + (1 - (val - Math.min(minFloor, 0)) / range) * drawH;
    return [x, y];
  }

  return (
    <Svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`}>
      <GridLines width={width} height={drawH} maxVal={maxVal} />
      {block.series.map((s, si) => {
        const points = s.values.map((v, vi) => toPoint(vi, v));
        const pointsStr = points.map((p) => p.join(',')).join(' ');
        const color = getSeriesColor(s, si);
        return (
          <React.Fragment key={si}>
            <Polyline points={pointsStr} stroke={color} strokeWidth={2} fill="none" />
            {points.map(([cx, cy], pi) => (
              <Circle key={pi} cx={cx} cy={cy} r={3} fill={color} />
            ))}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function AreaChartSvg({ block, width = CHART_SVG_WIDTH }: { block: cn.ChartBlockData; width?: number }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = width - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const maxLen = Math.max(...block.series.map((s) => s.values.length), 1);
  const baseY = CHART_PADDING.top + drawH;

  function toPoint(vi: number, val: number): [number, number] {
    const x = CHART_PADDING.left + (maxLen > 1 ? (vi / (maxLen - 1)) * drawW : drawW / 2);
    const y = CHART_PADDING.top + (1 - (val - Math.min(minFloor, 0)) / range) * drawH;
    return [x, y];
  }

  return (
    <Svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`}>
      <GridLines width={width} height={drawH} maxVal={maxVal} />
      {block.series.map((s, si) => {
        const points = s.values.map((v, vi) => toPoint(vi, v));
        const color = getSeriesColor(s, si);
        const firstX = points[0]?.[0] ?? CHART_PADDING.left;
        const lastX = points[points.length - 1]?.[0] ?? CHART_PADDING.left;
        const areaPath =
          `M${firstX},${baseY} ` +
          points.map((p) => `L${p[0]},${p[1]}`).join(' ') +
          ` L${lastX},${baseY} Z`;
        const lineStr = points.map((p) => p.join(',')).join(' ');
        return (
          <React.Fragment key={si}>
            <Path d={areaPath} fill={color} opacity={0.3} />
            <Polyline points={lineStr} stroke={color} strokeWidth={2} fill="none" />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function SparklineSvg({ block }: { block: cn.ChartBlockData }) {
  const s = block.series[0];
  if (!s || s.values.length === 0) return null;

  const svgH = 40;
  const drawW = CHART_SVG_WIDTH;
  const padding = 4;
  const drawH = svgH - padding * 2;

  const maxVal = Math.max(...s.values);
  const minVal = Math.min(...s.values);
  const range = maxVal - minVal || 1;

  const points = s.values
    .map((v, i) => {
      const x = s.values.length > 1 ? (i / (s.values.length - 1)) * drawW : drawW / 2;
      const y = padding + (1 - (v - minVal) / range) * drawH;
      return `${x},${y}`;
    })
    .join(' ');

  const delta = s.values[s.values.length - 1]! - s.values[0]!;
  const color = getSeriesColor(s, 0);

  return (
    <XStack alignItems="center" gap="$m">
      <View flex={1}>
        <Svg width="100%" height={svgH} viewBox={`0 0 ${CHART_SVG_WIDTH} ${svgH}`}>
          <Polyline points={points} stroke={color} strokeWidth={2} fill="none" />
        </Svg>
      </View>
      <Text
        size="$label/s"
        color={delta >= 0 ? '#36B37E' : '#E22A2A'}
        fontWeight="500"
      >
        {delta >= 0 ? '+' : ''}
        {delta.toFixed(1)}
      </Text>
    </XStack>
  );
}

function PieChart({ block }: { block: cn.ChartBlockData }) {
  const values = block.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;

  return (
    <YStack gap="$s" paddingVertical="$m">
      {values.map((val, i) => {
        const pct = (Math.max(val, 0) / total) * 100;
        const label = block.xLabels?.[i] ?? block.series[0]?.label ?? `${i}`;
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          <XStack key={i} alignItems="center" gap="$m">
            <View
              width={10}
              height={10}
              borderRadius={5}
              backgroundColor={color}
            />
            <Text size="$label/s" color="$secondaryText" flex={1}>
              {label}
            </Text>
            <View flex={1} height={4} borderRadius={2} backgroundColor={GRID_COLOR} marginHorizontal="$m">
              <View
                height={4}
                borderRadius={2}
                backgroundColor={color}
                width={`${pct}%`}
              />
            </View>
            <Text size="$label/s" color="$primaryText" width={45} textAlign="right">
              {pct.toFixed(1)}%
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}

export function TableBlock({
  block,
  ...props
}: { block: cn.TableBlockData } & ComponentProps<typeof Reference.Frame>) {
  const isRich = block.style !== 'simple';
  const numericCols = block.columns.slice(1).map((_, ci) =>
    block.rows.every(r => typeof r[ci + 1] === 'number')
  );
  const colMaxes = block.columns.slice(1).map((_, ci) =>
    numericCols[ci] ? Math.max(...block.rows.map(r => Number(r[ci + 1]) || 0)) : 0
  );

  return (
    <Reference.Frame padding="$l" {...props}>
      <Reference.Header>
        <Reference.Title>
          <Text>📋 </Text>
          <Reference.TitleText>
            {block.title ?? 'Table'}
          </Reference.TitleText>
        </Reference.Title>
      </Reference.Header>

      {/* Column headers */}
      <XStack borderBottomWidth={1} borderBottomColor="$border" paddingBottom="$s" marginBottom="$xs">
        {block.columns.map((col, i) => (
          <View key={i} style={{ flex: i === 0 ? 2 : 1 }}>
            <Text size="$label/s" color="$tertiaryText" numberOfLines={1}>
              {col.toUpperCase()}
            </Text>
          </View>
        ))}
      </XStack>

      {/* Data rows */}
      {block.rows.map((row, ri) => {
        const dotColor = CHART_COLORS[ri % CHART_COLORS.length];
        return (
          <XStack
            key={ri}
            paddingVertical="$s"
            borderBottomWidth={ri < block.rows.length - 1 ? 1 : 0}
            borderBottomColor="$border"
            alignItems="center"
          >
            {row.map((cell, ci) => {
              const isFirst = ci === 0;
              const isNumeric = !isFirst && numericCols[ci - 1];
              const numVal = isNumeric ? Number(cell) : 0;
              const maxVal = isNumeric ? colMaxes[ci - 1] : 0;
              const barPct = maxVal > 0 ? numVal / maxVal : 0;

              return (
                <View key={ci} style={{ flex: isFirst ? 2 : 1 }}>
                  {isFirst ? (
                    <XStack alignItems="center" gap="$s">
                      <View width={8} height={8} borderRadius={4} backgroundColor={dotColor} />
                      <Text size="$label/m" color="$primaryText" fontWeight="500" numberOfLines={1}>
                        {String(cell)}
                      </Text>
                    </XStack>
                  ) : isNumeric ? (
                    <YStack gap={2}>
                      <Text
                        size="$label/m"
                        color={numVal === 0 ? '$quaternaryText' : '$secondaryText'}
                      >
                        {String(cell)}
                      </Text>
                      {isRich && barPct > 0 && (
                        <View style={{ height: 2, borderRadius: 1, backgroundColor: '#EEEEEE', overflow: 'hidden' }}>
                          <View style={{ width: `${Math.round(barPct * 100)}%`, height: 2, backgroundColor: dotColor, borderRadius: 1, opacity: 0.7 }} />
                        </View>
                      )}
                    </YStack>
                  ) : (
                    <Text size="$label/m" color="$secondaryText" numberOfLines={1}>{String(cell)}</Text>
                  )}
                </View>
              );
            })}
          </XStack>
        );
      })}
    </Reference.Frame>
  );
}

export function ChartBlock({
  block,
  ...props
}: { block: cn.ChartBlockData } & ComponentProps<typeof Reference.Frame>) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const [svgWidth, setSvgWidth] = useState(CHART_SVG_WIDTH);
  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) setSvgWidth(w);
    },
    []
  );

  const seriesColors = block.series.map((s, i) => getSeriesColor(s, i));

  // Sparkline: minimal inline rendering, no header
  if (block.chartType === 'sparkline') {
    return (
      <Reference.Frame padding="$l" {...props}>
        <SparklineSvg block={block} />
      </Reference.Frame>
    );
  }

  const renderChart = () => {
    switch (block.chartType) {
      case 'bar':
        return <BarChartSvg block={block} width={svgWidth} />;
      case 'line':
        return <LineChartSvg block={block} width={svgWidth} />;
      case 'area':
        return <AreaChartSvg block={block} width={svgWidth} />;
      case 'pie':
        return <PieChart block={block} />;
      default:
        return null;
    }
  };

  return (
    <Reference.Frame padding="$l" {...props}>
      <Reference.Header>
        <Reference.Title>
          <Text>{chartIcon(block.chartType)} </Text>
          <Reference.TitleText>
            {block.title ??
              `${block.chartType.charAt(0).toUpperCase()}${block.chartType.slice(1)} Chart`}
          </Reference.TitleText>
        </Reference.Title>
        {block.yLabel ? (
          <Text size="$label/s" color="$tertiaryText">
            {block.yLabel}
          </Text>
        ) : null}
      </Reference.Header>

      <View onLayout={handleLayout}>{renderChart()}</View>

      {block.xLabels && block.chartType !== 'pie' && (
        <XStack paddingLeft={CHART_PADDING.left} paddingRight={CHART_PADDING.right}>
          {block.xLabels.map((label, i) => (
            <Text
              key={i}
              flex={1}
              size="$label/s"
              color="$tertiaryText"
              textAlign="center"
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </XStack>
      )}

      {block.series.length > 1 && (
        <XStack gap="$m" flexWrap="wrap" paddingTop="$s">
          {block.series.map((s, i) => (
            <XStack key={i} alignItems="center" gap="$s">
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={seriesColors[i]}
              />
              <Text size="$label/s" color="$secondaryText">
                {s.label}
              </Text>
            </XStack>
          ))}
        </XStack>
      )}
    </Reference.Frame>
  );
}

export function FileUploadBlock({
  block,
  ...passedProps
}: ForwardingProps<
  typeof FileUploadPreview,
  { block: cn.FileUploadBlockData },
  'file'
>) {
  return <FileUploadPreview file={block.file} {...passedProps} />;
}

export function BigEmojiBlock({
  block,
  ...props
}: { block: cn.BigEmojiBlockData } & ComponentProps<typeof BigEmojiText>) {
  return <BigEmojiText {...props}>{block.emoji}</BigEmojiText>;
}

const BigEmojiText = styled(Text, {
  size: '$emoji/l',
  flexWrap: 'wrap',
  trimmed: true,
});

export function LinkBlock({
  block,
  imageProps,
  renderDescription = true,
  renderTitle = true,
  renderImage = true,
  clickable = true,
  ...props
}: {
  block: cn.LinkBlockData;
  clickable?: boolean;
  renderDescription?: boolean;
  renderTitle?: boolean;
  renderImage?: boolean;
  imageProps?: ComponentProps<typeof ContentImage>;
} & ComponentProps<typeof Reference.Frame>) {
  const urlIsValid = useMemo(() => isValidUrl(block.url), [block.url]);

  const domain = useMemo(() => {
    if (!urlIsValid) {
      return block.url;
    }

    const url = new URL(block.url);
    return url.hostname;
  }, [block.url, urlIsValid]);

  const onPress = useCallback(() => {
    if (!urlIsValid) {
      return;
    }

    if (Platform.OS === 'web') {
      window.open(block.url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(block.url);
    }
  }, [block.url, urlIsValid]);

  if (!urlIsValid) {
    return (
      <Reference.Frame {...props}>
        <Reference.Header>
          <Reference.Title>
            <Icon type="Link" color="$tertiaryText" customSize={[12, 12]} />
            <Reference.TitleText>Invalid URL</Reference.TitleText>
          </Reference.Title>
        </Reference.Header>
        <Reference.Body>
          <View padding="$xl">
            <Text size="$label/m" color="$secondaryText">
              {block.url}
            </Text>
          </View>
        </Reference.Body>
      </Reference.Frame>
    );
  }

  return (
    <Reference.Frame {...props} onPress={clickable ? onPress : undefined}>
      <Reference.Header>
        <Reference.Title>
          <Icon type="Link" color="$tertiaryText" customSize={[12, 12]} />
          <Reference.TitleText>{domain}</Reference.TitleText>
        </Reference.Title>
      </Reference.Header>
      <Reference.Body>
        {renderImage && block.previewImageUrl && (
          <ContentImage
            fallback={null}
            source={block.previewImageUrl}
            flex={1}
            aspectRatio={2}
            flexShrink={0}
            width="100%"
            contentFit="cover"
            contentPosition="center"
            {...imageProps}
          />
        )}
        <YStack flex={0} padding="$xl" gap="$xl">
          <YStack gap="$s">
            <Text fontWeight="500" color="$secondaryText">
              {block.siteName && block.siteName.length > 0
                ? block.siteName
                : domain}
            </Text>
            {renderTitle && (
              <Text size="$label/m" numberOfLines={1}>
                {block.title && block.title.length > 0
                  ? block.title
                  : block.url}
              </Text>
            )}
          </YStack>
          {block.description && renderDescription && (
            <Text size="$label/s" color="$secondaryText">
              {block.description}
            </Text>
          )}
        </YStack>
      </Reference.Body>
    </Reference.Frame>
  );
}

export function VideoBlock({
  block,
  ...props
}: { block: cn.VideoBlockData } & Omit<
  ComponentProps<typeof VideoEmbed>,
  'video'
>) {
  return <VideoEmbed video={block} {...props} />;
}

export function ImageBlock({
  block,
  imageProps,
  ...props
}: {
  block: cn.ImageBlockData;
  imageProps?: ComponentProps<typeof ContentImage>;
} & ComponentProps<typeof View>) {
  const { onPressImage, onLongPress } = useContentContext();
  const [dimensions, setDimensions] = useState({
    width: block.width || null,
    height: block.height || null,
    aspect: block.width && block.height ? block.width / block.height : null,
  });

  const isInsideReference = useContext(IsInsideReferenceContext);

  const handlePress = useCallback(() => {
    onPressImage?.(block.src);
  }, [block.src, onPressImage]);

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    const aspect = e.source.width / e.source.height;
    setDimensions({
      width: e.source.width,
      height: e.source.height,
      aspect,
    });
  }, []);

  const shouldUseAspectRatio = imageProps?.aspectRatio !== 'unset';

  return (
    <Pressable
      overflow="hidden"
      onPress={handlePress}
      onLongPress={onLongPress}
      {...props}
    >
      <ContentImage
        source={{
          uri: block.src,
        }}
        {...(shouldUseAspectRatio
          ? { aspectRatio: dimensions.aspect || 1 }
          : {})}
        {...(isInsideReference
          ? {
              maxHeight: 250,
              resizeMode: 'contain',
            }
          : {})}
        contentFit="contain"
        borderRadius="$s"
        alt={block.alt}
        onLoad={handleImageLoaded}
        {...imageProps}
      />
    </Pressable>
  );
}

const ContentImage = styled(Image, {
  name: 'ContentImage',
  context: ContentContext,
  width: '100%',
  aspectRatio: 1,
  backgroundColor: '$secondaryBackground',
});

export function RuleBlock({
  block: _block,
  ...props
}: { block: cn.RuleBlockData } & ComponentProps<typeof Rule>) {
  return <Rule {...props} />;
}

const Rule = styled(View, {
  borderBottomWidth: 1,
  borderColor: '$border',
});

export function BlockquoteBlock({
  block,
  ...props
}: { block: cn.BlockquoteBlockData } & ComponentProps<typeof YStack>) {
  return (
    <YStack paddingLeft="$l" {...props}>
      <BlockquoteSideBorder />
      <LineRenderer inlines={block.content} color={'$tertiaryText'} />
    </YStack>
  );
}

export function HeaderBlock({
  block,
  ...props
}: { block: cn.HeaderBlockData } & ComponentProps<typeof HeaderText>) {
  return (
    <HeaderText tag={block.level} level={block.level} {...props}>
      {block.children.map((con, i) => (
        <InlineRenderer key={`${con}-${i}`} inline={con} />
      ))}
    </HeaderText>
  );
}

export const HeaderText = styled(Text, {
  variants: {
    level: {
      h1: {
        fontSize: 24,
        fontWeight: 'bold',
      },
      h2: {
        fontSize: 20,
        fontWeight: 'bold',
      },
      h3: {
        fontSize: 16,
        fontWeight: 'bold',
      },
      h4: {
        fontSize: 14,
        fontWeight: 'bold',
      },
      h5: {
        fontSize: 12,
        fontWeight: 'bold',
      },
      h6: {
        fontSize: 10,
        fontWeight: 'bold',
      },
    },
  } as const,
});
HeaderText.displayName = 'HeaderText';

export type BlockRenderer<T extends cn.BlockData> = (props: {
  block: T;
}) => React.ReactNode;

export type BlockRendererConfig = {
  [K in cn.BlockType]: BlockRenderer<cn.BlockFromType<K>>;
} & {
  blockWrapper: (
    props: PropsWithChildren<{
      block: cn.BlockData;
    }>
  ) => React.ReactNode;
  lineText: (props: ComponentProps<typeof LineText>) => React.ReactNode;
};

export const defaultBlockRenderers: BlockRendererConfig = {
  blockWrapper: BlockWrapper,
  lineText: LineText,
  blockquote: BlockquoteBlock,
  paragraph: ParagraphBlock,
  link: LinkBlock,
  image: ImageBlock,
  video: VideoBlock,
  reference: ReferenceBlock,
  code: CodeBlock,
  header: HeaderBlock,
  rule: RuleBlock,
  list: ListBlock,
  bigEmoji: BigEmojiBlock,
  file: FileUploadBlock,
  voicememo: VoiceMemoBlock,
  chart: ChartBlock,
  table: TableBlock,
  chess: ChessBlock,
};

type BlockSettings<T extends ComponentType> = Partial<ComponentProps<T>> & {
  wrapperProps?: Partial<ComponentProps<typeof BlockWrapper>>;
};

export type DefaultRendererProps = {
  blockWrapper: Partial<ComponentProps<typeof BlockWrapper>>;
  lineText: Partial<ComponentProps<typeof LineText>>;
  blockquote: BlockSettings<typeof BlockquoteBlock>;
  paragraph: BlockSettings<typeof ParagraphBlock>;
  link: BlockSettings<typeof LinkBlock>;
  image: BlockSettings<typeof ImageBlock>;
  video: BlockSettings<typeof VideoBlock>;
  reference: BlockSettings<typeof ReferenceBlock>;
  code: BlockSettings<typeof CodeBlock>;
  header: BlockSettings<typeof HeaderBlock>;
  rule: BlockSettings<typeof RuleBlock>;
  list: BlockSettings<typeof ListBlock>;
  bigEmoji: BlockSettings<typeof BigEmojiBlock>;
  file: BlockSettings<typeof FileUploadBlock>;
  voicememo: BlockSettings<typeof VoiceMemoBlock>;
  chart: BlockSettings<typeof ChartBlock>;
  table: BlockSettings<typeof TableBlock>;
  chess: BlockSettings<typeof ChessBlock>;
};

interface BlockRendererContextValue {
  renderers?: Partial<BlockRendererConfig>;
  settings?: Partial<DefaultRendererProps>;
}

const BlockRendererContext = createContext<BlockRendererContextValue>({});

export const BlockRendererProvider = React.memo(function BlockRendererProvider({
  children,
  ...props
}: PropsWithChildren<BlockRendererContextValue>) {
  return (
    <BlockRendererContext.Provider value={props}>
      {children}
    </BlockRendererContext.Provider>
  );
});

export function BlockRenderer({ block }: { block: cn.BlockData }) {
  const { renderers, settings: defaultProps } =
    useContext(BlockRendererContext);
  const Wrapper = renderers?.blockWrapper ?? BlockWrapper;
  const Renderer = (renderers?.[block.type] ??
    defaultBlockRenderers[block.type]) as BlockRenderer<typeof block>;
  const { wrapperProps, ...defaultPropsForBlock } =
    defaultProps?.[block.type] ?? {};
  const defaultPropsForBlockWrapper = defaultProps?.blockWrapper;

  return (
    <Wrapper {...defaultPropsForBlockWrapper} {...wrapperProps} block={block}>
      <Renderer {...defaultPropsForBlock} block={block} />
    </Wrapper>
  );
}
