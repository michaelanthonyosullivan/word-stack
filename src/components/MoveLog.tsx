import React, { useEffect, useRef } from 'react';
import { ScrollText, Play, RefreshCw, XCircle, ShieldX, History } from 'lucide-react';
import { PlayHistoryItem } from '../lib/upwords-engine';
import { isWordRemoved } from '../lib/dictionary';

interface MoveLogProps {
  history: PlayHistoryItem[];
  players: any[];
  onRemoveWord: (word: string) => boolean;
  onRewind: (turnIndex: number) => void;
  canRewindTo: (turnIndex: number) => boolean;
}

export function MoveLog({ history, players, onRemoveWord, onRewind, canRewindTo }: MoveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [history]);

  const orderedHistory = [...history].reverse();

  return (
    <div className="w-full glass-card p-5 rounded-2xl border border-white/5 flex flex-col gap-3 flex-1 min-h-[200px]">
      <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold border-b border-white/5 pb-2 flex items-center gap-1.5 shrink-0">
        <ScrollText className="h-4 w-4 text-red-500" />
        <span>Game History</span>
      </h3>
      <div ref={containerRef} className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scroll-smooth">
        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 italic text-xs py-8">
            No moves yet
          </div>
        ) : (
          orderedHistory.map((item) => {
            const player = players.find(p => p.id === item.playerId);
            const isHuman = player ? !player.isAi : false;
            const wordsFormed = (item.allWords && item.allWords.length > 0) ? item.allWords : [item.word];

            let icon = <Play className="h-3.5 w-3.5 text-red-500" />;
            let text = '';

            if (item.type === 'exchange') {
              icon = <RefreshCw className="h-3.5 w-3.5 text-orange-400" />;
              text = 'swapped tiles';
            } else if (item.type === 'pass') {
              icon = <XCircle className="h-3.5 w-3.5 text-slate-500" />;
              text = 'passed';
            } else {
              text = 'played';
            }

            return (
              <div key={item.turnIndex}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-white/5 text-xs animate-popup gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <div className="shrink-0">{icon}</div>
                  <div className="text-slate-300">
                    <span className={`font-bold ${isHuman ? 'text-blue-400' : 'text-slate-400'}`}>
                      {item.playerName}
                    </span>{' '}
                    <span>{text}</span>
                  </div>
                  {item.type === 'play' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {wordsFormed.map((word, wIdx) => {
                        const removed = isWordRemoved(word);
                        return (
                          <span key={wIdx} className="inline-flex items-center gap-1">
                            {wIdx > 0 && <span className="text-slate-600 font-bold text-[10px]">+</span>}
                            <span className={`font-serif-luxury font-bold text-sm tracking-tight select-none ${
                              removed ? 'text-slate-500 line-through' : 'text-red-300'
                            }`}>
                              {word}
                            </span>
                            {!isHuman && (
                              removed ? (
                                <span className="text-[8px] text-slate-500 italic">removed</span>
                              ) : (
                                <button
                                  onClick={() => onRemoveWord(word)}
                                  title={`Flag '${word}' as too obscure and remove it from the dictionary`}
                                  className="text-slate-600 hover:text-red-400 transition-colors active:scale-90 cursor-pointer"
                                >
                                  <ShieldX className="h-3 w-3" />
                                </button>
                              )
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.type === 'play' && (
                    <div className="font-mono font-bold text-slate-100">
                      +{item.score} <span className="text-[9px] text-slate-500 font-sans uppercase">pts</span>
                    </div>
                  )}
                  {canRewindTo(item.turnIndex) && (
                    <button
                      onClick={() => onRewind(item.turnIndex)}
                      title="Rewind to before this move"
                      className="text-slate-600 hover:text-amber-400 transition-colors active:scale-90 cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
