import React, { useState, useRef } from 'react';
import { HelpCircle, Sparkles, Award, ArrowRight, Eye, GripHorizontal } from 'lucide-react';
import { CandidateMove } from '../lib/upwords-ai';
import { PlayPlacement } from '../lib/upwords-engine';

interface CoachPanelProps {
  onGetHint: () => void;
  onClearHint: () => void;
  onAcceptHint: () => void;
  activeHint: CandidateMove | null;
  coachAnalysis: {
    userPlay: { placements: PlayPlacement[]; score: number; word: string } | null;
    bestPlay: CandidateMove | null;
  } | null;
  onCloseAnalysis: () => void;
  onShowBestMovePreview: (move: CandidateMove | null) => void;
  hasPlacements: boolean;
  coachEnabled: boolean;
  onToggleCoach: (enabled: boolean) => void;
  isAiTurn: boolean;
  humanMovesReady: boolean;
  noHintAvailable: boolean;
}

export function CoachPanel({
  onGetHint, onClearHint, onAcceptHint, activeHint, coachAnalysis,
  onCloseAnalysis, onShowBestMovePreview, hasPlacements,
  coachEnabled, onToggleCoach, isAiTurn, humanMovesReady, noHintAvailable
}: CoachPanelProps) {
  const [showingPreview, setShowingPreview] = useState(false);

  // Lets the player drag the best-move preview panel out of the way if it's
  // sitting over the part of the board they actually need to see. Position
  // persists for the rest of the session once moved — no need to redo it
  // every turn.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const handleDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, baseX: dragOffset.x, baseY: dragOffset.y };

    const handleMove = (ev: PointerEvent) => {
      if (!dragStateRef.current) return;
      const dx = ev.clientX - dragStateRef.current.startX;
      const dy = ev.clientY - dragStateRef.current.startY;
      setDragOffset({ x: dragStateRef.current.baseX + dx, y: dragStateRef.current.baseY + dy });
    };
    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleTogglePreview = () => {
    if (showingPreview) { onShowBestMovePreview(null); setShowingPreview(false); }
    else if (coachAnalysis?.bestPlay) { onShowBestMovePreview(coachAnalysis.bestPlay); setShowingPreview(true); }
  };

  const handleClose = () => {
    onShowBestMovePreview(null); setShowingPreview(false); onCloseAnalysis();
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Hint controls (hidden while coach modal is showing) */}
      {!coachAnalysis && (
        <div className="w-full glass-card rounded-2xl border border-white/5 flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Coach Assist</h4>
                <p className="text-[10px] text-slate-500">Stuck? Get a suggested play.</p>
              </div>
            </div>
            {activeHint ? (
              <button onClick={onClearHint}
                className="px-3 py-1.5 border border-white/10 rounded-lg bg-slate-950/40 hover:bg-slate-950/80 text-xs font-semibold text-slate-300 hover:text-white transition-all active:scale-95">
                Clear
              </button>
            ) : (
              <button onClick={onGetHint} disabled={hasPlacements || isAiTurn || !humanMovesReady}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg active:scale-95 transition-all text-xs disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer">
                <Sparkles className="h-3.5 w-3.5 fill-current" />
                <span>{isAiTurn ? 'Opponent\'s Turn' : 'Hint'}</span>
              </button>
            )}
          </div>

          {!activeHint && noHintAvailable && !isAiTurn && (
            <div className="px-4 pb-3 -mt-1">
              <p className="text-[10px] text-amber-400/90 italic">
                No suggested play available for your current rack — try exchanging tiles or passing.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <div>
              <h5 className="text-[11px] font-bold text-slate-300">Post-Move Feedback</h5>
              <p className="text-[9px] text-slate-500">Show analysis popup after your plays</p>
            </div>
            <button
              onClick={() => onToggleCoach(!coachEnabled)}
              role="switch"
              aria-checked={coachEnabled}
              title={coachEnabled ? 'Disable coach feedback' : 'Enable coach feedback'}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${
                coachEnabled ? 'bg-teal-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                coachEnabled ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Active hint banner */}
      {activeHint && !coachAnalysis && (
        <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-1.5 animate-popup">
          <div className="flex justify-between items-center text-xs font-bold text-blue-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Suggested Play
            </span>
            <span className="font-mono text-blue-300">+{activeHint.score} pts</span>
          </div>
          <p className="text-[10px] text-slate-300">
            Try playing{' '}
            <span className="font-serif-luxury font-bold text-teal-300 text-xs">{activeHint.word}</span>
            {' '}starting at{' '}
            <span className="font-bold text-slate-200 font-mono">
              {String.fromCharCode(65 + activeHint.placements[0].c)}{activeHint.placements[0].r + 1}
            </span>.
          </p>
          <div className="flex gap-2 pt-1">
            <button onClick={onAcceptHint}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer">
              Accept
            </button>
            <button onClick={onClearHint}
              className="px-4 py-2 rounded-lg border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-xs font-semibold text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Post-turn coach analysis - full modal, OR compact floating panel while previewing the board */}
      {coachAnalysis && !showingPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 animate-popup relative overflow-hidden">
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600/10 border border-teal-500/20 text-teal-400 mb-3">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="font-serif-luxury text-2xl font-bold text-white">Coach Feedback</h3>
              <p className="text-[10px] text-slate-500 mt-1">Reviewing your word placement</p>
            </div>

            <div className="space-y-4 text-xs text-slate-300 mb-6">
              {coachAnalysis.bestPlay && coachAnalysis.userPlay &&
              coachAnalysis.userPlay.score >= coachAnalysis.bestPlay.score ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                  <p className="text-emerald-400 font-bold text-sm mb-1.5">Excellent play!</p>
                  <p>
                    You played{' '}
                    <span className="font-serif-luxury font-bold text-teal-300 text-sm">{coachAnalysis.userPlay.word}</span>
                    {' '}for{' '}
                    <span className="font-bold text-white font-mono">{coachAnalysis.userPlay.score} pts</span>
                    — the best available move!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950/50 border border-white/5 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">You Played</div>
                      <div className="font-serif-luxury text-sm font-bold text-blue-400 mt-0.5">
                        {coachAnalysis.userPlay?.word || '—'}
                      </div>
                    </div>
                    <div className="font-mono text-base font-bold text-blue-400">
                      {coachAnalysis.userPlay?.score || 0}{' '}
                      <span className="text-[9px] text-slate-500 font-sans uppercase">pts</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="h-5 w-5 text-slate-600 rotate-90" />
                  </div>

                  <div className="p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">Best Available</div>
                      <div className="font-serif-luxury text-sm font-bold text-teal-300 mt-0.5">
                        {coachAnalysis.bestPlay?.word || '—'}
                      </div>
                    </div>
                    <div className="font-mono text-base font-bold text-teal-400">
                      {coachAnalysis.bestPlay?.score || 0}{' '}
                      <span className="text-[9px] text-teal-500/60 font-sans uppercase">pts</span>
                    </div>
                  </div>

                  {coachAnalysis.bestPlay && coachAnalysis.userPlay && (
                    <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 text-center text-[11px]">
                      You missed{' '}
                      <span className="font-bold text-teal-400 font-mono">
                        +{coachAnalysis.bestPlay.score - coachAnalysis.userPlay.score} pts
                      </span>.{' '}
                      <span className="text-slate-400">Look for stacking opportunities to multiply your score.</span>
                    </div>
                  )}

                  {coachAnalysis.bestPlay && (
                    <button onClick={handleTogglePreview}
                      className="w-full py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 bg-slate-900/50 border-white/5 text-slate-300 hover:text-white hover:bg-slate-900">
                      <Eye className="h-4 w-4" />
                      <span>Show Best Move</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <button onClick={handleClose}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold rounded-xl active:scale-95 transition-all text-xs cursor-pointer">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact floating panel while previewing the best move — board stays fully visible */}
      {coachAnalysis && showingPreview && (
        <div
          className="fixed top-20 left-4 right-4 z-50 max-w-sm mx-auto animate-popup"
          style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
        >
          <div className="glass-card rounded-2xl border border-emerald-500/30 shadow-2xl p-4 flex flex-col gap-3">
            <div
              onPointerDown={handleDragStart}
              style={{ touchAction: 'none' }}
              className="flex items-center gap-2.5 w-full cursor-grab active:cursor-grabbing select-none"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Eye className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold truncate">Best Move Highlighted</div>
                <div className="text-xs text-slate-300 truncate">
                  <span className="font-serif-luxury font-bold text-teal-300">{coachAnalysis.bestPlay?.word}</span>
                  {' '}— {coachAnalysis.bestPlay?.score} pts
                </div>
              </div>
              <GripHorizontal className="h-4 w-4 text-slate-500 shrink-0" />
            </div>
            <button onClick={handleTogglePreview}
              className="w-full px-4 py-2 rounded-lg border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-xs font-semibold text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
