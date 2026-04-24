import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useUserAuthStore } from "#/features/auth/store/userAuthStore";
import { useMatchConnectionStore } from "#/features/match/store/matchConnectionStore";

// Authentication page where players create or manage their anonymous session.
export default function UserPage() {
  const navigate = useNavigate();
  const [displayNameInput, setDisplayNameInput] = useState("Commander");

  const status = useUserAuthStore((state) => state.status);
  const currentDisplayName = useUserAuthStore((state) => state.displayName);
  const lastError = useUserAuthStore((state) => state.lastError);
  const signInAnonymously = useUserAuthStore(
    (state) => state.signInAnonymously,
  );
  const signOut = useUserAuthStore((state) => state.signOut);

  const resetMatchConnection = useMatchConnectionStore((state) => state.reset);

  // Sign in as a guest and navigate to the lobby on success.
  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await signInAnonymously(displayNameInput);
    if (useUserAuthStore.getState().status === "authenticated") {
      navigate("/lobby");
    }
  };

  // Tear down the match connection and clear the auth session.
  const handleSignOut = async () => {
    await resetMatchConnection();
    await signOut();
  };

  const isBusy = status === "authenticating";
  const isAuthenticated = status === "authenticated";

  return (
    <section className="page" aria-label="User Page">
      <h2>User</h2>
      <p>
        Create a player session with Colyseus auth before entering the lobby.
      </p>
      <p className="status-line" role="status">
        Auth status: {status}
      </p>

      {isAuthenticated ? (
        <p>
          Active player: <strong>{currentDisplayName ?? "anonymous"}</strong>
        </p>
      ) : null}

      {lastError ? (
        <p className="error-text" role="alert">
          {lastError}
        </p>
      ) : null}

      <form className="room-form" onSubmit={handleSignIn}>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          name="displayName"
          value={displayNameInput}
          onChange={(event) => setDisplayNameInput(event.target.value)}
          autoComplete="nickname"
        />

        <div className="actions">
          <button type="submit" disabled={isBusy}>
            {isBusy ? "Signing in..." : "Sign in anonymously"}
          </button>

          {isAuthenticated ? (
            <button type="button" onClick={() => navigate("/lobby")}>
              Enter lobby
            </button>
          ) : null}

          {isAuthenticated ? (
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
