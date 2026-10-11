/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth, initializeFirebase } from "../config/firebase";
import { gameApi } from "../services/gameApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);

  // Resolves the authenticated user's team membership from the backend
  const refreshTeam = useCallback(async (targetUser = null) => {
    const { auth: firebaseAuth } = await initializeFirebase();
    const activeUser = targetUser || firebaseAuth?.currentUser;
    if (!activeUser) {
      setTeam(null);
      return null;
    }

    try {
      setTeamLoading(true);
      const teamData = await gameApi.getMyTeam();
      if (teamData && teamData.hasTeam) {
        setTeam(teamData);
        return teamData;
      } else {
        setTeam(null);
        return null;
      }
    } catch (err) {
      console.warn("Could not load team data:", err.message);
      setTeam(null);
      return null;
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    initializeFirebase()
      .then(({ auth: firebaseAuth }) => {
        if (!isMounted) return;
        unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
            await refreshTeam(currentUser);
          } else {
            setTeam(null);
          }
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error("Failed to initialize Firebase Auth:", err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [refreshTeam]);

  // Leader Registration: Creates email/password Firebase user + backend team
  const registerLeader = async ({ email, password, leaderName, teamName }) => {
    const { auth: firebaseAuth } = await initializeFirebase();
    let currentUser = firebaseAuth.currentUser;

    // 1. Create Firebase Auth user if not already signed in as this email
    if (!currentUser || currentUser.isAnonymous || currentUser.email !== email) {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password,
      );
      currentUser = userCredential.user;
    }

    // 2. Set Firebase displayName
    if (leaderName) {
      try {
        await updateProfile(currentUser, { displayName: leaderName });
      } catch {
        // Non-critical profile update failure
      }
    }

    setUser({ ...currentUser, displayName: leaderName });

    // 3. Create Team on backend (idempotent)
    const teamData = await gameApi.createTeam(teamName, leaderName);
    const fullTeam = await refreshTeam(currentUser);

    return { user: currentUser, team: fullTeam || teamData };
  };

  // Leader Login
  const loginLeader = async (email, password) => {
    const { auth: firebaseAuth } = await initializeFirebase();
    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );
    const currentUser = userCredential.user;
    setUser(currentUser);
    const teamData = await refreshTeam(currentUser);
    return { user: currentUser, team: teamData };
  };

  // Anonymous Member Join: Creates or reuses anonymous Firebase session + joins team
  const joinAsMember = async (joinCode, playerName) => {
    const { auth: firebaseAuth } = await initializeFirebase();
    let currentUser = firebaseAuth.currentUser;

    // Create anonymous session if not already logged in
    if (!currentUser) {
      const userCredential = await signInAnonymously(firebaseAuth);
      currentUser = userCredential.user;
    }

    if (playerName) {
      try {
        await updateProfile(currentUser, { displayName: playerName });
      } catch {
        // Non-critical profile update failure
      }
    }

    setUser({ ...currentUser, displayName: playerName });

    // Join team on backend
    const joinResult = await gameApi.joinTeam(joinCode, playerName);
    const teamData = await refreshTeam(currentUser);

    return { user: currentUser, team: teamData || joinResult };
  };

  // Sign out handler
  const logout = async () => {
    const { auth: firebaseAuth } = await initializeFirebase();
    await signOut(firebaseAuth);
    setUser(null);
    setTeam(null);
  };

  const getIdToken = async () => {
    const { auth: firebaseAuth } = await initializeFirebase();
    const activeUser = firebaseAuth?.currentUser || auth?.currentUser;
    if (!activeUser) return null;
    return activeUser.getIdToken();
  };

  const isLeader = Boolean(
    team &&
      user &&
      (team.isLeader || team.role === "leader" || team.leaderUid === user.uid),
  );

  const hasTeam = Boolean(team && team.hasTeam && team.teamId);

  const value = {
    user,
    team,
    loading,
    teamLoading,
    isLeader,
    hasTeam,
    teamStatus: team?.status || null,
    registerLeader,
    loginLeader,
    joinAsMember,
    refreshTeam,
    logout,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
