import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, ArrowDownToLine, RefreshCw, Send, AlertTriangle } from 'lucide-react';

interface RackProps {
  rack: string[];
  selectedTileIdx: number | null;
  onSelectTile: (letter: string, idx: number) => void;
  onDeselectTile: () => void;
  onShuffle: () => void;
  onRecall: () => void;
  onSubmit: () => { success: boolean; error?: string };
  onPass: () => void;
  onExchange: (tiles: string[]) => { success: boolean; error?: string } | void;
  onDropTile: (r: number, c: number, letter: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  bagCount: number;
  hasPlacements: boolean;
}

export function Rack({
  rack, selectedTileIdx, onSelectTile, onDeselectTile,
  onShuffle, onRecall, onSubmit, onPass, onExchange, onDropTile, onReorder, bagCount, hasPlacements
}: RackProps) {
  const [exchangeMode, setExchangeMode] = useState(false);
  // Exchange selections stored as Set of rack indices
  const [exchangeIdxs, setExchangeIdxs] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Touch-based drag (native HTML5 drag-and-drop never fires on touchscreens) ──
  // Implemented with native (not React synthetic) listeners so preventDefault()
  // actually works — React/the browser may attach touchstart/touchmove as passive
  // by default, which silently ignores preventDefault() and lets the page scroll
  // instead of dragging, and also lets a "ghost" click fire right after the drop.
  const tilesContainerRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef(rack);
  const exchangeModeRef = useRef(exchangeMode);
  const [touchGhost, setTouchGhost] = useState<{ letter: string; x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 10; // px of finger movement before a tap becomes a drag

  useEffect(() => { rackRef.current = rack; }, [rack]);
  useEffect(() => { exchangeModeRef.current = exchangeMode; }, [exchangeMode]);

  useEffect(() => {
    const container = tilesContainerRef.current;
    if (!container) return;

    let state: { x: number; y: number; idx: number; letter: string; dragging: boolean } | null = null;
    let hoverCell: HTMLElement | null = null;
    let hoverTile: HTMLElement | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (exchangeModeRef.current) return;
      const targetEl = (e.target as HTMLElement).closest('[data-tile-idx]') as HTMLElement | null;
      if (!targetEl) return;
      const idx = parseInt(targetEl.getAttribute('data-tile-idx') || '', 10);
      if (isNaN(idx)) return;
      const t = e.touches[0];
      state = { x: t.clientX, y: t.clientY, idx, letter: rackRef.current[idx], dragging: false };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!state) return;
      const t = e.touches[0];
      const dx = t.clientX - state.x;
      const dy = t.clientY - state.y;
      if (!state.dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        state.dragging = true;
      }
      if (state.dragging) {
        if (e.cancelable) e.preventDefault(); // stop page scroll now that we're dragging
        setTouchGhost({ letter: state.letter, x: t.clientX, y: t.clientY });
        const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
        const cellEl = el?.closest('[data-cell-r]') as HTMLElement | null;
        const rawTileEl = !cellEl ? (el?.closest('[data-tile-idx]') as HTMLElement | null) : null;
        // Don't let the tile being dragged highlight itself as a target
        const tileEl = rawTileEl && rawTileEl.getAttribute('data-tile-idx') !== String(state.idx) ? rawTileEl : null;

        if (cellEl !== hoverCell) {
          hoverCell?.classList.remove('drag-over');
          cellEl?.classList.add('drag-over');
          hoverCell = cellEl;
        }
        if (tileEl !== hoverTile) {
          hoverTile?.classList.remove('rack-reorder-target');
          tileEl?.classList.add('rack-reorder-target');
          hoverTile = tileEl;
        }
      }
    };

    const endDrag = (e: TouchEvent, commit: boolean) => {
      if (state?.dragging) {
        if (e.cancelable) e.preventDefault(); // suppress the synthetic click that would otherwise re-fire select
        if (commit) {
          const touch = e.changedTouches[0];
          const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
          const cellEl = el?.closest('[data-cell-r]') as HTMLElement | null;
          if (cellEl) {
            const r = parseInt(cellEl.getAttribute('data-cell-r') || '', 10);
            const c = parseInt(cellEl.getAttribute('data-cell-c') || '', 10);
            if (!isNaN(r) && !isNaN(c)) onDropTile(r, c, state.letter);
          } else {
            const tileEl = el?.closest('[data-tile-idx]') as HTMLElement | null;
            if (tileEl) {
              const targetIdx = parseInt(tileEl.getAttribute('data-tile-idx') || '', 10);
              if (!isNaN(targetIdx) && targetIdx !== state.idx) onReorder(state.idx, targetIdx);
            }
          }
        }
      }
      hoverCell?.classList.remove('drag-over');
      hoverTile?.classList.remove('rack-reorder-target');
      hoverCell = null;
      hoverTile = null;
      state = null;
      setTouchGhost(null);
    };

    const onTouchEnd = (e: TouchEvent) => endDrag(e, true);
    const onTouchCancel = (e: TouchEvent) => endDrag(e, false);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onDropTile, onReorder]);

  const handleTileClick = (letter: string, idx: number) => {
    setErrorMsg(null);
    if (exchangeMode) {
      setExchangeIdxs(prev => {
        const n = new Set(prev);
        n.has(idx) ? n.delete(idx) : n.add(idx);
        return n;
      });
    } else {
      if (selectedTileIdx === idx) onDeselectTile();
      else onSelectTile(letter, idx);
    }
  };

  const handleToggleExchange = () => {
    setErrorMsg(null);
    if (hasPlacements) { setErrorMsg('Recall your tiles before exchanging.'); return; }
    setExchangeMode(e => !e);
    setExchangeIdxs(new Set());
    onDeselectTile();
  };

  const handleExecuteExchange = () => {
    setErrorMsg(null);
    const tiles = [...exchangeIdxs].map(i => rack[i]);
    const res = onExchange(tiles);
    if (res && !res.success) { setErrorMsg(res.error || 'Exchange failed.'); return; }
    setExchangeMode(false);
    setExchangeIdxs(new Set());
  };

  const handleSubmit = () => {
    setErrorMsg(null);
    const res = onSubmit();
    if (!res.success) setErrorMsg(res.error || 'Invalid play.');
  };

  const handlePass = () => {
    if (window.confirm('Pass your turn? You will score 0 points.')) onPass();
  };

  return (
    <div className="w-full max-w-[600px] flex flex-col items-center gap-3 glass-card p-4 rounded-2xl border border-white/5">
      {errorMsg && (
        <div className="w-full flex items-center gap-2 p-3 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs rounded-xl font-medium animate-popup">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="w-full flex justify-between items-center px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {exchangeMode ? <span className="text-orange-400">Select tiles to exchange</span> : 'Your Rack'}
        </span>
        {exchangeMode && (
          <span className="text-[10px] text-orange-400 font-mono">{exchangeIdxs.size} selected</span>
        )}
      </div>

      {/* Tiles */}
      <div ref={tilesContainerRef} className="flex gap-2 p-3 bg-slate-950/80 w-full justify-center rounded-xl border border-white/5 min-h-[72px]">
        {rack.map((letter, idx) => {
          const isSelected = !exchangeMode && selectedTileIdx === idx;
          const isForExchange = exchangeMode && exchangeIdxs.has(idx);

          let cls = 'bg-gradient-to-b from-[#FEFEFE] to-[#F0EAE0] border-[#D8CEBE] text-[#0D5C52] shadow-md';
          if (isSelected) {
            cls = 'bg-gradient-to-b from-[#FFF8F0] to-[#F5E8D0] border-teal-400 text-[#0D5C52] -translate-y-2.5 ring-4 ring-teal-500/25 scale-110 shadow-lg shadow-teal-500/20';
          } else if (isForExchange) {
            cls = 'bg-gradient-to-b from-orange-400/40 to-orange-500/40 border-orange-500 text-orange-200 scale-95 ring-2 ring-orange-500/40';
          }

          return (
            <button
              key={idx}
              data-tile-idx={idx}
              onClick={() => handleTileClick(letter, idx)}
              draggable={!exchangeMode}
              onDragStart={(e) => {
                // Store letter as plain text for the board drop handler, plus the
                // source index as a custom type for rack-internal reordering —
                // touch drag is handled separately above via native listeners.
                e.dataTransfer.setData('text/plain', letter);
                e.dataTransfer.setData('application/x-rack-idx', String(idx));
                e.dataTransfer.effectAllowed = 'move';
                onSelectTile(letter, idx);
              }}
              onDragEnd={(e) => {
                e.currentTarget.classList.remove('rack-reorder-target');
                onDeselectTile();
              }}
              onDragOver={(e) => {
                if (!exchangeMode) {
                  e.preventDefault();
                  e.currentTarget.classList.add('rack-reorder-target');
                }
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('rack-reorder-target')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('rack-reorder-target');
                const sourceIdxStr = e.dataTransfer.getData('application/x-rack-idx');
                if (sourceIdxStr !== '') {
                  const sourceIdx = parseInt(sourceIdxStr, 10);
                  if (!isNaN(sourceIdx) && sourceIdx !== idx) onReorder(sourceIdx, idx);
                }
              }}
              style={{ touchAction: exchangeMode ? 'auto' : 'none' }}
              className={`h-12 w-12 sm:h-11 sm:w-11 rounded-lg border-2 font-bold font-serif-luxury text-xl sm:text-lg transition-all duration-200 active:scale-95 cursor-pointer flex items-center justify-center select-none ${cls}`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="w-full flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          {!exchangeMode && (
            <>
              <button onClick={onShuffle}
                className="p-2.5 rounded-xl border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-white transition-all active:scale-95"
                title="Shuffle rack">
                <Shuffle className="h-4 w-4" />
              </button>
              <button onClick={onRecall} disabled={!hasPlacements}
                className="p-2.5 rounded-xl border border-white/10 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                title="Recall tiles">
                <ArrowDownToLine className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex gap-2 flex-1 justify-end">
          {exchangeMode ? (
            <>
              <button onClick={handleToggleExchange}
                className="px-4 py-2 border border-white/10 rounded-xl bg-slate-950/40 text-xs font-semibold text-slate-400 hover:text-white transition-all active:scale-95">
                Cancel
              </button>
              <button onClick={handleExecuteExchange} disabled={exchangeIdxs.size === 0}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl active:scale-95 transition-all text-xs disabled:opacity-40 disabled:pointer-events-none">
                Swap ({exchangeIdxs.size})
              </button>
            </>
          ) : (
            <>
              <button onClick={handleToggleExchange} disabled={bagCount === 0}
                className="px-3 py-2 border border-white/10 rounded-xl bg-slate-950/40 text-xs font-semibold text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Exchange</span>
              </button>
              <button onClick={handlePass}
                className="px-3 py-2 border border-white/10 rounded-xl bg-slate-950/40 text-slate-400 hover:text-white text-xs font-semibold transition-all active:scale-95">
                Pass
              </button>
              <button onClick={handleSubmit} disabled={!hasPlacements}
                className="px-5 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold rounded-xl active:scale-95 transition-all text-xs disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 shadow-lg shadow-teal-600/15">
                <Send className="h-3.5 w-3.5" />
                <span>Submit</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Floating tile that follows the finger during a touch drag */}
      {touchGhost && (
        <div
          style={{ position: 'fixed', left: touchGhost.x - 26, top: touchGhost.y - 60, zIndex: 9999, pointerEvents: 'none' }}
          className="h-12 w-12 rounded-lg border-2 border-sky-400 bg-gradient-to-b from-sky-100 to-sky-200 text-sky-900 font-bold font-serif-luxury text-xl flex items-center justify-center shadow-2xl scale-110"
        >
          {touchGhost.letter}
        </div>
      )}
    </div>
  );
}
