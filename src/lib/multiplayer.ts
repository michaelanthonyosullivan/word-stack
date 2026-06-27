import { db } from './firebase';
import { ref, set, get, onValue, update, off, runTransaction } from 'firebase/database';

export type SeatType = 'human' | 'ai' | 'open';

export interface RoomSeat {
  type: SeatType;
  clientId: string | null;
  name: string;
  aiLevel?: 'easy' | 'medium' | 'hard';
}

export interface RoomData {
  hostId: string;
  createdAt: number;
  status: 'lobby' | 'playing' | 'ended';
  seats: RoomSeat[];
  gameStateJson?: string;
  actionRequestJson?: string;
}

const CLIENT_ID_KEY = 'upwords_client_id';
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I — easy to read aloud/type

/** A stable per-tab identity so reloading the page doesn't lose your seat.
 *  Uses sessionStorage (not localStorage) deliberately — localStorage is
 *  shared across every tab of the same browser, so testing host and guest
 *  in two tabs on one computer would otherwise make them collide into the
 *  same identity. sessionStorage is scoped to one tab, while still
 *  surviving a refresh of that same tab. */
export function getClientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function emptySeats(hostId: string, hostName: string): RoomSeat[] {
  return [
    { type: 'human', clientId: hostId, name: hostName || 'Host' },
    { type: 'open', clientId: null, name: '' },
    { type: 'open', clientId: null, name: '' },
    { type: 'open', clientId: null, name: '' }
  ];
}

/** Creates a new room, with the host occupying seat 0. Retries on the rare code collision. */
export async function createRoom(hostName: string): Promise<string> {
  const hostId = getClientId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const roomRef = ref(db, `rooms/${code}`);
    const existing = await get(roomRef);
    if (existing.exists()) continue;
    const room: RoomData = {
      hostId,
      createdAt: Date.now(),
      status: 'lobby',
      seats: emptySeats(hostId, hostName)
    };
    await set(roomRef, room);
    return code;
  }
  throw new Error('Could not generate a unique room code — please try again.');
}

/** Claims the first open seat in a room for this client. Returns the seat index, or null if the room is full/missing. */
export async function joinRoom(code: string, playerName: string): Promise<number | null> {
  const clientId = getClientId();
  const roomRef = ref(db, `rooms/${code.toUpperCase()}`);

  let claimedIndex: number | null = null;
  let lateJoinBlocked = false;
  const result = await runTransaction(roomRef, (room: RoomData | null) => {
    if (!room) return room; // room doesn't exist — abort, leave untouched
    // Already seated in this room? Just reconnect to the same seat.
    const existingIdx = room.seats.findIndex(s => s.clientId === clientId);
    if (existingIdx !== -1) {
      claimedIndex = existingIdx;
      return room;
    }
    if (room.status !== 'lobby') {
      // The game's roster was already locked in when it started — claiming a
      // "new" seat now would create a player with no actual game presence.
      lateJoinBlocked = true;
      claimedIndex = null;
      return room;
    }
    const openIdx = room.seats.findIndex(s => s.type === 'open');
    if (openIdx === -1) {
      claimedIndex = null;
      return room; // full — abort
    }
    room.seats[openIdx] = { type: 'human', clientId, name: playerName || 'Player' };
    claimedIndex = openIdx;
    return room;
  });

  if (!result.committed || !result.snapshot.exists()) return null;
  if (lateJoinBlocked) throw new Error('This game has already started — ask the host to create a new room.');
  return claimedIndex;
}

export function subscribeToRoom(code: string, callback: (data: RoomData | null) => void): () => void {
  const roomRef = ref(db, `rooms/${code.toUpperCase()}`);
  const handler = onValue(roomRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as RoomData) : null);
  });
  return () => off(roomRef, 'value', handler);
}

export async function updateSeat(code: string, seatIndex: number, seat: Partial<RoomSeat>): Promise<void> {
  await update(ref(db, `rooms/${code.toUpperCase()}/seats/${seatIndex}`), seat);
}

export async function leaveSeat(code: string, seatIndex: number): Promise<void> {
  await set(ref(db, `rooms/${code.toUpperCase()}/seats/${seatIndex}`), { type: 'open', clientId: null, name: '' });
}

export async function setRoomStatus(code: string, status: RoomData['status']): Promise<void> {
  await update(ref(db, `rooms/${code.toUpperCase()}`), { status });
}

export async function pushGameState(code: string, gameState: any): Promise<void> {
  await update(ref(db, `rooms/${code.toUpperCase()}`), { gameStateJson: JSON.stringify(gameState) });
}

export async function sendActionRequest(code: string, request: any): Promise<void> {
  await set(ref(db, `rooms/${code.toUpperCase()}/actionRequestJson`), JSON.stringify(request));
}

export async function clearActionRequest(code: string): Promise<void> {
  await set(ref(db, `rooms/${code.toUpperCase()}/actionRequestJson`), null);
}
