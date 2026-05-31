import { Activity, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { BrandTitle, StageCenter } from "#/components/layout";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import type { SystemSettings } from "#/features/admin/api/system-settings-api";
import { systemSettingsApi } from "#/features/admin/api/system-settings-api";
import { useAuth } from "#/features/auth/hooks";
import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";

export function AdminSettingsPage() {
  const { state: authState } = useAuth();

  const colyseusEndpoint = resolveColyseusEndpoint().replace(/^ws/i, "http");
  const colyseusUrl = `${colyseusEndpoint}/colyseus`;
  const proxyBasePath = new URL(colyseusEndpoint).pathname.replace(/\/$/, "");

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    systemSettingsApi
      .get()
      .then((res) => setSettings(res))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load settings",
        );
        toast.error("Failed to load global settings.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: keyof SystemSettings) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleNumberChange = (key: keyof SystemSettings, val: string) => {
    if (!settings) return;
    const parsed = Number(val);
    if (Number.isNaN(parsed)) return;
    setSettings({
      ...settings,
      [key]: parsed,
    });
  };

  const handleStringChange = (key: keyof SystemSettings, val: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: val,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await systemSettingsApi.update(settings);
      setSettings(updated);
      toast.success("Admin settings updated successfully.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <StageCenter>
        <p className="text-game-text-dim text-center py-8">
          Loading Admin Control Center...
        </p>
      </StageCenter>
    );
  }

  if (error || !settings) {
    return (
      <StageCenter>
        <div className="grid gap-3 text-center">
          <p className="text-red-400">Error: {error || "No settings found"}</p>
          <Button asChild variant="outline">
            <Link to="/">Back to lobby</Link>
          </Button>
        </div>
      </StageCenter>
    );
  }

  return (
    <StageCenter>
      <div className="mx-auto grid max-w-2xl gap-5 sm:gap-6 py-6 pb-12">
        <BrandTitle compact />

        <div className="flex items-center justify-between border-b border-game-border pb-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <h1 className="text-lg font-bold">Admin Console</h1>
            </div>
          </div>
          <span className="rounded bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            SYSTEM CONTROL
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section: Feature Access */}
          <div className="border border-game-border bg-[rgb(27_27_27/0.85)] p-5 shadow-xl shadow-black/25 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-game-text-dim mb-3 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-game-accent" />
              Feature Controls
            </h2>

            <div className="flex items-center justify-between py-2 border-b border-game-border/40">
              <div className="grid gap-1">
                <Label
                  htmlFor="allowMapCreation"
                  className="font-medium text-sm"
                >
                  Allow Map Creation
                </Label>
                <p className="text-xs text-game-text-dim max-w-md">
                  Enable or disable creating and saving new custom maps for
                  regular players.
                </p>
              </div>
              <Switch
                id="allowMapCreation"
                checked={settings.allowMapCreation}
                onCheckedChange={() => handleToggle("allowMapCreation")}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="grid gap-1">
                <Label
                  htmlFor="allowMapUpdates"
                  className="font-medium text-sm"
                >
                  Allow Map Editing
                </Label>
                <p className="text-xs text-game-text-dim max-w-md">
                  Enable or disable updating existing custom maps for regular
                  players.
                </p>
              </div>
              <Switch
                id="allowMapUpdates"
                checked={settings.allowMapUpdates}
                onCheckedChange={() => handleToggle("allowMapUpdates")}
              />
            </div>
          </div>

          {/* Section: Limitations & Messaging */}
          <div className="border border-game-border bg-[rgb(27_27_27/0.85)] p-5 shadow-xl shadow-black/25 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-game-text-dim mb-3">
              Limitations & Announcements
            </h2>

            <div className="grid gap-1.5">
              <Label htmlFor="maxMapsPerUser" className="text-sm">
                Maximum Custom Maps Per User
              </Label>
              <Input
                id="maxMapsPerUser"
                type="number"
                value={settings.maxMapsPerUser}
                onChange={(e) =>
                  handleNumberChange("maxMapsPerUser", e.target.value)
                }
                min={0}
                className="border-game-border bg-game-bg text-game-text focus-visible:ring-white/20 w-32"
              />
              <p className="text-[11px] text-game-text-dim">
                Limits how many custom maps non-admin users can create.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-game-border/30">
              <div className="grid gap-1.5">
                <Label htmlFor="maxTotalRooms" className="text-sm">
                  Maximum Total Rooms Limit
                </Label>
                <Input
                  id="maxTotalRooms"
                  type="number"
                  value={settings.maxTotalRooms}
                  onChange={(e) =>
                    handleNumberChange("maxTotalRooms", e.target.value)
                  }
                  min={1}
                  className="border-game-border bg-game-bg text-game-text focus-visible:ring-white/20 w-32"
                />
                <p className="text-[11px] text-game-text-dim">
                  Limits the maximum number of simultaneous game/setup rooms
                  (Default: 50).
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="maxVsAiRooms" className="text-sm">
                  Maximum VS AI Rooms Limit
                </Label>
                <Input
                  id="maxVsAiRooms"
                  type="number"
                  value={settings.maxVsAiRooms}
                  onChange={(e) =>
                    handleNumberChange("maxVsAiRooms", e.target.value)
                  }
                  min={0}
                  className="border-game-border bg-game-bg text-game-text focus-visible:ring-white/20 w-32"
                />
                <p className="text-[11px] text-game-text-dim">
                  Limits the maximum number of simultaneous rooms vs AI bots
                  (Default: 20).
                </p>
              </div>
            </div>

            <div className="grid gap-1.5 pt-2">
              <Label htmlFor="systemBanner" className="text-sm">
                Global System Announcement Banner
              </Label>
              <Input
                id="systemBanner"
                value={settings.systemBanner}
                onChange={(e) =>
                  handleStringChange("systemBanner", e.target.value)
                }
                placeholder="Type a notice to broadcast to all players..."
                className="border-game-border bg-game-bg text-game-text placeholder:text-game-text-dim focus-visible:ring-white/20"
              />
              <p className="text-[11px] text-game-text-dim">
                Displayed at the top of the main lobby page. Leave empty to
                hide.
              </p>
            </div>
          </div>

          {/* Section: System Integrations */}
          <div className="border border-game-border bg-[rgb(27_27_27/0.85)] p-5 shadow-xl shadow-black/25 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-game-text-dim mb-3">
              System Integrations
            </h2>

            <div className="flex items-center justify-between py-2">
              <div className="grid gap-1">
                <Label className="font-medium text-sm text-game-text">
                  Colyseus Server Inspector
                </Label>
                <p className="text-xs text-game-text-dim max-w-sm">
                  Launch the live Colyseus dashboard to inspect active
                  matchmaker rooms and client connections.
                </p>
              </div>
              {authState.token && (
                <form
                  action={`${colyseusUrl}/login`}
                  method="POST"
                  target="_blank"
                  className="inline"
                  rel="noopener"
                >
                  <input type="hidden" name="token" value={authState.token} />
                  <input type="hidden" name="basePath" value={proxyBasePath} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 border border-game-border bg-game-bg px-3.5 py-1.5 text-xs font-semibold hover:bg-game-surface transition-colors select-none text-game-text cursor-pointer"
                  >
                    <Activity className="size-3.5 text-emerald-400 animate-pulse" />
                    Inspect Server
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Section: Danger Zone */}
          <div className="border border-red-500/20 bg-red-500/5 p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400 mb-3">
              Danger Zone
            </h2>

            <div className="flex items-center justify-between py-2">
              <div className="grid gap-1">
                <Label
                  htmlFor="maintenanceMode"
                  className="font-medium text-sm text-red-300"
                >
                  Maintenance Mode
                </Label>
                <p className="text-xs text-red-200/60 max-w-md">
                  Puts the application under maintenance, blocking all non-admin
                  sessions from game setup rooms or lobbies.
                </p>
              </div>
              <Switch
                id="maintenanceMode"
                checked={settings.maintenanceMode}
                onCheckedChange={() => handleToggle("maintenanceMode")}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="text-right">
            <Button
              type="submit"
              disabled={saving}
              className="min-w-32 justify-center"
            >
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </StageCenter>
  );
}
