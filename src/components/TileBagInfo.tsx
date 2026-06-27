import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TileBagInfoProps { bag: string[]; }

export function TileBagInfo({ bag }: TileBagInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const counts: { [letter: string]: number } = {};
  for (const letter of bag) counts[letter] = (counts[letter] || 0) + 1;
  const sorted = Object.keys(counts).sort();

  return (
    <div className="w-full glass-card p-4 rounded-2xl border border-white/5 flex flex-col gap-2.5">
      <button onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between text-left cursor-pointer outline-none group">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-red-600/15 border border-red-500/20 flex items-center justify-center">
            <span className="font-mono text-xs font-bold text-red-400">{bag.length}</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Tile Bag</h4>
            <p className="text-[9px] text-slate-500">Click to view remaining tiles</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {isOpen && (
        <div className="pt-2 border-t border-white/5 animate-popup">
          {bag.length === 0 ? (
            <p className="text-[10px] text-slate-500 italic text-center py-2">Bag is empty.</p>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 max-h-[130px] overflow-y-auto pr-1">
              {sorted.map(letter => (
                <div key={letter} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-950/60 border border-white/5">
                  <span className="font-serif-luxury text-[10px] font-bold text-red-400">{letter}</span>
                  <span className="font-mono text-[9px] text-slate-400 mt-0.5">{counts[letter]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
