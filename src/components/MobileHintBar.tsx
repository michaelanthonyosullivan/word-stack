import React from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { CandidateMove } from '../lib/upwords-ai';

interface MobileHintBarProps {
  onGetHint: () => void;
  onClearHint: () => void;
  onAcceptHint: () => void;
  activeHint: CandidateMove | null;
  hasPlacements: boolean;
  isAiTurn: boolean;
  humanMovesReady: boolean;
  noHintAvailable: boolean;
}

export function MobileHintBar({
  onGetHint, onClearHint, onAcceptHint,
  activeHint, hasPlacements, isAiTurn, humanMovesReady, noHintAvailable
}: MobileHintBarProps) {
  return (
	// Only visible below the lg breakpoint — desktop uses the full CoachPanel in the sidebar
	<div className="lg:hidden w-full max-w-[600px] flex items-center gap-2 px-1">
	  {activeHint ? (
		// ── Active hint state ──────────────────────────────────────────────
		<div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-popup">
		  <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
		  <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">
			Play{' '}
			<span className="font-serif-luxury font-bold text-teal-300">{activeHint.word}</span>
			{' '}at{' '}
			<span className="font-mono font-bold text-slate-200">
			  {String.fromCharCode(65 + activeHint.placements[0].c)}{activeHint.placements[0].r + 1}
			</span>
			{' '}
			<span className="text-blue-300 font-mono font-bold">+{activeHint.score} pts</span>
		  </span>
		  <button
			onClick={onAcceptHint}
			className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 shrink-0 cursor-pointer"
		  >
			<Check className="h-3.5 w-3.5" />
			<span>Accept</span>
		  </button>
		  <button
			onClick={onClearHint}
			className="p-1.5 rounded-lg border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-white transition-all active:scale-95 shrink-0 cursor-pointer"
			title="Clear hint"
		  >
			<X className="h-3.5 w-3.5" />
		  </button>
		</div>
	  ) : noHintAvailable ? (
		// ── No hint available ──────────────────────────────────────────────
		<div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-popup">
		  <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
		  <span className="text-xs text-amber-400/90 italic flex-1">
			No hint available — try exchanging tiles or passing.
		  </span>
		</div>
	  ) : (
		// ── Idle state ─────────────────────────────────────────────────────
		<button
		  onClick={onGetHint}
		  disabled={hasPlacements || isAiTurn || !humanMovesReady}
		  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-blue-600/20 cursor-pointer"
		>
		  <Sparkles className="h-3.5 w-3.5 fill-current" />
		  <span>{isAiTurn ? "Opponent's Turn" : 'Hint'}</span>
		</button>
	  )}
	</div>
  );
}
