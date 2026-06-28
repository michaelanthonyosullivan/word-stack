import React, { useState } from 'react';
import { RefreshCw, BookOpen } from 'lucide-react';

interface HeaderProps {
  onRestart: () => void;
  gameStarted: boolean;
  winnerId: number | null;
  players: any[];
  roomCode?: string | null;
}

export function Header({ onRestart, gameStarted, roomCode }: HeaderProps) {
  const [showRules, setShowRules] = useState(false);

  return (
    <header className="shrink-0 border-b border-white/5 bg-[#11161f]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-600/25 ring-1 ring-teal-400/30">
          <span className="font-serif-luxury text-xl font-bold text-white select-none">W</span>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-teal-500/80 font-semibold leading-none">Word Stacking Game</div>
          <h1 className="font-serif-luxury text-xl md:text-2xl font-bold leading-tight bg-gradient-to-r from-teal-300 via-teal-400 to-teal-300 bg-clip-text text-transparent">
            Word Stack
          </h1>
        </div>
        {roomCode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-600/10 border border-teal-500/20 ml-2">
            <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Room</span>
            <span className="text-xs font-mono font-bold text-teal-300 tracking-[0.15em]">{roomCode}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setShowRules(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all font-medium whitespace-nowrap shrink-0">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Rules</span>
        </button>
        {gameStarted && (
          <button onClick={onRestart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-lg shadow-teal-600/15 active:scale-95 transition-all whitespace-nowrap shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>New Game</span>
          </button>
        )}
      </div>

      {showRules && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-2xl w-full modal-max-height overflow-y-auto rounded-2xl p-6 md:p-8 animate-popup shadow-2xl border border-white/10">
            <div className="flex justify-between items-start mb-6">
              <h2 className="font-serif-luxury text-2xl md:text-3xl text-teal-400 font-bold">How to Play</h2>
              <button onClick={() => setShowRules(false)} className="text-slate-400 hover:text-white text-sm font-semibold p-1">✕</button>
            </div>
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div className="p-3 bg-teal-600/10 border border-teal-500/20 rounded-xl">
                <p className="text-teal-300 font-semibold mb-1">Stack letters to change words!</p>
                You can place tiles on top of existing ones to change words. Score more by building taller stacks.
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Placing Tiles</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Words must be at least 2 letters long.</li>
                  <li>All tiles in a turn must form one straight line (horizontal or vertical).</li>
                  <li>First move must cover the centre square.</li>
                  <li>Subsequent moves must connect with existing tiles.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Stacking Tiles</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Stack tiles on top of others to change words.</li>
                  <li>Maximum stack height: <strong>5 tiles</strong>.</li>
                  <li>You cannot stack an identical letter on top of itself.</li>
                  <li>You cannot completely cover an existing word.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Scoring</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Flat word</strong> (all tiles at height 1): 2 pts per tile.</li>
                  <li><strong>Stacked word</strong>: 1 pt × stack height per tile.</li>
                  <li><strong>Full-rack bonus</strong>: +20 pts for using all 6 rack tiles.</li>
                  <li>At game end: −1 pt per remaining tile in hand.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Improving the Dictionary</h3>
                <p className="mb-1.5">
                  The built-in dictionary sticks to everyday words, so it will sometimes reject a real word it
                  hasn't heard of — or let an opponent get away with something too obscure. You can fix both,
                  and the fix is remembered on this device for future games.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Word rejected that should be valid?</strong> Place your tiles as normal. If it's
                    turned down, a <span className="text-teal-300 font-semibold">Challenge</span> button appears
                    next to the error — tap it to add the word permanently, then submit your play.
                  </li>
                  <li>
                    <strong>An opponent plays something too obscure?</strong> Find the word in the Game History
                    list and tap the small shield icon beside it to remove that word from the dictionary. Their
                    score for that turn still stands — it only stops the word being played again.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Rewinding the Game</h3>
                <p>
                  Every entry in Game History has a small clock icon. Tap it to rewind the whole game — board,
                  scores, racks, tile bag — back to exactly how things stood right before that move happened.
                  This works for any turn, yours or an opponent's, and even after the game has technically
                  ended, so you can go back and try something differently. Anything that happened after the
                  point you rewind to is discarded, so you'll be asked to confirm first.
                </p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Editing Player Names</h3>
                <p>
                  Tap the small pencil icon next to any name in the Scores panel — yours or an opponent's,
                  human or AI — to rename them at any point during the game.
                </p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Coach Assistance</h3>
                <p>
                  Before starting a game, the setup screen has a <strong>Coach Analysis</strong> toggle that
                  controls whether you get feedback after each of your plays. You're not locked into that
                  choice — during the game, the same switch appears under <strong>Post-Move Feedback</strong>
                  in the Coach Assist panel, so you can turn it on or off whenever suits you, mid-game included.
                  The on-demand <strong>Hint</strong> button works independently of this setting either way.
                </p>
              </div>
              <div className="flex justify-end pt-4 border-t border-white/10">
                <button onClick={() => setShowRules(false)}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl active:scale-95 transition-all text-xs">
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
