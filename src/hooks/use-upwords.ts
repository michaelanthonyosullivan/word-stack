import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Board, Player, PlayPlacement, PlayHistoryItem, createEmptyBoard,
  generateShuffledBag, validatePlay, copyBoard, getBoardStackHeight,
  BOARD_SIZE, RACK_SIZE
} from '../lib/upwords-engine';
import { generateAllLegalMoves, getAiPlay, CandidateMove } from '../lib/upwords-ai';
import { loadDictionary, challengeWord as challengeWordInDictionary, removeWordFromDictionary } from '../lib/dictionary';

const DEFAULT_AI_NAMES = ['Seamus', 'Clodagh', 'Dervla'];

interface GameSnapshot {
  board: Board;
  players: Player[];
  tileBag: string[];
  currentTurn: number;
  consecutivePasses: number;
  history: PlayHistoryItem[];
  lastPlayPlacements: { r: number; c: number }[];
}

// ── Online multiplayer types ──────────────────────────────────────────────
// The host's browser is the single source of truth: it runs all the same
// game logic as local play, but also publishes the full state after every
// change. Guests mirror that published state for display, and instead of
// mutating anything locally, send an action request that the host receives
// and applies through the exact same submitPlay/passTurn/exchangeTiles used
// for local play.
export interface MoveFeedback {
  forPlayerId: number;
  userWord: string;
  userScore: number;
  bestWord: string;
  bestScore: number;
  moveSeq: number;
}

export interface SharedGameState {
  board: Board;
  players: Player[];
  tileBag: string[];
  currentTurn: number;
  consecutivePasses: number;
  history: PlayHistoryItem[];
  gameEnded: boolean;
  winnerId: number | null;
  lastPlayPlacements: { r: number; c: number }[];
  pendingFeedback?: MoveFeedback | null;
  challengedWords?: string[];
  removedWords?: string[];
}

export type OnlineAction =
  | { type: 'play'; placements: PlayPlacement[] }
  | { type: 'pass' }
  | { type: 'exchange'; tiles: string[] }
  | { type: 'rewind'; turnIndex: number }
  | { type: 'leave'; playerId: number }
  | { type: 'challengeWord'; word: string }
  | { type: 'removeWord'; word: string }
  | { type: 'rename'; playerId: number; newName: string };

export interface OnlineConfig {
  isHost: boolean;
  mySeatIndex: number;
  remoteState: SharedGameState | null;
  onStateChange?: (state: SharedGameState) => void;
  onRequestAction?: (action: OnlineAction) => void;
  incomingActionRequest?: (OnlineAction & { requestId?: string }) | null;
  onActionRequestProcessed?: () => void;
}

export interface OnlineRosterEntry {
  name: string;
  isAi: boolean;
  aiLevel?: 'easy' | 'medium' | 'hard';
}

export function useUpwords(online?: OnlineConfig) {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [players, setPlayers] = useState<Player[]>([]);
  const [tileBag, setTileBag] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [consecutivePasses, setConsecutivePasses] = useState<number>(0);
  const [history, setHistory] = useState<PlayHistoryItem[]>([]);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const [dictLoaded, setDictLoaded] = useState<boolean>(false);
  const [dictLoadingProgress, setDictLoadingProgress] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  const [placements, setPlacements] = useState<PlayPlacement[]>([]);
  const [activeRack, setActiveRack] = useState<string[]>([]);

  const [hint, setHint] = useState<CandidateMove | null>(null);
  const [customWordsVersion, setCustomWordsVersion] = useState(0);
  const [sharedChallengedWords, setSharedChallengedWords] = useState<string[]>([]);
  const [sharedRemovedWords, setSharedRemovedWords] = useState<string[]>([]);
  const [coachAnalysis, setCoachAnalysis] = useState<{
    userPlay: { placements: PlayPlacement[]; score: number; word: string } | null;
    bestPlay: CandidateMove | null;
  } | null>(null);

  // Track last play for board highlighting
  const [lastPlayPlacements, setLastPlayPlacements] = useState<{ r: number; c: number }[]>([]);

  const bestMoveRef = useRef<CandidateMove | null>(null);
  const allMovesRef = useRef<CandidateMove[]>([]);
  const [coachEnabled, setCoachEnabled] = useState<boolean>(true);
  const [humanMovesReady, setHumanMovesReady] = useState<boolean>(false);

  useEffect(() => {
    loadDictionary((p) => {
      setDictLoadingProgress(p);
      if (p === 100) setDictLoaded(true);
    });
  }, []);

  const isFirstMoveOfGame = useCallback(() => {
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c].length > 0) return false;
    return true;
  }, [board]);

  const [hookError, setHookError] = useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<MoveFeedback | null>(null);

  const calculateHumanMoves = useCallback(() => {
    if (!gameStarted || gameEnded) return;
    const active = players[currentTurn];
    if (!active || active.isAi) { bestMoveRef.current = null; allMovesRef.current = []; setHumanMovesReady(false); return; }
    setHumanMovesReady(false);
    setTimeout(() => {
      try {
        const moves = generateAllLegalMoves(board, active.rack, isFirstMoveOfGame());
        allMovesRef.current = moves;
        bestMoveRef.current = moves[0] || null;
        setHumanMovesReady(true);
      } catch (e: any) {
        setHookError(`calculateHumanMoves: ${e?.message || e}`);
      }
    }, 100);
  }, [board, players, currentTurn, gameStarted, gameEnded, isFirstMoveOfGame]);

  useEffect(() => { calculateHumanMoves(); }, [currentTurn, gameStarted, calculateHumanMoves]);

  // ── Rewind system ────────────────────────────────────────────────────────
  // Captures a full snapshot of game state at the start of every turn, so the
  // player can rewind to "before history[i] happened" by restoring
  // turnSnapshots[i] — letting them replay a turn differently or undo a
  // mistake, theirs or an opponent's.
  const [turnSnapshots, setTurnSnapshots] = useState<GameSnapshot[]>([]);
  const prevSnapshotTurnRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameStarted) return;
    if (prevSnapshotTurnRef.current === currentTurn) return;
    prevSnapshotTurnRef.current = currentTurn;
    setTurnSnapshots(prev => [...prev, {
      board: copyBoard(board),
      players: players.map(p => ({ ...p, rack: [...p.rack] })),
      tileBag: [...tileBag],
      currentTurn,
      consecutivePasses,
      history: [...history],
      lastPlayPlacements: [...lastPlayPlacements]
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gameStarted]);

  const rewindToTurn = (turnIndex: number) => {
    if (online && !online.isHost) {
      online.onRequestAction?.({ type: 'rewind', turnIndex });
      return;
    }
    const snap = turnSnapshots[turnIndex];
    if (!snap) return;
    setBoard(copyBoard(snap.board));
    setPlayers(snap.players.map(p => ({ ...p, rack: [...p.rack] })));
    setTileBag([...snap.tileBag]);
    setCurrentTurn(snap.currentTurn);
    setConsecutivePasses(snap.consecutivePasses);
    setHistory([...snap.history]);
    setLastPlayPlacements([...snap.lastPlayPlacements]);
    setTurnSnapshots(prev => prev.slice(0, turnIndex + 1));
    prevSnapshotTurnRef.current = snap.currentTurn;
    setPlacements([]);
    setActiveRack([...snap.players[snap.currentTurn].rack]);
    setHint(null);
    setCoachAnalysis(null);
    setGameEnded(false);
    setWinnerId(null);
  };

  // ── Online sync: host publishes state after every change ──────────────────
  useEffect(() => {
    if (!online?.isHost || !gameStarted) return;
    online.onStateChange?.({
      board, players, tileBag, currentTurn, consecutivePasses, history,
      gameEnded, winnerId, lastPlayPlacements, pendingFeedback,
      challengedWords: sharedChallengedWords, removedWords: sharedRemovedWords
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, players, tileBag, currentTurn, consecutivePasses, history, gameEnded, winnerId, lastPlayPlacements, pendingFeedback, sharedChallengedWords, sharedRemovedWords, gameStarted]);

  // ── Online sync: guests mirror whatever the host publishes ─────────────────
  useEffect(() => {
    if (!online || online.isHost) return;
    const remote = online.remoteState;
    if (!remote) return;
    setBoard(remote.board);
    setPlayers(remote.players);
    setTileBag(remote.tileBag);
    setCurrentTurn(remote.currentTurn);
    setConsecutivePasses(remote.consecutivePasses);
    setHistory(remote.history);
    setGameEnded(remote.gameEnded);
    setWinnerId(remote.winnerId);
    setLastPlayPlacements(remote.lastPlayPlacements);
    setPendingFeedback(remote.pendingFeedback ?? null);
    if (remote.challengedWords) for (const w of remote.challengedWords) challengeWordInDictionary(w);
    if (remote.removedWords) for (const w of remote.removedWords) removeWordFromDictionary(w);
    setCustomWordsVersion(v => v + 1);
    setGameStarted(true);
    setPlacements([]);
    setActiveRack([...(remote.players[online.mySeatIndex]?.rack || [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.remoteState]);

  // ── Online sync: show coach feedback only on the screen of the player it's
  // actually for, AND only if that player has the setting enabled on their
  // own browser — works for host and guest alike, since the host's own moves
  // populate pendingFeedback locally and a guest's arrive via remoteState above.
  const lastShownFeedbackSeqRef = useRef<number | null>(null);
  useEffect(() => {
    if (!online || !pendingFeedback) return;
    if (pendingFeedback.forPlayerId !== online.mySeatIndex) return;
    if (lastShownFeedbackSeqRef.current === pendingFeedback.moveSeq) return;
    lastShownFeedbackSeqRef.current = pendingFeedback.moveSeq;
    if (!coachEnabled) return; // this player has feedback turned off on their own browser
    setCoachAnalysis({
      userPlay: { placements: [], score: pendingFeedback.userScore, word: pendingFeedback.userWord },
      bestPlay: pendingFeedback.bestWord
        ? ({ word: pendingFeedback.bestWord, score: pendingFeedback.bestScore, placements: [], wordsFormed: [] } as any)
        : null
    });
  }, [pendingFeedback, online?.mySeatIndex, coachEnabled]);

  // ── Online sync: host receives and applies action requests from guests ────
  const lastProcessedRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (!online?.isHost) return;
    const req = online.incomingActionRequest;
    if (!req) return;
    const reqKey = JSON.stringify(req);
    if (lastProcessedRequestRef.current === reqKey) return;
    lastProcessedRequestRef.current = reqKey;

    if (req.type === 'play') submitPlay(req.placements, true);
    else if (req.type === 'pass') passTurn(true);
    else if (req.type === 'exchange') exchangeTiles(req.tiles, true);
    else if (req.type === 'rewind') rewindToTurn(req.turnIndex);
    else if (req.type === 'challengeWord') challengeWord(req.word);
    else if (req.type === 'removeWord') removeWord(req.word);
    else if (req.type === 'rename') renamePlayer(req.playerId, req.newName);
    else if (req.type === 'leave') {
      const updatedPlayers = players.map(p => p.id === req.playerId ? { ...p, hasLeft: true } : p);
      setPlayers(updatedPlayers);
      if (currentTurn === req.playerId) {
        advanceTurn(updatedPlayers, tileBag, consecutivePasses);
      }
    }

    online.onActionRequestProcessed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.incomingActionRequest]);


  const startNewGame = (
    humanName: string,
    botDifficulty: 'easy' | 'medium' | 'hard',
    numAi: number = 3,
    showCoach: boolean = true
  ) => {
    setCoachEnabled(showCoach);
    const bag = generateShuffledBag();
    const count = Math.max(1, Math.min(3, numAi));
    const newPlayers: Player[] = [
      { id: 0, name: humanName.trim() || 'Player', score: 0, rack: bag.splice(0, RACK_SIZE), isAi: false },
      ...DEFAULT_AI_NAMES.slice(0, count).map((name, idx) => ({
        id: idx + 1, name, score: 0, rack: bag.splice(0, RACK_SIZE), isAi: true, aiLevel: botDifficulty
      }))
    ];
    setBoard(createEmptyBoard());
    setPlayers(newPlayers);
    setTileBag(bag);
    setCurrentTurn(0);
    setConsecutivePasses(0);
    setHistory([]);
    setGameEnded(false);
    setWinnerId(null);
    setPlacements([]);
    setCoachAnalysis(null);
    setHint(null);
    setLastPlayPlacements([]);
    setActiveRack(newPlayers[0].rack);
    setGameStarted(true);
    setTurnSnapshots([]);
    prevSnapshotTurnRef.current = null;
    bestMoveRef.current = null;
    allMovesRef.current = [];
  };

  /** Host-only: initializes an online game from the room's seat roster (mixed humans + AI). */
  const startOnlineGame = (roster: OnlineRosterEntry[]) => {
    setCoachEnabled(true);
    const bag = generateShuffledBag();
    const newPlayers: Player[] = roster.map((r, idx) => {
      const p: Player = {
        id: idx, name: r.name.trim() || `Player ${idx + 1}`, score: 0, rack: bag.splice(0, RACK_SIZE), isAi: r.isAi
      };
      if (r.isAi && r.aiLevel) p.aiLevel = r.aiLevel; // omit entirely for humans — Firebase rejects undefined
      return p;
    });
    setBoard(createEmptyBoard());
    setPlayers(newPlayers);
    setTileBag(bag);
    setCurrentTurn(0);
    setConsecutivePasses(0);
    setHistory([]);
    setGameEnded(false);
    setWinnerId(null);
    setPlacements([]);
    setCoachAnalysis(null);
    setHint(null);
    setLastPlayPlacements([]);
    setActiveRack([...(newPlayers[online?.mySeatIndex ?? 0]?.rack || [])]);
    setGameStarted(true);
    setTurnSnapshots([]);
    prevSnapshotTurnRef.current = null;
    bestMoveRef.current = null;
    allMovesRef.current = [];
  };

  // ── Tile Placement ─────────────────────────────────────────────────────────
  const placeTileTemp = (r: number, c: number, letter: string) => {
    if (gameEnded || players[currentTurn]?.isAi) return;
    if (online && currentTurn !== online.mySeatIndex) return;
    const existingIdx = placements.findIndex(p => p.r === r && p.c === c);
    if (existingIdx !== -1) {
      const prevLetter = placements[existingIdx].letter;
      setPlacements(prev => { const n = [...prev]; n.splice(existingIdx, 1); return [...n, { r, c, letter }]; });
      setActiveRack(rack => {
        const n = [...rack, prevLetter];
        const i = n.indexOf(letter); if (i !== -1) n.splice(i, 1);
        return n;
      });
      return;
    }
    setPlacements(prev => [...prev, { r, c, letter }]);
    setActiveRack(rack => { const n = [...rack]; const i = n.indexOf(letter); if (i !== -1) n.splice(i, 1); return n; });
    setHint(null);
  };

  const removeTileTemp = (r: number, c: number) => {
    const idx = placements.findIndex(p => p.r === r && p.c === c);
    if (idx === -1) return;
    const letter = placements[idx].letter;
    setPlacements(prev => prev.filter((_, i) => i !== idx));
    setActiveRack(rack => [...rack, letter]);
  };

  const recallTiles = () => {
    if (placements.length === 0) return;
    // BUG FIX: was players[0].rack — must use current player's rack
    setPlacements([]);
    setActiveRack([...players[currentTurn].rack]);
    setHint(null);
  };

  const shuffleRack = () => {
    setActiveRack(rack => {
      const n = [...rack];
      for (let i = n.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [n[i], n[j]] = [n[j], n[i]];
      }
      return n;
    });
  };

  const renamePlayer = (playerId: number, newName: string) => {
    const trimmed = newName.trim().slice(0, 15);
    if (!trimmed) return;
    if (online && !online.isHost) {
      // Guests may only rename themselves, and must route the change
      // through the host — the players[] array is host-authoritative, so a
      // purely local rename here would just get overwritten by the next
      // synced update from the host.
      if (playerId !== online.mySeatIndex) return;
      online.onRequestAction?.({ type: 'rename', playerId, newName: trimmed });
      return;
    }
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: trimmed } : p));
  };

  /** Move a rack tile from one position to another, for visually composing words before placing them. */
  const reorderRack = (fromIdx: number, toIdx: number) => {
    setActiveRack(rack => {
      if (fromIdx < 0 || fromIdx >= rack.length || toIdx < 0 || toIdx >= rack.length || fromIdx === toIdx) return rack;
      const n = [...rack];
      const [moved] = n.splice(fromIdx, 1);
      n.splice(toIdx, 0, moved);
      return n;
    });
  };

  // ── Submit Human Play ──────────────────────────────────────────────────────
  // Accepts an optional placementsOverride so a hint can be placed and
  // submitted in one atomic call (avoids relying on placeTileTemp's state
  // updates having applied yet, which they won't have within the same tick).
  const submitPlay = (placementsOverride?: PlayPlacement[], bypassOwnTurnCheck = false) => {
    const activePlacements = placementsOverride ?? placements;
    if (activePlacements.length === 0) return { success: false, error: 'No tiles placed.' };

    if (online && !online.isHost) {
      if (currentTurn !== online.mySeatIndex) return { success: false, error: 'Not your turn.' };
      online.onRequestAction?.({ type: 'play', placements: activePlacements });
      setPlacements([]);
      setHint(null);
      return { success: true };
    }

    // Host path: if this was triggered by the host's own UI (not by processing
    // a remote player's request, which legitimately acts on a different
    // seat's turn), it must actually be the host's own seat's turn.
    if (online?.isHost && !bypassOwnTurnCheck && currentTurn !== online.mySeatIndex) {
      return { success: false, error: 'Not your turn.' };
    }

    const player = players[currentTurn];
    if (!player || player.isAi) return { success: false, error: 'Not your turn.' };

    const isFirst = isFirstMoveOfGame();
    const result = validatePlay(board, activePlacements, isFirst, player.rack);
    if (!result.isValid || !result.wordsFormed || result.score === undefined)
      return { success: false, error: result.error || 'Invalid move.' };

    const nextBoard = copyBoard(board);
    for (const p of activePlacements) nextBoard[p.r][p.c].push({ letter: p.letter, placedBy: player.id });

    const nextBag = [...tileBag];
    const drawn: string[] = [];
    for (let i = 0; i < activePlacements.length; i++) {
      if (nextBag.length > 0) drawn.push(nextBag.shift()!);
    }
    // Compute the post-play rack from the authoritative player.rack (not the
    // displayed activeRack) so this is correct whether the placed tiles were
    // ever reflected in activeRack or not.
    let tempRack = [...player.rack];
    for (const p of activePlacements) {
      const idx = tempRack.indexOf(p.letter);
      if (idx !== -1) tempRack.splice(idx, 1);
    }
    const nextRack = [...tempRack, ...drawn];

    const updatedPlayers = players.map(p =>
      p.id === player.id ? { ...p, score: p.score + result.score!, rack: nextRack } : p
    );

    const allWords = result.wordsFormed.map(w => w.word);
    const historyItem: PlayHistoryItem = {
      playerId: player.id,
      playerName: player.name,
      word: allWords[0] || '',
      allWords,
      score: result.score!,
      type: 'play',
      placedTiles: activePlacements.map(p => ({ r: p.r, c: p.c, letter: p.letter, prevHeight: getBoardStackHeight(board, p.r, p.c) })),
      turnIndex: history.length
    };

    setBoard(nextBoard);
    setPlayers(updatedPlayers);
    setTileBag(nextBag);
    setHistory(prev => [...prev, historyItem]);
    setConsecutivePasses(0);
    setLastPlayPlacements(activePlacements.map(p => ({ r: p.r, c: p.c })));
    setPlacements([]);
    setActiveRack(nextRack);
    setHint(null);

    if (online) {
      // Always publish feedback for online games, regardless of the HOST's
      // own local coachEnabled setting — this runs on whichever browser is
      // host, executing moves on behalf of every player, so gating on the
      // host's own preference here would incorrectly silence feedback for
      // every other player too. Each player's own browser decides whether
      // to actually display it, based on their own setting (see the
      // dedicated effect below).
      setPendingFeedback({
        forPlayerId: player.id,
        userWord: allWords[0] || '',
        userScore: result.score!,
        bestWord: bestMoveRef.current?.word || '',
        bestScore: bestMoveRef.current?.score ?? 0,
        moveSeq: historyItem.turnIndex
      });
      advanceTurn(updatedPlayers, nextBag, 0);
    } else if (coachEnabled) {
      setCoachAnalysis({
        userPlay: { placements: activePlacements, score: result.score!, word: allWords[0] || '' },
        bestPlay: bestMoveRef.current
      });
    } else {
      advanceTurn(updatedPlayers, nextBag, 0);
    }

    return { success: true };
  };

  const passTurn = (bypassOwnTurnCheck = false) => {
    if (online && !online.isHost) {
      if (currentTurn !== online.mySeatIndex) return;
      recallTiles(); // restore any tentatively-placed tiles to the rack before passing
      online.onRequestAction?.({ type: 'pass' });
      return;
    }
    if (online?.isHost && !bypassOwnTurnCheck && currentTurn !== online.mySeatIndex) return;
    const player = players[currentTurn];
    if (player.isAi) return;
    recallTiles();
    const historyItem: PlayHistoryItem = {
      playerId: player.id, playerName: player.name,
      word: '', allWords: [], score: 0, type: 'pass', placedTiles: [], turnIndex: history.length
    };
    setHistory(prev => [...prev, historyItem]);
    const nextPasses = consecutivePasses + 1;
    if (nextPasses >= players.length) endGame(players, tileBag);
    else advanceTurn(players, tileBag, nextPasses);
  };

  const exchangeTiles = (tilesToExchange: string[], bypassOwnTurnCheck = false) => {
    if (tilesToExchange.length === 0) return { success: false, error: 'No tiles selected.' };
    if (tileBag.length < tilesToExchange.length)
      return { success: false, error: `Not enough tiles in bag (${tileBag.length} left).` };

    if (online && !online.isHost) {
      if (currentTurn !== online.mySeatIndex) return { success: false, error: 'Not your turn.' };
      recallTiles();
      online.onRequestAction?.({ type: 'exchange', tiles: tilesToExchange });
      return { success: true };
    }

    if (online?.isHost && !bypassOwnTurnCheck && currentTurn !== online.mySeatIndex) {
      return { success: false, error: 'Not your turn.' };
    }

    const player = players[currentTurn];
    if (player.isAi) return { success: false, error: 'Not your turn.' };

    recallTiles();
    let tempRack = [...player.rack];
    for (const tile of tilesToExchange) {
      const idx = tempRack.indexOf(tile);
      if (idx !== -1) tempRack.splice(idx, 1);
    }
    const nextBag = [...tileBag];
    const drawn: string[] = [];
    for (let i = 0; i < tilesToExchange.length; i++) drawn.push(nextBag.shift()!);
    nextBag.push(...tilesToExchange);
    for (let i = nextBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
    }
    const nextRack = [...tempRack, ...drawn];
    const updatedPlayers = players.map(p => p.id === player.id ? { ...p, rack: nextRack } : p);
    const historyItem: PlayHistoryItem = {
      playerId: player.id, playerName: player.name,
      word: '', allWords: [], score: 0, type: 'exchange', placedTiles: [], turnIndex: history.length
    };
    setPlayers(updatedPlayers);
    setTileBag(nextBag);
    setHistory(prev => [...prev, historyItem]);
    setActiveRack(nextRack);
    const nextPasses = consecutivePasses + 1;
    if (nextPasses >= players.length) endGame(updatedPlayers, nextBag);
    else advanceTurn(updatedPlayers, nextBag, nextPasses);
    return { success: true };
  };

  const closeCoachAndAdvance = () => {
    setCoachAnalysis(null);
    if (!online) advanceTurn(players, tileBag, 0);
  };

  const advanceTurn = (currentPlayers: Player[], currentBag: string[], passesCount: number) => {
    const justPlayed = currentPlayers[currentTurn];
    if (justPlayed?.rack.length === 0 && currentBag.length === 0) {
      endGame(currentPlayers, currentBag);
      return;
    }
    // Skip over any player who has left the game — their turn never comes up.
    let next = (currentTurn + 1) % currentPlayers.length;
    let guard = 0;
    while (currentPlayers[next]?.hasLeft && guard < currentPlayers.length) {
      next = (next + 1) % currentPlayers.length;
      guard++;
    }
    setCurrentTurn(next);
    setConsecutivePasses(passesCount);
  };

  // ── AI Turn ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted || gameEnded || coachAnalysis !== null) return;
    if (online && !online.isHost) return; // only the host runs AI turns
    const currentPlayer = players[currentTurn];
    if (!currentPlayer?.isAi) return;

    setIsAiThinking(true);
    const perform = async () => {
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      const isFirst = isFirstMoveOfGame();
      const aiPlay = getAiPlay(board, currentPlayer, isFirst);

      if (aiPlay) {
        const nextBoard = copyBoard(board);
        for (const p of aiPlay.placements) nextBoard[p.r][p.c].push({ letter: p.letter, placedBy: currentPlayer.id });

        const nextBag = [...tileBag];
        const drawn: string[] = [];
        for (let i = 0; i < aiPlay.placements.length; i++) {
          if (nextBag.length > 0) drawn.push(nextBag.shift()!);
        }
        let tempRack = [...currentPlayer.rack];
        for (const p of aiPlay.placements) {
          const idx = tempRack.indexOf(p.letter); if (idx !== -1) tempRack.splice(idx, 1);
        }
        const nextRack = [...tempRack, ...drawn];
        const updatedPlayers = players.map(p =>
          p.id === currentPlayer.id ? { ...p, score: p.score + aiPlay.score, rack: nextRack } : p
        );

        // Collect all words the AI formed
        const allAiWords = aiPlay.wordsFormed
          ? aiPlay.wordsFormed.map((w: any) => w.word)
          : [aiPlay.word];

        const historyItem: PlayHistoryItem = {
          playerId: currentPlayer.id, playerName: currentPlayer.name,
          word: aiPlay.word, allWords: allAiWords, score: aiPlay.score, type: 'play',
          placedTiles: aiPlay.placements.map((p: PlayPlacement) => ({ r: p.r, c: p.c, letter: p.letter, prevHeight: getBoardStackHeight(board, p.r, p.c) })),
          turnIndex: history.length
        };
        setBoard(nextBoard);
        setPlayers(updatedPlayers);
        setTileBag(nextBag);
        setHistory(prev => [...prev, historyItem]);
        setConsecutivePasses(0);
        setLastPlayPlacements(aiPlay.placements.map((p: PlayPlacement) => ({ r: p.r, c: p.c })));
        setIsAiThinking(false);
        advanceTurn(updatedPlayers, nextBag, 0);
      } else {
        // Exchange or pass
        const canExchange = tileBag.length > 0;
        if (canExchange) {
          const count = Math.min(tileBag.length, currentPlayer.rack.length);
          const exchanged = currentPlayer.rack.slice(0, count);
          let tempRack = currentPlayer.rack.slice(count);
          const nextBag = [...tileBag];
          const drawn: string[] = [];
          for (let i = 0; i < count; i++) drawn.push(nextBag.shift()!);
          nextBag.push(...exchanged);
          for (let i = nextBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
          }
          const nextRack = [...tempRack, ...drawn];
          const updatedPlayers = players.map(p => p.id === currentPlayer.id ? { ...p, rack: nextRack } : p);
          const hi: PlayHistoryItem = {
            playerId: currentPlayer.id, playerName: currentPlayer.name,
            word: '', allWords: [], score: 0, type: 'exchange', placedTiles: [], turnIndex: history.length
          };
          setPlayers(updatedPlayers); setTileBag(nextBag);
          setHistory(prev => [...prev, hi]);
          const np = consecutivePasses + 1;
          setIsAiThinking(false);
          if (np >= players.length) endGame(updatedPlayers, nextBag);
          else advanceTurn(updatedPlayers, nextBag, np);
        } else {
          const hi: PlayHistoryItem = {
            playerId: currentPlayer.id, playerName: currentPlayer.name,
            word: '', allWords: [], score: 0, type: 'pass', placedTiles: [], turnIndex: history.length
          };
          setHistory(prev => [...prev, hi]);
          const np = consecutivePasses + 1;
          setIsAiThinking(false);
          if (np >= players.length) endGame(players, tileBag);
          else advanceTurn(players, tileBag, np);
        }
      }
    };
    perform().catch((e: any) => setHookError(`AI turn: ${e?.message || e}`));
  }, [currentTurn, gameStarted, gameEnded, coachAnalysis, online?.isHost]);

  const endGame = (currentPlayers: Player[], _bag: string[]) => {
    const finalized = currentPlayers.map(p => ({ ...p, score: Math.max(0, p.score - p.rack.length) }));
    let maxScore = -1; let winId = null;
    for (const p of finalized) { if (p.score > maxScore) { maxScore = p.score; winId = p.id; } }
    setPlayers(finalized);
    setGameEnded(true);
    setWinnerId(winId);
  };

  const getHint = (): boolean => {
    if (gameEnded) return false;
    if (online) {
      if (currentTurn !== online.mySeatIndex) return false;
    } else if (players[currentTurn]?.isAi) {
      return false;
    }
    if (bestMoveRef.current) { setHint(bestMoveRef.current); return true; }
    return false;
  };

  const clearHint = () => setHint(null);

  const getPlacementsPreview = () => {
    if (placements.length === 0) return null;
    return validatePlay(board, placements, isFirstMoveOfGame(), players[currentTurn]?.rack || []);
  };

  /**
   * Player-facing "challenge" — lets them add a rejected word to the common
   * dictionary, but only if it's already valid in the full Scrabble word
   * list (prevents adding made-up words; only rescues real words that were
   * wrongly excluded from the curated common-word list).
   */
  const challengeWord = (word: string): boolean => {
    const success = challengeWordInDictionary(word);
    if (success) {
      setCustomWordsVersion(v => v + 1);
      if (online?.isHost) {
        setSharedChallengedWords(prev => prev.includes(word) ? prev : [...prev, word]);
      } else if (online) {
        online.onRequestAction?.({ type: 'challengeWord', word });
      }
    }
    return success;
  };

  /** Flag a bot-played word as too obscure and remove it from this browser's dictionary. */
  const removeWord = (word: string): boolean => {
    const success = removeWordFromDictionary(word);
    if (success) {
      setCustomWordsVersion(v => v + 1);
      if (online?.isHost) {
        setSharedRemovedWords(prev => prev.includes(word) ? prev : [...prev, word]);
      } else if (online) {
        online.onRequestAction?.({ type: 'removeWord', word });
      }
    }
    return success;
  };

  return {
    board, players, tileBag, currentTurn, history, gameEnded, winnerId,
    dictLoaded, dictLoadingProgress, gameStarted, isAiThinking,
    placements, activeRack, hint, coachAnalysis, lastPlayPlacements,
    coachEnabled, setCoachEnabled, customWordsVersion, humanMovesReady, hookError, turnSnapshots, rewindToTurn,
    startNewGame, startOnlineGame, placeTileTemp, removeTileTemp, recallTiles, shuffleRack, renamePlayer, reorderRack,
    submitPlay, passTurn, exchangeTiles, getHint, clearHint, challengeWord, removeWord,
    closeCoachAndAdvance, getPlacementsPreview, isFirstMoveOfGame
  };
}
