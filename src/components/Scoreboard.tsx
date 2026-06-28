import React, { useState } from 'react';
import { User, Cpu, Crown, Sparkles, Pencil, Check } from 'lucide-react';
import { Player } from '../lib/upwords-engine';

interface ScoreboardProps {
  players: Player[];
  currentTurn: number;
  isAiThinking: boolean;
  winnerId: number | null;
  gameEnded: boolean;
  onRenamePlayer: (playerId: number, newName: string) => void;
  canRename: (playerId: number) => boolean;
}

export function Scoreboard({ players, currentTurn, isAiThinking, winnerId, gameEnded, onRenamePlayer, canRename }: ScoreboardProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditValue(player.name);
  };

  const commitEdit = () => {
    if (editingId !== null) onRenamePlayer(editingId, editValue);
    setEditingId(null);
  };

  return (
    <div className="w-full glass-card p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
      <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold border-b border-white/5 pb-2">
        Scores
      </h3>
      <div className="flex flex-col gap-2.5">
        {players.map((player, idx) => {
          const isTurn = currentTurn === idx && !gameEnded;
          const isWinner = winnerId === player.id && gameEnded;
          const isEditing = editingId === player.id;

          let cardClass = 'bg-slate-950/40 border-white/5';
          if (player.hasLeft) cardClass = 'bg-slate-950/20 border-white/5 opacity-50';
          else if (isTurn) cardClass = 'bg-teal-600/10 border-teal-500/30 ring-1 ring-teal-500/10 shadow-lg shadow-teal-600/5';
          else if (isWinner) cardClass = 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/15';

          return (
            <div key={player.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${cardClass}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isTurn ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : player.isAi ? 'bg-slate-800 text-slate-300'
                  : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {player.isAi ? <Cpu className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value.slice(0, 15))}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="text-xs font-bold bg-slate-950 border border-teal-500/40 rounded px-1.5 py-0.5 text-slate-100 w-24 outline-none focus:ring-1 focus:ring-teal-500/50"
                      />
                    ) : (
                      <span className={`text-xs font-bold truncate ${isTurn ? 'text-teal-400' : 'text-slate-100'}`}>
                        {player.name}
                      </span>
                    )}
                    {player.isAi && !isEditing && (
                      <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5 shrink-0">
                        {player.aiLevel}
                      </span>
                    )}
                    {player.hasLeft && !isEditing && (
                      <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-white/5 shrink-0">
                        left
                      </span>
                    )}
                    {!isEditing && canRename(player.id) && (
                      <button
                        onClick={() => startEditing(player)}
                        title="Rename player"
                        className="text-slate-600 hover:text-teal-400 transition-colors shrink-0 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {isEditing && (
                      <button onClick={commitEdit} className="text-emerald-400 hover:text-emerald-300 shrink-0 cursor-pointer">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isWinner && <Crown className="h-3.5 w-3.5 text-yellow-400 fill-current animate-bounce shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{player.rack.length} tiles</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-base font-bold text-slate-100">
                  {player.score} <span className="text-[10px] text-slate-500 font-sans uppercase">pts</span>
                </div>
                {isTurn && isAiThinking && (
                  <div className="flex items-center justify-end gap-1 text-[8px] text-teal-400 font-bold uppercase tracking-wider mt-0.5">
                    <Sparkles className="h-2.5 w-2.5 animate-spin" />
                    <span>Thinking…</span>
                  </div>
                )}
                {isTurn && !isAiThinking && (
                  <div className="text-[8px] text-teal-400/70 font-bold uppercase tracking-wider mt-0.5">Your turn</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
