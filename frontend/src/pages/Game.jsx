/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { playDiscoverySound, playSuccessSound } from "../utils/sounds";
import useGeolocation from "../hooks/useGeolocation";
import useGameEngine from "../hooks/useGameEngine";
import useTeamActivity from "../hooks/useTeamActivity";
import { useAuth } from "../context/AuthContext";

import GameMap from "../components/game/GameMap";
import GameHeader from "../components/game/GameHeader";
import GameBottomNav from "../components/game/GameBottomNav";
import SideMenu from "../components/game/SideMenu";
import QuestCard from "../components/game/QuestCard";
import QuestsView from "../components/game/QuestsView";
import InventoryView from "../components/game/InventoryView";
import RankView from "../components/game/RankView";
import TeamNotification from "../components/game/TeamNotification";

import "./Game.css";

function Game() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location, error, loading } = useGeolocation();
  const { notifications, dismissNotification } = useTeamActivity();

  const {
    checkpoints: checkpointStates,
    currentCheckpoint,
    completedCheckpoints,
    completedJourney,
    currentClue,
    claimCheckpoint,
    submitChallenge,
    score,
    teamName,
    memberCount,
    maxMembers,
    teamStatus,
    eventStatus,
    elapsedSeconds,
    inventory,
    rank,
    level,
    nextLevelXP,
    gameCompleted,
    loadingGame,
    apiError,
  } = useGameEngine(location);

  const [activeTab, setActiveTab] = useState("map");
  const [checkpointTransition, setCheckpointTransition] = useState(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedCheckpoint =
    checkpointStates.find(
      (checkpoint) => checkpoint.id === selectedCheckpointId,
    ) || null;

  useEffect(() => {
    if (eventStatus === "waiting" || teamStatus === "waiting") {
      navigate("/lobby");
    }
  }, [eventStatus, teamStatus, navigate]);

  useEffect(() => {
    if (!currentCheckpoint || eventStatus !== "active") return;

    if (currentCheckpoint.status === "DISCOVERED") {
      playDiscoverySound();
      setSelectedCheckpointId(currentCheckpoint.id);
    }

    if (currentCheckpoint.status === "CHALLENGE") {
      setSelectedCheckpointId(currentCheckpoint.id);
    }
  }, [currentCheckpoint, eventStatus]);

  async function handleClaim(checkpointId) {
    const success = await claimCheckpoint(checkpointId);

    if (success) {
      setSelectedCheckpointId(checkpointId);
    }

    return success;
  }

  async function handleSubmitChallenge(checkpointId, answer) {
    const result = await submitChallenge(checkpointId, answer);

    if (result.success) {
      const completedCheckpoint = checkpointStates.find(
        (checkpoint) => checkpoint.id === checkpointId,
      );

      playSuccessSound();
      setSelectedCheckpointId(null);

      setCheckpointTransition({
        checkpoint: completedCheckpoint,
        points: result.points,
        rewardItem: result.rewardItem,
      });

      window.setTimeout(() => {
        setCheckpointTransition(null);
      }, 2500);
    }

    return result;
  }

  function handleCloseQuest() {
    setSelectedCheckpointId(null);
  }

  function handleQuestSelect(checkpointId) {
    setSelectedCheckpointId(checkpointId);
  }

  if (loadingGame) {
    return (
      <div className="game-page">
        <main
          className="game-main"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "12px",
          }}
        >
          <p>CONNECTING TO CAMPUS QUEST...</p>
        </main>
      </div>
    );
  }

  const isEventEnded =
    eventStatus === "stopped" || eventStatus === "completed";

  return (
    <div className="game-page">
      <TeamNotification
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      <GameHeader
        score={score}
        teamName={teamName}
        memberCount={memberCount}
        maxMembers={maxMembers}
        elapsedSeconds={elapsedSeconds}
        eventStatus={eventStatus}
        onMenuOpen={() => setMenuOpen(true)}
      />

      {isEventEnded && (
        <div className="event-ended-banner" role="status" aria-live="assertive">
          <div className="event-ended-banner-text">
            <strong>
              {eventStatus === "completed"
                ? "🏁 OFFICIAL RESULTS FINALIZED"
                : "🛑 EVENT ENDED BY ADMINISTRATOR"}
            </strong>
            <span>
              All checkpoint claims and challenge submissions are locked.
            </span>
          </div>
          <button
            type="button"
            className="event-ended-banner-btn"
            onClick={() => navigate("/leaderboard")}
          >
            VIEW STANDINGS ▶
          </button>
        </div>
      )}

      <main className="game-main">
        {(apiError || error) && (
          <div className="game-api-error" role="alert">
            {apiError || error}
          </div>
        )}

        {/* Tab 1: Map Tab */}
        {activeTab === "map" && (
          <GameMap
            location={location}
            error={error}
            loading={loading}
            checkpointStates={checkpointStates}
            onCheckpointSelect={handleQuestSelect}
          />
        )}

        {/* Tab 2: Quests Tab */}
        {activeTab === "quests" && (
          <QuestsView
            checkpoints={checkpointStates}
            currentCheckpoint={currentCheckpoint}
            currentClue={currentClue}
            completedJourney={completedJourney}
            eventStatus={eventStatus}
            onSelectCheckpoint={handleQuestSelect}
            score={score}
            gameCompleted={gameCompleted}
            onSwitchToMap={() => setActiveTab("map")}
            onNavigateLeaderboard={() => navigate("/leaderboard")}
          />
        )}

        {/* Tab 3: Inventory Tab */}
        {activeTab === "inventory" && (
          <InventoryView
            inventory={inventory}
            onSwitchToMap={() => setActiveTab("map")}
          />
        )}

        {/* Tab 4: Rank Tab */}
        {activeTab === "rank" && (
          <RankView
            user={user}
            score={score}
            level={level}
            nextLevelXP={nextLevelXP}
            rank={rank}
            completedCheckpoints={completedCheckpoints}
            inventory={inventory}
          />
        )}

        {/* Quest Card Modal Overlay */}
        <QuestCard
          checkpoint={selectedCheckpoint}
          eventStatus={eventStatus}
          currentClue={currentClue}
          onClaim={handleClaim}
          onSubmitChallenge={handleSubmitChallenge}
          onClose={handleCloseQuest}
        />
      </main>

      {/* Checkpoint Complete Transition Celebration Modal */}
      {checkpointTransition && (
        <div className="checkpoint-transition">
          <div className="checkpoint-transition-card">
            <div className="checkpoint-transition-icon">✓</div>

            <div className="checkpoint-transition-label">
              CHECKPOINT COMPLETE
            </div>

            <h2>{checkpointTransition.checkpoint?.name}</h2>

            <div className="checkpoint-transition-xp">
              +{checkpointTransition.points} XP
            </div>

            {checkpointTransition.rewardItem && (
              <div
                style={{
                  margin: "12px 0",
                  padding: "10px",
                  background: "#181510",
                  border: "2px solid #f5c542",
                  color: "#f5c542",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                🎒 REWARD EARNED: {checkpointTransition.rewardItem.name}
              </div>
            )}

            {checkpointTransition.checkpoint?.nextClue && (
              <div className="checkpoint-transition-clue">
                <span>NEXT CLUE</span>
                <p>{checkpointTransition.checkpoint.nextClue}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation with tab switching */}
      <GameBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Side Menu */}
      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelectTab={setActiveTab}
      />
    </div>
  );
}

export default Game;
