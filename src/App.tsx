import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUpwords, OnlineConfig, OnlineRosterEntry } from './hooks/use-upwords';
import { Header } from './components/Header';
import { GameSettings } from './components/GameSettings';
import { OnlineLobby } from './components/OnlineLobby';
import { Board } from './components/Board';
import { Rack } from './components/Rack';
import { Scoreboard } from './components/Scoreboard';
import { TileBagInfo } from './components/TileBagInfo';
import { MoveLog } from './components/MoveLog';
import { CoachPanel } from './components/CoachPanel';
import { Trophy, HelpCircle, Sparkles, RefreshCw, ShieldQuestion, CheckCircle2, XCircle } from 'lucide-react';
import { CandidateMove } from './lib/upwords-ai';
import { RoomData, subscribeToRoom, pushGameState, sendActionRequest, clearActionRequest, setRoomStatus } from './lib/multiplayer';

// Bumped manually with each deploy — lets us confirm two different browsers
// are actually running the same build before debugging "it doesn't work"
// reports, rather than guessing about stale caches.
const BUILD_TAG = 'sync-v10-host-rewind';

function safeParse<T>(json: string | undefined | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

export default function App() {
  const [preGameScreen, setPreGameScreen] = useState<'mode-select' | 'local-setup' | 'online-lobby'>('mode-select');
  const [onlineInfo, setOnlineInfo] = useState<{ roomCode: string; mySeatIndex: number } | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const onlineGameInitRef = useRef(false);

  useEffect(() => {
    if (!onlineInfo) { setRoom(null); return; }
    const unsub = subscribeToRoom(onlineInfo.roomCode, setRoom);
    return unsub;
  }, [onlineInfo?.roomCode]);

  const isHost = !!(room && onlineInfo && room.seats[onlineInfo.mySeatIndex]?.clientId === room.hostId);
  // Player index among occupied seats only (open seats don't get a player slot) —
  // computed identically by every client from the same synced seat list, so everyone
  // agrees on who is "player 0", "player 1", etc. regardless of which raw seat they sit in.
  const myPlayerIndex = room && onlineInfo
    ? room.seats.slice(0, onlineInfo.mySeatIndex).filter(s => s.type !== 'open').length
    : 0;

  const [syncError, setSyncError] = useState<string | null>(null);
  const [hostEndedGame, setHostEndedGame] = useState(false);

  // Memoized specifically on the underlying JSON string — JSON.parse() always
  // returns a new object even when called twice on the identical string, so
  // without this, anything depending on these values would see a "new"
  // object on every single render, regardless of whether the data actually
  // changed (e.g. the guest selecting a tile, which is unrelated to the
  // synced game state, would still look like "new state arrived" and trigger
  // a reset of in-progress placements).
  const remoteState = useMemo(() => safeParse<any>(room?.gameStateJson), [room?.gameStateJson]);
  const incomingActionRequest = useMemo(() => safeParse<any>(room?.actionRequestJson), [room?.actionRequestJson]);

  const online: OnlineConfig | undefined = (onlineInfo && room) ? {
    isHost,
    mySeatIndex: myPlayerIndex,
    remoteState,
    onStateChange: (state) => {
      pushGameState(onlineInfo.roomCode, state).catch(e => setSyncError(`Failed to publish game state: ${e?.message || e}`));
    },
    onRequestAction: (action) => {
      sendActionRequest(onlineInfo.roomCode, { ...action, requestId: Math.random().toString(36).slice(2) })
        .catch(e => setSyncError(`Failed to send move: ${e?.message || e}`));
    },
    incomingActionRequest,
    onActionRequestProcessed: () => {
      clearActionRequest(onlineInfo.roomCode).catch(() => {});
    }
  } : undefined;

  const {
    board, players, tileBag, currentTurn, history, gameEnded, winnerId,
    dictLoaded, dictLoadingProgress, gameStarted, isAiThinking,
    placements, activeRack, hint, coachAnalysis, lastPlayPlacements,
    coachEnabled, setCoachEnabled,
    startNewGame, startOnlineGame, placeTileTemp, removeTileTemp, recallTiles, shuffleRack, renamePlayer, reorderRack,
    submitPlay, passTurn, exchangeTiles, getHint, clearHint, challengeWord, removeWord, humanMovesReady, hookError,
    turnSnapshots, rewindToTurn,
    closeCoachAndAdvance, getPlacementsPreview
  } = useUpwords(online);

  useEffect(() => {
    if (room?.status === 'ended' && gameStarted && !isHost) {
      setHostEndedGame(true);
    }
  }, [room?.status, gameStarted, isHost]);

  // Host-only: once the lobby marks the room "playing", initialize the shared
  // game state exactly once from the room's seat roster.
  useEffect(() => {
    if (!room || !onlineInfo || !isHost) return;
    if (room.status !== 'playing') return;
    if (room.gameStateJson) return; // already initialized
    if (onlineGameInitRef.current) return;
    onlineGameInitRef.current = true;
    const roster: OnlineRosterEntry[] = room.seats
      .filter(s => s.type !== 'open')
      .map(s => ({ name: s.name, isAi: s.type === 'ai', aiLevel: s.aiLevel }));
    startOnlineGame(roster);
  }, [room?.status, room?.gameStateJson, isHost]);

  // Index-based tile selection fixes the duplicate-letter bug
  const [selectedTile, setSelectedTile] = useState<{ letter: string; idx: number } | null>(null);
  const [bestMovePreview, setBestMovePreview] = useState<CandidateMove | null>(null);
  const [challengeResult, setChallengeResult] = useState<{ word: string; success: boolean } | null>(null);
  const [noHintAvailable, setNoHintAvailable] = useState(false);

  useEffect(() => {
    setNoHintAvailable(false);
  }, [currentTurn]);

  const handleCellClick = (r: number, c: number) => {
    if (players[currentTurn]?.isAi || gameEnded) return;
    const existingTemp = placements.find(p => p.r === r && p.c === c);
    if (existingTemp) {
      removeTileTemp(r, c);
    } else if (selectedTile) {
      placeTileTemp(r, c, selectedTile.letter);
      setSelectedTile(null);
    }
  };

  // Drag-and-drop from rack → board (also handles board temp-tile → board moves)
  const handleDropTile = (r: number, c: number, letter: string) => {
    if (players[currentTurn]?.isAi || gameEnded) return;
    placeTileTemp(r, c, letter);
    setSelectedTile(null);
  };

  const handleRestart = async () => {
    if (onlineInfo && room) {
      if (isHost) {
        if (window.confirm('End this game for everyone? All players will be returned to the start screen.')) {
          try { await setRoomStatus(onlineInfo.roomCode, 'ended'); } catch {}
          window.location.reload();
        }
      } else {
        if (window.confirm("Leave this game? The other players will continue without you — your seat will show as vacated.")) {
          try {
            await sendActionRequest(onlineInfo.roomCode, {
              type: 'leave', playerId: myPlayerIndex, requestId: Math.random().toString(36).slice(2)
            });
            // Deliberately NOT calling leaveSeat() here — mutating room.seats
            // mid-game would shift the seat-index-to-player-index calculation
            // for every player seated after this one, desyncing their identity
            // from the (intentionally frozen) players[] array. The hasLeft
            // flag set via the request above is the correct, safe record.
          } catch {}
          window.location.reload();
        }
      }
    } else {
      if (window.confirm('Start a new game? Current progress will be lost.')) {
        window.location.reload();
      }
    }
  };

  const handleChallenge = (word: string) => {
    const success = challengeWord(word);
    setChallengeResult({ word, success });
  };

  const handleAcceptHint = () => {
    if (!hint) return;
    setSelectedTile(null);
    const res = submitPlay(hint.placements);
    if (!res.success) {
      // Defensive fallback — board state changed since the hint was generated
      // and it's no longer valid. Just place the tiles so the player can see
      // why and adjust, rather than silently failing.
      hint.placements.forEach(p => placeTileTemp(p.r, p.c, p.letter));
    }
  };

  const handleRewind = (turnIndex: number) => {
    if (window.confirm('Rewind to before this move? Everything that happened after it will be undone.')) {
      setSelectedTile(null);
      rewindToTurn(turnIndex);
    }
  };

  const preview = getPlacementsPreview();
  const winner = gameEnded && winnerId !== null ? players.find(p => p.id === winnerId) : null;
  const finalMove = gameEnded ? [...history].reverse().find(h => h.type === 'play') : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#11161f] text-slate-100">
      <Header
        onRestart={handleRestart} gameStarted={gameStarted} winnerId={winnerId} players={players}
        roomCode={onlineInfo?.roomCode}
        restartLabel={!onlineInfo ? 'New Game' : isHost ? 'Stop Game' : 'Leave Game'}
      />

      {!gameStarted && !onlineInfo && preGameScreen === 'mode-select' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
          <div className="max-w-md w-full glass-card rounded-3xl border border-white/8 shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-teal-600/8 rounded-full blur-3xl pointer-events-none" />
            <div className="text-center mb-6 relative">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-xl shadow-teal-600/25 mb-4 ring-1 ring-teal-400/30">
                <span className="font-serif-luxury text-3xl font-bold text-white select-none">W</span>
              </div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Stack letters, build words, and outplay your opponents.</p>
            </div>
            <div className="space-y-3 relative">
              <button onClick={() => setPreGameScreen('local-setup')}
                className="w-full bg-slate-900/60 hover:bg-slate-900 border border-white/10 text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-all text-sm cursor-pointer">
                Play on This Device
              </button>
              <button onClick={() => setPreGameScreen('online-lobby')}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 active:scale-[0.98] transition-all text-sm cursor-pointer">
                Play Online
              </button>
            </div>
          </div>
        </div>
      ) : !gameStarted && !onlineInfo && preGameScreen === 'online-lobby' ? (
        <OnlineLobby
          onBack={() => setPreGameScreen('mode-select')}
          onGameStart={(roomCode, mySeatIndex) => setOnlineInfo({ roomCode, mySeatIndex })}
        />
      ) : !gameStarted && !onlineInfo ? (
        <GameSettings onStart={startNewGame} isLoading={!dictLoaded} dictProgress={dictLoadingProgress} />
      ) : onlineInfo && !gameStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="glass-card rounded-2xl border border-emerald-500/20 p-6 max-w-sm text-left">
            <p className="text-emerald-400 font-bold text-sm mb-3 text-center">Connecting…</p>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Room</span>
                <span className="text-teal-300 font-bold">{onlineInfo.roomCode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Room data received</span>
                <span className={room ? 'text-emerald-400' : 'text-amber-400'}>{room ? 'yes' : 'waiting…'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Room status</span>
                <span className="text-slate-300">{room?.status ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Game state published</span>
                <span className={room?.gameStateJson ? 'text-emerald-400' : 'text-amber-400'}>{room?.gameStateJson ? 'yes' : 'not yet'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">My role</span>
                <span className="text-slate-300">{isHost ? `host (player ${myPlayerIndex + 1})` : `player ${myPlayerIndex + 1}`}</span>
              </div>
            </div>
            {syncError && (
              <div className="mt-3 p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-lg text-[10px] text-teal-400 font-mono">
                {syncError}
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-4 text-center">
              If this doesn't update within a few seconds, try refreshing the page.
            </p>
            <button onClick={() => window.location.reload()}
              className="w-full mt-3 bg-slate-900/60 hover:bg-slate-900 border border-white/10 text-white font-bold py-2.5 rounded-xl active:scale-[0.98] transition-all text-xs cursor-pointer">
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 max-w-7xl w-full mx-auto min-h-0">

          {/* Board + Rack */}
          <div className="flex-1 flex flex-col items-center gap-4 min-h-0 justify-center">

            {/* Live word validation preview */}
            {placements.length > 0 && preview && (
              <div className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md animate-popup border flex flex-wrap items-center gap-2 ${
                preview.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
              }`}>
                {preview.isValid ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {preview.wordsFormed?.map(w => w.word).join(' + ')} — {preview.score} pts
                    </span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{preview.error}</span>
                    {preview.invalidWord && (
                      challengeResult?.word === preview.invalidWord ? (
                        challengeResult.success ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-normal">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Added — try Submit again
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 font-normal">
                            <XCircle className="h-3.5 w-3.5" />
                            Not a recognised word in any dictionary
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handleChallenge(preview.invalidWord!)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-teal-400/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-semibold transition-all active:scale-95 cursor-pointer"
                          title="Add this word to the dictionary if it's a real everyday word"
                        >
                          <ShieldQuestion className="h-3.5 w-3.5" />
                          Challenge '{preview.invalidWord}'
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            )}

            <Board
              board={board}
              placements={placements}
              onCellClick={handleCellClick}
              onDropTile={handleDropTile}
              selectedLetter={selectedTile?.letter ?? null}
              hint={bestMovePreview || hint}
              lastPlayPlacements={lastPlayPlacements}
            />

            <Rack
              rack={activeRack}
              selectedTileIdx={selectedTile?.idx ?? null}
              onSelectTile={(letter, idx) => setSelectedTile(prev => prev?.idx === idx ? null : { letter, idx })}
              onDeselectTile={() => setSelectedTile(null)}
              onShuffle={shuffleRack}
              onRecall={recallTiles}
              onSubmit={submitPlay}
              onPass={passTurn}
              onExchange={exchangeTiles}
              onDropTile={handleDropTile}
              onReorder={reorderRack}
              bagCount={tileBag.length}
              hasPlacements={placements.length > 0}
            />
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[340px] flex flex-col gap-4 shrink-0 overflow-y-auto no-scrollbar max-h-[90vh]">
            <Scoreboard
              players={players} currentTurn={currentTurn}
              isAiThinking={isAiThinking} winnerId={winnerId} gameEnded={gameEnded}
              onRenamePlayer={renamePlayer}
              canRename={(playerId) => !onlineInfo || isHost || myPlayerIndex === playerId}
            />
            <TileBagInfo bag={tileBag} />
            <CoachPanel
              onGetHint={() => setNoHintAvailable(!getHint())} onClearHint={clearHint} onAcceptHint={handleAcceptHint}
              activeHint={hint} coachAnalysis={coachAnalysis}
              onCloseAnalysis={closeCoachAndAdvance}
              onShowBestMovePreview={setBestMovePreview}
              hasPlacements={placements.length > 0}
              coachEnabled={coachEnabled}
              onToggleCoach={setCoachEnabled}
              isAiTurn={online ? currentTurn !== online.mySeatIndex : !!players[currentTurn]?.isAi}
              humanMovesReady={humanMovesReady}
              noHintAvailable={noHintAvailable}
            />
            <MoveLog history={history} players={players} onRemoveWord={removeWord}
              onRewind={handleRewind} canRewindTo={(idx) => idx < turnSnapshots.length} />
          </div>
        </main>
      )}

      <footer className="shrink-0 py-3 text-center">
        <p className="text-[10px] italic text-slate-500">©MMXXVI Michael O'Sullivan</p>
      </footer>

      {/* Host ended the game for everyone */}
      {hostEndedGame && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 text-center">
            <p className="font-serif-luxury text-xl font-bold text-white mb-2">Game Ended</p>
            <p className="text-xs text-slate-400 mb-6">The host has ended this game for everyone.</p>
            <button onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-600/20 active:scale-[0.98] transition-all text-sm">
              Return to Start
            </button>
          </div>
        </div>
      )}

      {/* Game-over modal */}
      {gameEnded && winner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-white/10 shadow-2xl p-8 text-center animate-popup">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 animate-bounce">
              <Trophy className="h-10 w-10" />
            </div>
            <h2 className="font-serif-luxury text-3xl font-bold text-white mb-2">Game Over!</h2>
            <p className="text-xs text-slate-400 mb-4">Final scores (rack penalties applied)</p>
            {finalMove && (
              <div className="mb-6 p-3 rounded-xl bg-teal-500/5 border border-teal-500/15">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Final Play</p>
                <p className="text-xs text-slate-300">
                  <span className="font-bold text-slate-100">{players.find(p => p.id === finalMove.playerId)?.name ?? finalMove.playerName}</span> played{' '}
                  <span className="font-serif-luxury font-bold text-teal-300 text-sm">
                    {finalMove.allWords?.join(' + ') || finalMove.word}
                  </span>{' '}
                  for <span className="font-mono font-bold text-white">{finalMove.score} pts</span>
                </p>
              </div>
            )}
            <div className="space-y-3 mb-8">
              {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
                <div key={player.id} className={`flex items-center justify-between p-3.5 rounded-xl border ${
                  player.id === winnerId
                    ? 'bg-emerald-500/10 border-emerald-500/30 font-bold'
                    : 'bg-slate-950/40 border-white/5'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-slate-500">{idx + 1}.</span>
                    <span className="text-xs text-slate-200">{player.name}</span>
                    {player.id === winnerId && <CrownIcon className="h-3.5 w-3.5 text-yellow-400 fill-current" />}
                  </div>
                  <span className="font-mono text-sm text-white">
                    {player.score} <span className="text-[10px] text-slate-500 font-sans uppercase font-normal">pts</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Play Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="currentColor" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </svg>
  );
}
