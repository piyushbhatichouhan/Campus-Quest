DAVV Quest — Core Game Mechanics Summary

The UI is frozen. From this point, the focus is on making the game itself work.

Core concept:
DAVV Quest is a sequential real-world campus adventure, not a map containing independent checkpoints.

Checkpoint progression
HIDDEN
↓
REVEALED
↓
DISCOVERED
↓
CHALLENGE
↓
COMPLETED

Only the current checkpoint is active/revealed. Future checkpoints stay hidden until the current one is successfully completed.

Main gameplay loop
START
↓
First checkpoint revealed
↓
Follow clue / navigate
↓
Enter geofence
↓
CLAIM checkpoint
↓
Receive riddle/challenge
↓
Solve challenge
↓

- XP / reward
  ↓
  Next clue revealed
  ↓
  Next checkpoint revealed
  ↓
  Repeat
  ↓
  FINAL CHECKPOINT
  ↓
  GAME COMPLETE
  ⭐ Critical point — Discovery ≠ Challenge

These are two separate stages.

Discovery:

Player physically reaches the location.
Geofence detects them.
Player claims the checkpoint.
Game confirms: “Checkpoint discovered!”

Challenge:

Only after claiming does the riddle/task appear.
Player solves it.
Correct solution completes the checkpoint.
XP/reward is awarded.
The next clue is revealed.

So we do not require solving a riddle before allowing the player to claim the physical location.

⭐ Critical point — Sequential progression

The game should work like:

Checkpoint 1
↓
complete
↓
Checkpoint 2 revealed
↓
complete
↓
Checkpoint 3 revealed
↓
complete
↓
Checkpoint 4 revealed
↓
complete
↓
Final checkpoint

Not:

All 5 checkpoints visible
↓
Player chooses any one

The next checkpoint is part of the reward/progression from the previous checkpoint.

The first implementation will therefore be frontend/local only:

geofence → claim → challenge → answer → XP → next checkpoint

Firebase, backend authority, multiplayer, teams, and advanced inventory come afterward.
