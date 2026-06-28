import {
  Board,
  BOARD_SIZE,
  PlayPlacement,
  validatePlay,
  copyBoard,
  getBoardTopLetter,
  getBoardStackHeight,
  WordFormed
} from './upwords-engine';
import { getTrieRoot, TrieNode, isValidWord, isCommonWord } from './dictionary';

export interface CandidateMove {
  placements: PlayPlacement[];
  wordsFormed: WordFormed[];
  score: number;
  word: string; // The primary word formed
}

/**
 * Transposes a board for vertical search symmetry
 */
function transposeBoard(board: Board): Board {
  const transposed: Board = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    const row: any[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      row.push([...board[r][c]]);
    }
    transposed.push(row);
  }
  return transposed;
}

/**
 * Transposes placements back to original board coordinates
 */
function transposePlacements(placements: PlayPlacement[]): PlayPlacement[] {
  return placements.map(p => ({
    r: p.c,
    c: p.r,
    letter: p.letter
  }));
}

/**
 * Removes one instance of a letter from a rack
 */
function removeLetter(rack: string[], letter: string): string[] {
  const index = rack.indexOf(letter);
  if (index === -1) return rack;
  const newRack = [...rack];
  newRack.splice(index, 1);
  return newRack;
}

/**
 * Checks if a cell touches any existing tiles on the board
 */
function isCellConnected(board: Board, r: number, c: number): boolean {
  if (getBoardStackHeight(board, r, c) > 0) return true;
  const neighbors = [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 }
  ];
  for (const n of neighbors) {
    if (n.r >= 0 && n.r < BOARD_SIZE && n.c >= 0 && n.c < BOARD_SIZE) {
      if (getBoardStackHeight(board, n.r, n.c) > 0) return true;
    }
  }
  return false;
}

/**
 * Checks if a perpendicular word formed by placing a tile is valid.
 * This is used to prune invalid search branches early.
 */
function isPerpendicularWordValid(
  board: Board,
  r: number,
  c: number,
  letter: string
): boolean {
  let start = r;
  let end = r;

  // Scan up
  while (start > 0) {
    const prev = start - 1;
    if (getBoardStackHeight(board, prev, c) === 0) break;
    start = prev;
  }

  // Scan down
  while (end < BOARD_SIZE - 1) {
    const next = end + 1;
    if (getBoardStackHeight(board, next, c) === 0) break;
    end = next;
  }

  if (start === end) return true; // No perpendicular word of length >= 2 is formed

  let wordStr = '';
  for (let rowIdx = start; rowIdx <= end; rowIdx++) {
    if (rowIdx === r) {
      wordStr += letter;
    } else {
      const top = getBoardTopLetter(board, rowIdx, c);
      if (top) wordStr += top;
    }
  }

  return isValidWord(wordStr);
}

/**
 * Generates all legal moves for a given board and rack.
 */
export function generateAllLegalMoves(
  board: Board,
  rack: string[],
  isFirstMove: boolean
): CandidateMove[] {
  const trieRoot = getTrieRoot();
  if (!trieRoot) {
    console.warn('Trie root not available, dictionary not loaded.');
    return [];
  }

  const moves: CandidateMove[] = [];
  const moveSignatures = new Set<string>();

  const addMove = (placements: PlayPlacement[]) => {
    // Sort placements to make signature unique
    const sortedP = [...placements].sort((a, b) => a.r - b.r || a.c - b.c);
    const sig = sortedP.map(p => `${p.r},${p.c}:${p.letter}`).join('|');
    
    if (moveSignatures.has(sig)) return;
    moveSignatures.add(sig);

    // Validate play officially
    const validation = validatePlay(board, placements, isFirstMove, rack);
    if (validation.isValid && validation.wordsFormed && validation.score !== undefined) {
      // Find the primary word (usually the longest or the main word)
      const primaryWord = validation.wordsFormed[0]?.word || '';
      moves.push({
        placements,
        wordsFormed: validation.wordsFormed,
        score: validation.score,
        word: primaryWord
      });
    }
  };

  // Search horizontal moves on standard board
  searchHorizontalMoves(board, rack, isFirstMove, trieRoot, addMove);

  // Search vertical moves by transposing the board, searching horizontally,
  // and then transposing the placements back
  const transposedBoard = transposeBoard(board);
  searchHorizontalMoves(
    transposedBoard,
    rack,
    isFirstMove,
    trieRoot,
    (transposedPlacements) => {
      const originalPlacements = transposePlacements(transposedPlacements);
      addMove(originalPlacements);
    }
  );

  // Sort moves by score descending
  return moves.sort((a, b) => b.score - a.score);
}

/**
 * Internal helper to search horizontal moves on a board
 */
function searchHorizontalMoves(
  board: Board,
  rack: string[],
  isFirstMove: boolean,
  trieRoot: TrieNode,
  onMoveFound: (placements: PlayPlacement[]) => void
) {
  // Backtracking function
  const backtrack = (
    r: number,
    c: number,
    startCol: number,
    node: TrieNode,
    currentRack: string[],
    placements: PlayPlacement[],
    connected: boolean
  ) => {
    // Word ending conditions
    const hasPlaced = placements.length > 0;
    if (node.isWord && hasPlaced) {
      // Word can stop here if the next cell is empty or we are at the end of the board
      const nextCellIsEmpty = c === BOARD_SIZE || getBoardStackHeight(board, r, c) === 0;
      if (nextCellIsEmpty) {
        // Enforce connection rules (unless first move)
        if (isFirstMove || connected) {
          onMoveFound(placements);
        }
      }
    }

    // Stop search if we exceed board boundary
    if (c >= BOARD_SIZE) return;

    const cellHeight = getBoardStackHeight(board, r, c);

    if (cellHeight === 0) {
      // Square is empty: we MUST place a tile from our rack
      for (const char of Object.keys(node.children)) {
        // Handle standard letter
        if (currentRack.includes(char)) {
          // Check if placing this character is valid perpendicular-wise
          if (isPerpendicularWordValid(board, r, c, char)) {
            const nextRack = removeLetter(currentRack, char);
            const nextPlacements = [...placements, { r, c, letter: char }];
            const nextConnected = connected || isCellConnected(board, r, c);
            backtrack(
              r,
              c + 1,
              startCol,
              node.children[char],
              nextRack,
              nextPlacements,
              nextConnected
            );
          }
        }

        // Handle 'QU' tile (represents 'Q' then 'U' in Trie, occupying one cell)
        if (char === 'Q' && currentRack.includes('QU')) {
          const uNode = node.children['Q']?.children?.['U'];
          if (uNode) {
            if (isPerpendicularWordValid(board, r, c, 'QU')) {
              const nextRack = removeLetter(currentRack, 'QU');
              const nextPlacements = [...placements, { r, c, letter: 'QU' }];
              const nextConnected = connected || isCellConnected(board, r, c);
              backtrack(
                r,
                c + 1,
                startCol,
                uNode,
                nextRack,
                nextPlacements,
                nextConnected
              );
            }
          }
        }
      }
    } else {
      // Square is occupied: we can either use it or stack on it
      const topLetter = getBoardTopLetter(board, r, c)!;

      // Option A: Use the letter on the board (no rack tiles consumed)
      if (topLetter !== 'QU') {
        if (node.children[topLetter]) {
          backtrack(
            r,
            c + 1,
            startCol,
            node.children[topLetter],
            currentRack,
            placements,
            true // using board letter implies connection
          );
        }
      } else {
        // Handle using board 'QU' (matches 'Q' then 'U' in trie)
        const uNode = node.children['Q']?.children?.['U'];
        if (uNode) {
          backtrack(
            r,
            c + 1,
            startCol,
            uNode,
            currentRack,
            placements,
            true
          );
        }
      }

      // Option B: Stack a letter on top
      if (cellHeight < 5) {
        for (const char of Object.keys(node.children)) {
          // Cannot stack identical letter
          if (char === topLetter) continue;

          // Stack standard letter
          if (currentRack.includes(char)) {
            if (isPerpendicularWordValid(board, r, c, char)) {
              const nextRack = removeLetter(currentRack, char);
              const nextPlacements = [...placements, { r, c, letter: char }];
              backtrack(
                r,
                c + 1,
                startCol,
                node.children[char],
                nextRack,
                nextPlacements,
                true // Stacking is a connection
              );
            }
          }

          // Stack 'QU' tile
          if (char === 'Q' && currentRack.includes('QU') && topLetter !== 'QU') {
            const uNode = node.children['Q']?.children?.['U'];
            if (uNode) {
              if (isPerpendicularWordValid(board, r, c, 'QU')) {
                const nextRack = removeLetter(currentRack, 'QU');
                const nextPlacements = [...placements, { r, c, letter: 'QU' }];
                backtrack(
                  r,
                  c + 1,
                  startCol,
                  uNode,
                  nextRack,
                  nextPlacements,
                  true
                );
              }
            }
          }
        }
      }
    }
  };

  // Run backtrack for each row and start column
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Optimization: a word can only start at c if the cell to its left is empty
      const cellLeftIsEmpty = c === 0 || getBoardStackHeight(board, r, c - 1) === 0;
      if (cellLeftIsEmpty) {
        backtrack(r, c, c, trieRoot, rack, [], false);
      }
    }
  }
}

/**
 * Logic for a virtual opponent's turn.
 * Chooses a move based on AI difficulty level.
 * Returns the selected move, or null if it decides to pass/exchange.
 */
export function getAiPlay(
  board: Board,
  player: { name: string; rack: string[]; aiLevel?: 'easy' | 'medium' | 'hard' },
  isFirstMove: boolean
): CandidateMove | null {
  console.log(`AI (${player.name}, Level: ${player.aiLevel}) generating moves...`);
  const moves = generateAllLegalMoves(board, player.rack, isFirstMove);
  console.log(`AI (${player.name}) generated ${moves.length} legal moves.`);

  if (moves.length === 0) {
    return null; // Decides to pass or exchange (handled by game logic)
  }

  // Filter moves into common vs obscure words
  const commonWordMoves = moves.filter(m => isCommonWord(m.word));
  const obscureWordMoves = moves.filter(m => !isCommonWord(m.word));

  console.log(`AI (${player.name}) found ${commonWordMoves.length} common moves and ${obscureWordMoves.length} obscure moves.`);

  const level = player.aiLevel || 'medium';

  // We choose our pool based on whether common words exist
  const useCommon = commonWordMoves.length > 0;
  const activePool = useCommon ? commonWordMoves : obscureWordMoves;

  if (level === 'hard') {
    // Hard level: Plays the highest-scoring common word if available, else the highest obscure word
    return activePool[0];
  } else if (level === 'medium') {
    // Medium level: Picks a good move from the top 35% of the active pool (preferring common)
    const count = Math.max(1, Math.floor(activePool.length * 0.35));
    const candidateIdx = Math.floor(Math.random() * count);
    return activePool[candidateIdx];
  } else {
    // Easy level: Picks a lower-scoring move from the bottom 45% of the active pool (preferring common)
    const startIndex = Math.floor(activePool.length * 0.55);
    const count = activePool.length - startIndex;
    if (count <= 1) {
      return activePool[activePool.length - 1];
    }
    const candidateIdx = startIndex + Math.floor(Math.random() * count);
    return activePool[candidateIdx];
  }
}
