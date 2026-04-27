// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomJoinForm } from "#/components/lobby/room-join-form";

const defaultProps = {
  roomName: "skirmish-room",
  accessCode: "",
  onRoomNameChange: vi.fn(),
  onAccessCodeChange: vi.fn(),
  isConnecting: false,
  lastError: null,
  connectionStatus: "idle",
  onConnect: vi.fn(),
  onJoin: vi.fn().mockImplementation((e) => e.preventDefault()),
  onSignOut: vi.fn(),
};

describe("RoomJoinForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders room name input with provided value", () => {
    render(<RoomJoinForm {...defaultProps} />);
    expect((screen.getByLabelText("Room name") as HTMLInputElement).value).toBe(
      "skirmish-room",
    );
  });

  it("renders access code input", () => {
    render(<RoomJoinForm {...defaultProps} />);
    expect(screen.getByLabelText("Access code (optional)")).toBeTruthy();
  });

  it("calls onJoin on form submit", async () => {
    const onJoin = vi.fn().mockImplementation((e) => e.preventDefault());
    const user = userEvent.setup();
    render(<RoomJoinForm {...defaultProps} onJoin={onJoin} />);

    await user.click(screen.getByRole("button", { name: "Join room" }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("disables join button when connecting", () => {
    render(<RoomJoinForm {...defaultProps} isConnecting={true} />);
    expect(
      (screen.getByRole("button", { name: "Join room" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows error message when provided", () => {
    render(<RoomJoinForm {...defaultProps} lastError="Connection refused" />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Connection refused",
    );
  });

  it("calls onConnect when connect button clicked", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(<RoomJoinForm {...defaultProps} onConnect={onConnect} />);

    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
