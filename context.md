# Word Stack — Dev Context

**Stack:** React + TypeScript + Vite + Tailwind CSS + Firebase Realtime DB  
**Board:** 7×7 grid, max stack height 5  
**Players:** 1 human + up to 3 AI opponents, or online multiplayer  
**Key files:**
- src/App.tsx — root shell
- src/hooks/use-upwords.ts — all game state
- src/lib/upwords-ai.ts — AI move generation
- src/lib/multiplayer.ts — Firebase sync
- src/components/ — Board, Rack, Scoreboard, CoachPanel, MoveLog, Header, MobileHintBar

**Change log:**
- sync-v10-host-rewind — online multiplayer host rewind
- sync-v11-mobile-hint — MobileHintBar above rack on mobile
