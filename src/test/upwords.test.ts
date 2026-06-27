import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadDictionary, isValidWord } from '../lib/dictionary';
import {
  createEmptyBoard,
  validatePlay,
  calculateScore,
  copyBoard,
  getBoardStackHeight,
  getBoardTopLetter,
  BOARD_SIZE,
  MAX_STACK_HEIGHT
} from '../lib/upwords-engine';
import { generateAllLegalMoves } from '../lib/upwords-ai';

describe('Upwords Engine Tests', () => {
  beforeAll(async () => {
    // Mock fetch to load the local dictionary file in Vitest (Node)
    global.fetch = vi.fn().mockImplementation(() => {
      const filePath = path.resolve(__dirname, '../../public/dictionary.txt');
      const content = fs.readFileSync(filePath, 'utf8');
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(content),
        status: 200
      } as any);
    });

    await loadDictionary();
  });

  it('loads the dictionary correctly', () => {
    expect(isValidWord('GAME')).toBe(true);
    expect(isValidWord('WORDS')).toBe(true);
    expect(isValidWord('XYZXYZ')).toBe(false);
  });

  it('enforces the center square requirement on the first move', () => {
    const board = createEmptyBoard();
    const rack = ['C', 'A', 'T', 'S', 'O', 'M', 'E'];

    // Invalid placement: doesn't cover center (center is row index 4,5 and col index 4,5)
    const play1 = [
      { r: 0, c: 0, letter: 'C' },
      { r: 0, c: 1, letter: 'A' },
      { r: 0, c: 2, letter: 'T' }
    ];
    const validation1 = validatePlay(board, play1, true, rack);
    expect(validation1.isValid).toBe(false);
    expect(validation1.error).toContain('center square');

    // Valid placement: covers cell (4,4)
    const play2 = [
      { r: 4, c: 2, letter: 'C' },
      { r: 4, c: 3, letter: 'A' },
      { r: 4, c: 4, letter: 'T' }
    ];
    const validation2 = validatePlay(board, play2, true, rack);
    expect(validation2.isValid).toBe(true);
    expect(validation2.wordsFormed?.[0].word).toBe('CAT');
  });

  it('calculates score correctly for flat and stacked words', () => {
    const board = createEmptyBoard();
    
    // Play flat word CAT: 3 tiles, height 1. Score should be 3 * 2 = 6 points
    const play1 = [
      { r: 4, c: 3, letter: 'C' },
      { r: 4, c: 4, letter: 'A' },
      { r: 4, c: 5, letter: 'T' }
    ];
    const validation1 = validatePlay(board, play1, true, ['C', 'A', 'T']);
    expect(validation1.isValid).toBe(true);
    expect(validation1.score).toBe(6); // flat scores 2 points per tile

    // Update board with the CAT play
    for (const p of play1) {
      board[p.r][p.c].push({ letter: p.letter, placedBy: 0 });
    }

    // Now stack 'B' on top of 'C' to form BAT.
    // 'B' will be at height 2, 'A' at height 1, 'T' at height 1.
    // Since it contains stacked letters, it should score 2 + 1 + 1 = 4 points.
    const play2 = [
      { r: 4, c: 3, letter: 'B' }
    ];
    const validation2 = validatePlay(board, play2, false, ['B']);
    expect(validation2.isValid).toBe(true);
    expect(validation2.score).toBe(4); // stacked scores sum of heights (2 + 1 + 1)
  });

  it('rejects stacking identical letters', () => {
    const board = createEmptyBoard();
    const play1 = [
      { r: 4, c: 4, letter: 'A' },
      { r: 4, c: 5, letter: 'N' }
    ];
    for (const p of play1) {
      board[p.r][p.c].push({ letter: p.letter, placedBy: 0 });
    }

    // Attempt to stack 'A' on top of 'A'
    const play2 = [
      { r: 4, c: 4, letter: 'A' }
    ];
    const validation2 = validatePlay(board, play2, false, ['A']);
    expect(validation2.isValid).toBe(false);
    expect(validation2.error).toContain('identical letter');
  });

  it('rejects stacking past the maximum height limit of 5', () => {
    const board = createEmptyBoard();
    
    // Place a stack of height 5 at (4,4)
    board[4][4] = [
      { letter: 'A', placedBy: 0 },
      { letter: 'B', placedBy: 1 },
      { letter: 'C', placedBy: 2 },
      { letter: 'D', placedBy: 3 },
      { letter: 'E', placedBy: 0 }
    ];
    
    // Stack at (4,5) has height 1 to keep it connected
    board[4][5] = [{ letter: 'N', placedBy: 0 }];

    // Attempt to stack 'F' on top of 'E' (height would become 6)
    const play = [
      { r: 4, c: 4, letter: 'F' }
    ];
    const validation = validatePlay(board, play, false, ['F']);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('exceeds maximum height');
  });

  it('rejects completely covering a word', () => {
    const board = createEmptyBoard();
    const play1 = [
      { r: 4, c: 4, letter: 'A' },
      { r: 4, c: 5, letter: 'T' }
    ];
    for (const p of play1) {
      board[p.r][p.c].push({ letter: p.letter, placedBy: 0 });
    }

    // Attempt to place 'U' and 'P' directly on top of 'A' and 'T' to form 'UP'
    // This completely covers the existing word 'AT' and is illegal.
    const play2 = [
      { r: 4, c: 4, letter: 'U' },
      { r: 4, c: 5, letter: 'P' }
    ];
    const validation = validatePlay(board, play2, false, ['U', 'P']);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('completely cover');
  });

  it('finds legal moves and matches AI generation', () => {
    const board = createEmptyBoard();
    
    // First move
    const moves = generateAllLegalMoves(board, ['C', 'A', 'T', 'S', 'X', 'Y', 'Z'], true);
    
    expect(moves.length).toBeGreaterThan(0);
    // Best move should be a high-scoring valid word covering center
    expect(moves[0].word).toBeDefined();
    expect(moves[0].score).toBeGreaterThan(0);
  });
});
