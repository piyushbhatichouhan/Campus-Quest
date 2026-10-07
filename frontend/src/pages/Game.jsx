import { useState } from "react";

import useGeolocation from "../hooks/useGeolocation";
import useGameEngine from "../hooks/useGameEngine";

import GameMap from "../components/game/GameMap";
import GameHeader from "../components/game/GameHeader";
import GameBottomNav from "../components/game/GameBottomNav";
import SideMenu from "../components/game/SideMenu";
import QuestCard from "../components/game/QuestCard";

import "./Game.css";

function Game() {
  const { location, error, loading } = useGeolocation();

  const {
    checkpoints: checkpointStates,
    claimCheckpoint,
    completeCheckpoint,
    score,
  } = useGameEngine(location);

  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);

  const selectedCheckpoint =
    checkpointStates.find(
      (checkpoint) => checkpoint.id === selectedCheckpointId,
    ) || null;

  const availableCheckpoint =
    checkpointStates.find((checkpoint) => checkpoint.status === "AVAILABLE") ||
    null;

  function handleClaim(checkpointId) {
    const success = claimCheckpoint(checkpointId);

    if (success) {
      setSelectedCheckpointId(checkpointId);
    }
  }

  function handleComplete(checkpointId) {
    const success = completeCheckpoint(checkpointId);

    if (success) {
      setSelectedCheckpointId(checkpointId);
    }
  }

  function handleCloseQuest() {
    setSelectedCheckpointId(null);
  }

  function handleQuestSelect(checkpointId) {
    setSelectedCheckpointId(checkpointId);
  }

  return (
    <div className="game-page">
      <GameHeader score={score} onMenuOpen={() => setMenuOpen(true)} />

      <main className="game-main">
        <GameMap
          location={location}
          error={error}
          loading={loading}
          checkpointStates={checkpointStates}
          onCheckpointSelect={handleQuestSelect}
        />

        <QuestCard
          checkpoint={selectedCheckpoint}
          availableCheckpoint={availableCheckpoint}
          onClaim={handleClaim}
          onComplete={handleComplete}
          onClose={handleCloseQuest}
          onSelectCheckpoint={handleQuestSelect}
        />
      </main>

      <GameBottomNav />

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

export default Game;
