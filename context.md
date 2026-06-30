# Word Stack — Dev Context

**Stack:** React + TypeScript + Vite + Tailwind CSS + Firebase Realtime DB  
**Board:** 7×7 grid, max stack height 5  
**Players:** 1 human + up to 3 AI opponents, or online multiplayer  
**Key files:**
- src/App.tsx — root shell
- src/hooks/use-upwords.ts — all game state
- src/lib/upwords-engine.ts — board/rack validation, scoring, word-finding
- src/lib/upwords-ai.ts — AI move generation
- src/lib/multiplayer.ts — Firebase sync
- src/components/ — Board, Rack, Scoreboard, CoachPanel, MoveLog, Header, MobileHintBar

**Change log:**
- sync-v10-host-rewind — online multiplayer host rewind
- sync-v11-mobile-hint — MobileHintBar above rack on mobile
- sync-v12-turn-indicator — turn label + hint layout on mobile + desktop
- sync-v13-hint-rewind-fix — fixed "rack does not contain '<letter>'" false rejection after rewind: `rewindToTurn` now clears the stale `bestMoveRef`/`allMovesRef` hint cache, and `handleAcceptHint`'s failure fallback no longer re-places hint tiles that aren't actually in the rack
- sync-v14-host-hint-toggle — host can globally enable/disable the Hint feature for guests via a switch in CoachPanel; synced through `SharedGameState.hintsEnabledForGuests` (defaults true for older payloads); host's own hint access is never affected by their own toggle

**Known issues (open):**
- When a player leaves an online game, their turn is still played out instead of being skipped — should advance straight to the next active player. Not yet fixed.
