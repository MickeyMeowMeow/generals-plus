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
          presetId: "classic",
        },
        avatar: { source: "default" },
        stageAppearance: { backdropBlur: true, backdropOpacity: 58 },
      },
    };

    expect(profile.preferences?.backgroundImage.source).toBe("preset");
    expect(profile.preferences?.backgroundImage.presetId).toBe("classic");
  });
});
