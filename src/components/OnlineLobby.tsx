import React, { useState, useEffect, useRef } from 'react';
import { Users, Copy, Check, Cpu, User, X, Play, Loader2, ArrowLeft, Wifi } from 'lucide-react';
import {
  RoomData, RoomSeat, getClientId, createRoom, joinRoom, subscribeToRoom,
  updateSeat, leaveSeat, setRoomStatus
} from '../lib/multiplayer';

interface OnlineLobbyProps {
  onGameStart: (roomCode: string, mySeatIndex: number) => void;
  onBack: () => void;
}

type Stage = 'choose' | 'create-name' | 'join-name' | 'join-code' | 'in-lobby';

export function OnlineLobby({ onGameStart, onBack }: OnlineLobbyProps) {
  const [stage, setStage] = useState<Stage>('choose');
  const [name, setName] = useState('Player');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingFlow, setPendingFlow] = useState<'create' | 'join' | null>(null);

  const clientId = getClientId();
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const startWatching = (code: string) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribeToRoom(code, (data) => {
      setRoom(data);
      if (data) {
        const idx = data.seats.findIndex(s => s.clientId === clientId);
        setMySeatIndex(idx === -1 ? null : idx);
        if (data.status === 'playing' && idx !== -1) {
          onGameStart(code, idx);
        }
      }
    });
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom(name);
      setRoomCode(code);
      startWatching(code);
      setStage('in-lobby');
    } catch (e: any) {
      setError(e?.message || 'Could not create a room. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length < 4) { setError('Enter the full room code.'); return; }
    setBusy(true);
    setError(null);
    try {
      const idx = await joinRoom(code, name);
      if (idx === null) {
        setError('Room not found, or it\'s already full.');
        setBusy(false);
        return;
      }
      setRoomCode(code);
      setMySeatIndex(idx);
      startWatching(code);
      setStage('in-lobby');
    } catch (e: any) {
      setError(e?.message || 'Could not join that room. Check the code and your connection.');
    } finally {
      setBusy(false);
    }
  };

  const isHost = room && mySeatIndex !== null && room.seats[mySeatIndex]?.clientId === room.hostId;
  const occupiedCount = room ? room.seats.filter(s => s.type !== 'open').length : 0;

  const handleSetSeatAi = (seatIndex: number, level: 'easy' | 'medium' | 'hard') => {
    if (!roomCode) return;
    updateSeat(roomCode, seatIndex, { type: 'ai', clientId: null, name: aiNameFor(seatIndex), aiLevel: level });
  };

  const handleOpenSeat = (seatIndex: number) => {
    if (!roomCode) return;
    leaveSeat(roomCode, seatIndex);
  };

  const handleStartGame = () => {
    if (!roomCode) return;
    setRoomStatus(roomCode, 'playing');
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
      <div className="max-w-md w-full glass-card rounded-3xl border border-white/8 shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-red-600/8 rounded-full blur-3xl pointer-events-none" />

        {stage !== 'in-lobby' && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-5 transition-colors cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {stage === 'choose' && (
          <div className="space-y-4 relative">
            <div className="text-center mb-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-xl shadow-red-600/25 mb-3 ring-1 ring-red-400/30">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h2 className="font-serif-luxury text-2xl font-extrabold text-white">Play Online</h2>
              <p className="text-xs text-slate-400 mt-1">Create a room and share the code, or join a friend's game.</p>
            </div>
            <button onClick={() => { setPendingFlow('create'); setStage('create-name'); }}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm cursor-pointer">
              Create a Room
            </button>
            <button onClick={() => { setPendingFlow('join'); setStage('join-name'); }}
              className="w-full bg-slate-900/60 hover:bg-slate-900 border border-white/10 text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all text-sm cursor-pointer">
              Join a Room
            </button>
          </div>
        )}

        {(stage === 'create-name' || stage === 'join-name') && (
          <div className="space-y-5 relative">
            <h2 className="font-serif-luxury text-xl font-bold text-white text-center mb-2">Your Name</h2>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 15))}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition-all text-sm font-medium"
              placeholder="Your Name"
            />
            <button
              onClick={() => { if (pendingFlow === 'create') handleCreate(); else setStage('join-code'); }}
              disabled={busy || !name.trim()}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Continue</span>
            </button>
          </div>
        )}

        {stage === 'join-code' && (
          <div className="space-y-5 relative">
            <h2 className="font-serif-luxury text-xl font-bold text-white text-center mb-2">Enter Room Code</h2>
            <input
              type="text"
              autoFocus
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 5))}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition-all text-2xl font-mono font-bold text-center tracking-[0.3em] uppercase"
              placeholder="ABCDE"
            />
            <button onClick={handleJoin} disabled={busy || joinCodeInput.length < 4}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Join Room</span>
            </button>
          </div>
        )}

        {stage === 'in-lobby' && room && roomCode && (
          <div className="space-y-5 relative">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Room Code — share this</p>
              <button onClick={handleCopyCode}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-slate-950/80 border border-red-500/30 cursor-pointer hover:border-red-500/60 transition-all group">
                <span className="text-2xl font-mono font-bold tracking-[0.3em] text-red-300">{roomCode}</span>
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />}
              </button>
            </div>

            <div className="space-y-2">
              {room.seats.map((seat, idx) => (
                <SeatRow key={idx} seat={seat} isMe={idx === mySeatIndex} isHost={!!isHost}
                  onSetAi={(level) => handleSetSeatAi(idx, level)}
                  onOpen={() => handleOpenSeat(idx)} />
              ))}
            </div>

            {isHost ? (
              <button onClick={handleStartGame} disabled={occupiedCount < 2}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer">
                <Play className="h-4 w-4 fill-current" />
                <span>Start Game</span>
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Waiting for the host to start the game…</span>
              </div>
            )}
            {occupiedCount < 2 && (
              <p className="text-[10px] text-slate-500 text-center -mt-3">Need at least 2 seats filled (human or AI) to start.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function aiNameFor(seatIndex: number): string {
  return ['Seamus', 'Clodagh', 'Dervla', 'Niamh'][seatIndex] || 'Bot';
}

function SeatRow({ seat, isMe, isHost, onSetAi, onOpen }: {
  seat: RoomSeat; isMe: boolean; isHost: boolean;
  onSetAi: (level: 'easy' | 'medium' | 'hard') => void; onOpen: () => void;
}) {
  const [showAiPicker, setShowAiPicker] = useState(false);

  return (
    <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          seat.type === 'ai' ? 'bg-slate-800 text-slate-300'
          : seat.type === 'human' ? 'bg-blue-500/20 text-blue-300'
          : 'bg-slate-900 text-slate-600'
        }`}>
          {seat.type === 'ai' ? <Cpu className="h-4 w-4" /> : seat.type === 'human' ? <User className="h-4 w-4" /> : <Wifi className="h-4 w-4 opacity-40" />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-200 truncate">
            {seat.type === 'open' ? 'Open seat' : seat.name}
            {isMe && <span className="text-red-400 font-normal"> (you)</span>}
          </div>
          {seat.type === 'ai' && <div className="text-[9px] text-slate-500 uppercase font-bold">{seat.aiLevel}</div>}
          {seat.type === 'open' && <div className="text-[9px] text-slate-600">Waiting for a player to join…</div>}
        </div>
      </div>

      {isHost && seat.type !== 'human' && (
        <div className="relative shrink-0">
          {seat.type === 'ai' ? (
            <button onClick={onOpen} title="Remove bot, open this seat"
              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => setShowAiPicker(v => !v)}
              className="px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-[10px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer">
              Add Bot
            </button>
          )}
          {showAiPicker && (
            <div className="absolute right-0 top-8 z-10 bg-slate-900 border border-white/10 rounded-lg shadow-xl p-1.5 flex gap-1">
              {(['easy', 'medium', 'hard'] as const).map(level => (
                <button key={level} onClick={() => { onSetAi(level); setShowAiPicker(false); }}
                  className="px-2 py-1 rounded text-[9px] font-bold uppercase text-slate-300 hover:bg-red-600/20 hover:text-red-300 transition-all cursor-pointer">
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {isHost && seat.type === 'human' && !isMe && (
        <button onClick={onOpen} title="Remove player" className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer shrink-0">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
