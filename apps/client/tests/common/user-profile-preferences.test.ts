import { describe, expect, it } from "vitest";

import type { UserProfile } from "#/common/types/user-profile";

describe("UserProfile preferences", () => {
  it("accepts a preset background preference", () => {
    const profile: UserProfile = {
      id: "u1",
      displayName: "Nova",
      preferences: {
        backgroundImage: {
          source: "preset",
          presetId: "default",
        },
        avatar: { source: "default" },
        motion: { mode: "system" },
        stageAppearance: { backdropBlur: true, backdropOpacity: 58 },
      },
    };

    expect(profile.preferences?.backgroundImage.source).toBe("preset");
    expect(profile.preferences?.backgroundImage.presetId).toBe("default");
  });

  it("accepts a motion preference override", () => {
    const profile: UserProfile = {
      id: "u1",
      displayName: "Nova",
      preferences: {
        backgroundImage: { source: "preset", presetId: "default" },
        avatar: { source: "default" },
        motion: { mode: "reduced" },
        stageAppearance: { backdropBlur: true, backdropOpacity: 58 },
      },
    };

    expect(profile.preferences?.motion.mode).toBe("reduced");
  });
});
