import { isValidWord } from './dictionary';

export interface Tile {
  letter: string;
  placedBy: number;
}

export type BoardCell = Tile[];
export type Board = BoardCell[][];

export interface Player {
  id: number;
  name: string;
  score: number;
  rack: string[];
  isAi: boolean;
  aiLevel?: 'easy' | 'medium' | 'hard';
}

export interface PlayPlacement {
  r: number;
  c: number;
  letter: string;
}

export interface PlayHistoryItem {
  playerId: number;
  playerName: string;
  word: string;       // primary word
  allWords: string[]; // all words formed this turn
  score: number;
  type: 'play' | 'pass' | 'exchange';
  placedTiles: { r: number; c: number; letter: string; prevHeight: number }[];
  turnIndex: number;
}

export interface GameState {
  board: Board;
  players: Player[];
  tileBag: string[];
  currentTurn: number;
  consecutivePasses: number;
  history: PlayHistoryItem[];
  gameEnded: boolean;
  winnerId: number | null;
}

export const BOARD_SIZE = 10;
export const MAX_STACK_HEIGHT = 5;

export const TILE_DISTRIBUTION: { [letter: string]: number } = {
  E: 8,
  A: 7, I: 7, O: 7,
  S: 6,
  D: 5, L: 5, M: 5, N: 5, R: 5, T: 5, U: 5,
  C: 4,
  B: 3, F: 3, G: 3, H: 3, P: 3,
  K: 2, W: 2, Y: 2,
  J: 1, QU: 1, V: 1, X: 1, Z: 1
};

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [])
  );
}

export function copyBoard(board: Board): Board {
  return board.map(row => row.map(cell => [...cell]));
}

export function getBoardTopLetter(board: Board, r: number, c: number): string | null {
  const cell = board[r]?.[c];
  if (!cell || cell.length === 0) return null;
  return cell[cell.length - 1].letter;
}

export function getBoardStackHeight(board: Board, r: number, c: number): number {
  return board[r]?.[c]?.length || 0;
}

export function generateShuffledBag(): string[] {
  const bag: string[] = [];
  for (const [letter, count] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export interface WordFormed {
  word: string;
  cells: { r: number; c: number }[];
}

export function validatePlay(
  board: Board,
  placements: PlayPlacement[],
  isFirstMove: boolean,
  playerRack: string[]
): {
  isValid: boolean;
  error?: string;
  wordsFormed?: WordFormed[];
  score?: number;
  invalidWord?: string;
} {
  if (placements.length === 0) return { isValid: false, error: 'No tiles placed.' };

  for (const p of placements) {
    if (p.r < 0 || p.r >= BOARD_SIZE || p.c < 0 || p.c >= BOARD_SIZE)
      return { isValid: false, error: 'Tiles placed out of board boundaries.' };
    if (getBoardStackHeight(board, p.r, p.c) >= MAX_STACK_HEIGHT)
      return { isValid: false, error: `Stack at (${p.r + 1},${p.c + 1}) is already at maximum height.` };
    if (getBoardTopLetter(board, p.r, p.c) === p.letter)
      return { isValid: false, error: `Cannot stack '${p.letter}' on top of an identical letter.` };
  }

  const rackCopy = [...playerRack];
  for (const p of placements) {
    const idx = rackCopy.indexOf(p.letter);
    if (idx === -1) return { isValid: false, error: `Rack does not contain '${p.letter}'.` };
    rackCopy.splice(idx, 1);
  }

  const firstP = placements[0];
  const allSameRow = placements.every(p => p.r === firstP.r);
  const allSameCol = placements.every(p => p.c === firstP.c);
  if (!allSameRow && !allSameCol)
    return { isValid: false, error: 'All tiles must be in a single row or column.' };

  const playDirection = placements.length === 1 ? 'both' : (allSameRow ? 'horizontal' : 'vertical');
  const mainRow = firstP.r;
  const mainCol = firstP.c;

  const tempBoard = copyBoard(board);
  for (const p of placements) tempBoard[p.r][p.c].push({ letter: p.letter, placedBy: -1 });

  if (isFirstMove) {
    const centers = [{ r:4,c:4 },{ r:4,c:5 },{ r:5,c:4 },{ r:5,c:5 }];
    if (!placements.some(p => centers.some(c => c.r === p.r && c.c === p.c)))
      return { isValid: false, error: 'First word must cover one of the four centre squares.' };
  } else {
    let connected = false;
    for (const p of placements) {
      if (getBoardStackHeight(board, p.r, p.c) > 0) { connected = true; break; }
      for (const n of [{ r:p.r-1,c:p.c },{ r:p.r+1,c:p.c },{ r:p.r,c:p.c-1 },{ r:p.r,c:p.c+1 }]) {
        if (n.r >= 0 && n.r < BOARD_SIZE && n.c >= 0 && n.c < BOARD_SIZE &&
            getBoardStackHeight(board, n.r, n.c) > 0) { connected = true; break; }
      }
      if (connected) break;
    }
    if (!connected) return { isValid: false, error: 'Placements must connect with existing tiles.' };
  }

  if (!isFirstMove) {
    const existingWords = findWordsOnBoard(board);
    const placedSet = new Set(placements.map(p => `${p.r},${p.c}`));
    for (const word of existingWords) {
      if (word.cells.every(cell => placedSet.has(`${cell.r},${cell.c}`)))
        return { isValid: false, error: `You cannot completely cover the word '${word.word}'.` };
    }
  }

  const getWordAt = (r: number, c: number, dir: 'h' | 'v'): WordFormed | null => {
    let start = dir === 'h' ? c : r;
    let end = dir === 'h' ? c : r;
    while (start > 0) {
      const prev = start - 1;
      if ((dir === 'h' ? tempBoard[r][prev] : tempBoard[prev][c]).length === 0) break;
      start = prev;
    }
    while (end < BOARD_SIZE - 1) {
      const next = end + 1;
      if ((dir === 'h' ? tempBoard[r][next] : tempBoard[next][c]).length === 0) break;
      end = next;
    }
    if (start === end) return null;
    const cells: { r: number; c: number }[] = [];
    let wordStr = '';
    for (let idx = start; idx <= end; idx++) {
      const cr = dir === 'h' ? r : idx;
      const cc = dir === 'h' ? idx : c;
      const letter = getBoardTopLetter(tempBoard, cr, cc);
      if (letter) { wordStr += letter; cells.push({ r: cr, c: cc }); }
    }
    return { word: wordStr, cells };
  };

  const wordsFormed: WordFormed[] = [];
  const wordSigs = new Set<string>();
  const addWord = (wf: WordFormed) => {
    const sig = `${wf.cells[0].r},${wf.cells[0].c}_${wf.cells[wf.cells.length-1].r},${wf.cells[wf.cells.length-1].c}`;
    if (!wordSigs.has(sig)) { wordSigs.add(sig); wordsFormed.push(wf); }
  };

  if (playDirection === 'horizontal') {
    const cols = placements.map(p => p.c);
    for (let col = Math.min(...cols); col <= Math.max(...cols); col++) {
      if (getBoardStackHeight(tempBoard, mainRow, col) === 0)
        return { isValid: false, error: 'Horizontal placements cannot have gaps.' };
    }
    const mw = getWordAt(mainRow, Math.min(...cols), 'h');
    if (mw) addWord(mw);
  } else if (playDirection === 'vertical') {
    const rows = placements.map(p => p.r);
    for (let row = Math.min(...rows); row <= Math.max(...rows); row++) {
      if (getBoardStackHeight(tempBoard, row, mainCol) === 0)
        return { isValid: false, error: 'Vertical placements cannot have gaps.' };
    }
    const mw = getWordAt(Math.min(...rows), mainCol, 'v');
    if (mw) addWord(mw);
  } else {
    const mh = getWordAt(mainRow, mainCol, 'h');
    const mv = getWordAt(mainRow, mainCol, 'v');
    if (mh) addWord(mh);
    if (mv) addWord(mv);
  }

  for (const p of placements) {
    if (playDirection === 'horizontal') { const cw = getWordAt(p.r, p.c, 'v'); if (cw) addWord(cw); }
    else if (playDirection === 'vertical') { const cw = getWordAt(p.r, p.c, 'h'); if (cw) addWord(cw); }
  }

  if (wordsFormed.length === 0) return { isValid: false, error: 'Placements do not form any words.' };

  for (const wf of wordsFormed) {
    if (!isValidWord(wf.word))
      return { isValid: false, error: `'${wf.word}' is not a recognised word.`, invalidWord: wf.word };
  }

  return { isValid: true, wordsFormed, score: calculateScore(tempBoard, placements, wordsFormed) };
}

export function calculateScore(
  board: Board,
  placements: PlayPlacement[],
  wordsFormed: WordFormed[]
): number {
  let total = 0;
  for (const wf of wordsFormed) {
    let wordScore = 0;
    const isFlat = wf.cells.every(cell => getBoardStackHeight(board, cell.r, cell.c) === 1);
    if (isFlat) {
      wordScore += wf.cells.length * 2;
    } else {
      for (const cell of wf.cells) wordScore += getBoardStackHeight(board, cell.r, cell.c);
    }
    for (const cell of wf.cells) {
      if (getBoardTopLetter(board, cell.r, cell.c) === 'QU') wordScore += 2;
    }
    total += wordScore;
  }
  if (placements.length === 7) total += 20;
  return total;
}

export function findWordsOnBoard(board: Board): WordFormed[] {
  const words: WordFormed[] = [];
  const sigs = new Set<string>();
  const addWord = (wf: WordFormed) => {
    const sig = `${wf.cells[0].r},${wf.cells[0].c}_${wf.cells[wf.cells.length-1].r},${wf.cells[wf.cells.length-1].c}`;
    if (!sigs.has(sig)) { sigs.add(sig); words.push(wf); }
  };
  for (let r = 0; r < BOARD_SIZE; r++) {
    let cur: { r: number; c: number }[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (getBoardStackHeight(board, r, c) > 0) cur.push({ r, c });
      else { if (cur.length >= 2) addWord({ word: cur.map(cell => getBoardTopLetter(board, cell.r, cell.c)).join(''), cells: [...cur] }); cur = []; }
    }
    if (cur.length >= 2) addWord({ word: cur.map(cell => getBoardTopLetter(board, cell.r, cell.c)).join(''), cells: cur });
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let cur: { r: number; c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (getBoardStackHeight(board, r, c) > 0) cur.push({ r, c });
      else { if (cur.length >= 2) addWord({ word: cur.map(cell => getBoardTopLetter(board, cell.r, cell.c)).join(''), cells: [...cur] }); cur = []; }
    }
    if (cur.length >= 2) addWord({ word: cur.map(cell => getBoardTopLetter(board, cell.r, cell.c)).join(''), cells: cur });
  }
  return words;
}
