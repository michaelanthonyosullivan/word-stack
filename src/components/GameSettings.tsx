import React, { useState } from 'react';
import { Play, Sparkles, User, Settings, Cpu, MessageSquare, CheckSquare, Square } from 'lucide-react';

interface GameSettingsProps {
  onStart: (name: string, difficulty: 'easy' | 'medium' | 'hard', numAi: number, showCoach: boolean) => void;
  isLoading: boolean;
  dictProgress: number;
}

export function GameSettings({ onStart, isLoading, dictProgress }: GameSettingsProps) {
  const [name, setName] = useState('Player');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numAi, setNumAi] = useState<1 | 2 | 3>(3);
  const [showCoach, setShowCoach] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onStart(name, difficulty, numAi, showCoach);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
      <div className="max-w-md w-full glass-card rounded-3xl border border-white/8 shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-teal-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-teal-900/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-xl shadow-teal-600/25 mb-4 ring-1 ring-teal-400/30">
            <span className="font-serif-luxury text-3xl font-bold text-white select-none">W</span>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Stack letters, build words, and outplay your opponents.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative">
          {/* Player name */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-teal-500" />
              <span>Your Name</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 15))}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/60 transition-all text-sm font-medium"
              placeholder="Your Name"
              required
            />
          </div>

          {/* AI difficulty */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-teal-500" />
              <span>AI Difficulty</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <button key={level} type="button" onClick={() => setDifficulty(level)}
                  className={`py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    difficulty === level
                      ? 'bg-teal-600/20 border-teal-500 text-teal-400 shadow-sm'
                      : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}>
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 italic text-center">
              {difficulty === 'easy' && 'Easy: simple low-scoring words.'}
              {difficulty === 'medium' && 'Medium: balanced strategy and scoring.'}
              {difficulty === 'hard' && 'Hard: aggressive stacking and high scores.'}
            </p>
          </div>

          {/* Number of AI opponents */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-teal-500" />
              <span>No of AI Opponents</span>
            </label>
            <div className="space-y-2">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} type="button" onClick={() => setNumAi(n)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    numAi === n
                      ? 'bg-teal-600/20 border-teal-500 text-teal-400 shadow-sm'
                      : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}>
                  <span>{n}</span>
                  {numAi === n
                    ? <CheckSquare className="h-4 w-4 shrink-0" />
                    : <Square className="h-4 w-4 shrink-0 opacity-50" />}
                </button>
              ))}
            </div>
          </div>

          {/* Coach analysis toggle */}
          <div>
            <button type="button" onClick={() => setShowCoach(v => !v)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/8 bg-slate-900/40 hover:bg-slate-900/70 transition-all group">
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${showCoach ? 'bg-teal-600/20 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-200">Coach Analysis</div>
                  <div className="text-[10px] text-slate-500">Post-move feedback after each play</div>
                </div>
              </div>
              {showCoach
                ? <CheckSquare className="h-5 w-5 text-teal-400 shrink-0" />
                : <Square className="h-5 w-5 text-slate-600 shrink-0" />}
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-teal-500" />
                  Loading dictionary…
                </span>
                <span className="font-mono font-bold text-teal-400">{dictProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 border border-white/5 overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-teal-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${dictProgress}%` }} />
              </div>
            </div>
          ) : (
            <button type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm mt-4 cursor-pointer">
              <Play className="h-4 w-4 fill-current" />
              <span>Start Game</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
