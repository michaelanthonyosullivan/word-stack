import React, { useState } from 'react';
import { Board as BoardType, PlayPlacement, BOARD_SIZE } from '../lib/upwords-engine';
import { CandidateMove } from '../lib/upwords-ai';

interface BoardProps {
  board: BoardType;
  placements: PlayPlacement[];
  onCellClick: (r: number, c: number) => void;
  onDropTile: (r: number, c: number, letter: string) => void;
  selectedLetter: string | null;
  hint: CandidateMove | null;
  lastPlayPlacements?: { r: number; c: number }[];
}

export function Board({ board, placements, onCellClick, onDropTile, selectedLetter, hint, lastPlayPlacements }: BoardProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const center = Math.floor(BOARD_SIZE / 2);
  const isCenter = (r: number, c: number) => r === center && c === center;
  const getTempPlacement = (r: number, c: number) => placements.find(p => p.r === r && p.c === c);
  const getHintPlacement = (r: number, c: number) => hint?.placements.find(p => p.r === r && p.c === c) ?? null;

  return (
    <div className="w-full flex justify-center items-center py-2">
      {/* Board panel */}
      <div className="board-surface p-2.5 md:p-3.5 max-w-full aspect-square w-[94vw] sm:w-[86vw] md:w-[600px]">
        {/* Dark grid backing */}
        <div className="w-full h-full grid grid-cols-7 grid-rows-7 gap-[3px] md:gap-1 bg-[#1A3D38] p-2 md:p-2.5 rounded-xl">
          {Array.from({ length: BOARD_SIZE }).map((_, r) =>
            Array.from({ length: BOARD_SIZE }).map((_, c) => {
              const cell = board[r][c];
              const stackHeight = cell.length;
              const topLetter = stackHeight > 0 ? cell[stackHeight - 1].letter : null;

              const tempPlacement = getTempPlacement(r, c);
              const hintPlacement = getHintPlacement(r, c);
              const isCenterCell = isCenter(r, c);
              const isLastPlay = lastPlayPlacements?.some(lp => lp.r === r && lp.c === c);
              const cellKey = `${r}-${c}`;
              const isDragTarget = dragOverCell === cellKey;

              let displayLetter: string | null = null;
              let isTemp = false;
              let isHint = false;
              let displayHeight = stackHeight;

              if (tempPlacement) {
                displayLetter = tempPlacement.letter;
                isTemp = true;
                displayHeight = stackHeight + 1;
              } else if (hintPlacement) {
                displayLetter = hintPlacement.letter;
                isHint = true;
                displayHeight = stackHeight + 1;
              } else if (topLetter) {
                displayLetter = topLetter;
              }

              let tileDepthClass = '';
              if (displayHeight === 1) tileDepthClass = 'tile-depth-1';
              else if (displayHeight === 2) tileDepthClass = 'tile-depth-2';
              else if (displayHeight === 3) tileDepthClass = 'tile-depth-3';
              else if (displayHeight === 4) tileDepthClass = 'tile-depth-4';
              else if (displayHeight >= 5) tileDepthClass = 'tile-depth-5';

              // Tile colour: white→cream scale for real tiles, sky for temp, emerald for hint
              let tileBg = '';
              let tileText = '';
              let tileBorder = '';
              if (isTemp) {
                tileBg = 'from-sky-100 to-sky-200';
                tileText = 'text-sky-900';
                tileBorder = 'border-sky-400 ring-2 ring-sky-500/40';
              } else if (isHint) {
                tileBg = 'from-emerald-200/50 to-emerald-300/50';
                tileText = 'text-emerald-100';
                tileBorder = 'border-emerald-500/50 ring-2 ring-emerald-500/40 animate-pulse';
              } else if (displayHeight >= 1) {
                // White → cream gradient deepens as stack grows
                const tones = [
                  'from-[#FEFEFE] to-[#F2ECE4]',
                  'from-[#F8F3EB] to-[#EDE5D8]',
                  'from-[#F2EBE0] to-[#E5DAC8]',
                  'from-[#EBE1D3] to-[#DBCFB8]',
                  'from-[#E2D6C4] to-[#CFC0A4]',
                ];
                tileBg = tones[Math.min(displayHeight - 1, 4)];
                tileText = 'text-[#0D5C52]'; // deep teal letter
                tileBorder = 'border-[#D8CEBE]';
              }

              return (
                <button
                  key={cellKey}
                  data-cell-r={r}
                  data-cell-c={c}
                  onClick={() => onCellClick(r, c)}
                  onDragOver={(e) => {
                    if (displayHeight < MAX_STACK || isTemp) {
                      e.preventDefault();
                      setDragOverCell(cellKey);
                    }
                  }}
                  onDragLeave={() => setDragOverCell(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCell(null);
                    const letter = e.dataTransfer.getData('text/plain');
                    if (letter) onDropTile(r, c, letter);
                  }}
                  disabled={displayHeight >= MAX_STACK && !isTemp && !hintPlacement}
                  className={`relative aspect-square w-full rounded-[3px] md:rounded-md flex items-center justify-center transition-all duration-150 select-none cursor-pointer group outline-none ${
                    displayHeight === 0
                      ? isCenterCell
                        ? 'border border-emerald-400/60 bg-emerald-900/30 pulse-glow-green'
                        : 'border border-[#1F4D45]/70 bg-[#1F4D45]/35 hover:bg-[#2A5F55]/55'
                      : 'border border-transparent'
                  } ${isDragTarget ? 'bg-sky-500/20 border-sky-400/60' : ''} ${
                    isLastPlay ? 'ring-2 ring-amber-400/80 z-[2]' : ''
                  }`}
                >
                  {/* Coordinate label on empty cell */}
                  {displayHeight === 0 && (
                    <span className={`absolute text-[7px] md:text-[8px] font-bold pointer-events-none select-none ${
                      isCenterCell ? 'text-emerald-300/50' : 'text-teal-200/30'
                    }`}>
                      {String.fromCharCode(65 + c)}{r + 1}
                    </span>
                  )}

                  {/* Tile */}
                  {displayLetter && (
                    <div className={`w-[90%] h-[90%] rounded-[3px] md:rounded-[5px] bg-gradient-to-b flex flex-col items-center justify-center font-bold relative transition-all duration-150 border ${tileBg} ${tileText} ${tileBorder} ${tileDepthClass}`}>
                      <div className="absolute inset-0 rounded-[3px] md:rounded-[5px] border border-white/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <span className="font-serif-luxury text-[11px] sm:text-sm md:text-lg leading-none tracking-tight select-none">
                        {displayLetter}
                      </span>
                      {displayHeight > 1 && (
                        <span className={`absolute bottom-px right-[3px] text-[7px] md:text-[8px] leading-none opacity-60 ${isTemp ? 'text-sky-700' : 'text-current'}`}>
                          {displayHeight}
                        </span>
                      )}
                    </div>
                  )}

                  {displayHeight >= MAX_STACK && !isTemp && (
                    <div className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-teal-500/80 pointer-events-none" title="Max height" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_STACK = 5;
