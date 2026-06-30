import React from 'react';
import { Sparkles, Check, X, User } from 'lucide-react';
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
	<div className="lg:hidden w-full max-w-[600px] flex items-center gap-2 px-1">

	  {/* Left: turn indicator */}
	  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-600/10 border border-teal-500/20 shrink-0">
		<User className="h-3 w-3 text-teal-400" />
		<span className="text-[10px] font-bold text-teal-400 whitespace-nowrap">
		  {isAiTurn ? "Opponent's Turn" : 'Your Turn'}
		</span>
	  </div>

	  {/* Right: hint area */}
	  <div className="flex-1 flex justify-end">
		{activeHint ? (
		  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-popup max-w-[70%]">
			<Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
			<span className="text-[10px] text-slate-300 flex-1 min-w-0 truncate">
			  <span className="font-serif-luxury font-bold text-teal-300">{activeHint.word}</span>
			  {' '}at{' '}
			  <span className="font-mono font-bold text-slate-200">
				{String.fromCharCode(65 + activeHint.placements[0].c)}{activeHint.placements[0].r + 1}
			  </span>
			  {' '}
			  <span className="text-blue-300 font-mono font-bold">+{activeHint.score}</span>
			</span>
			<button
			  onClick={onAcceptHint}
			  className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all active:scale-95 shrink-0 cursor-pointer"
			>
			  <Check className="h-3 w-3" />
			</button>
			<button
			  onClick={onClearHint}
			  className="p-0.5 rounded-lg border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-white transition-all active:scale-95 shrink-0 cursor-pointer"
			  title="Clear hint"
			>
			  <X className="h-3 w-3" />
			</button>
		  </div>
		) : noHintAvailable ? (
		  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-popup">
			<Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
			<span className="text-[10px] text-amber-400/90 italic whitespace-nowrap">
			  No hint available
			</span>
		  </div>
		) : (
		  <button
			onClick={onGetHint}
			disabled={hasPlacements || isAiTurn || !humanMovesReady}
			className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-blue-600/20 cursor-pointer"
		  >
			<Sparkles className="h-3 w-3 fill-current" />
			<span>Hint</span>
		  </button>
		)}
	  </div>
	</div>
  );
}
