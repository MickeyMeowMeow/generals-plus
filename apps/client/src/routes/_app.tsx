import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";

import { Button } from "#/components/ui/button";
import type { SystemSettings } from "#/features/admin/api/system-settings-api";
import { systemSettingsApi } from "#/features/admin/api/system-settings-api";
import { AuthProvider, useUser } from "#/features/auth/hooks";

function AppShell() {
  const user = useUser();
  const location = useLocation();
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      systemSettingsApi
        .get()
        .then((res) => setSettings(res))
        .catch(() => {});
    };

    fetchSettings();

    // Poll settings every 30 seconds to keep announcement banner and maintenance mode fresh
    const interval = setInterval(fetchSettings, 30000);
    return () => clearInterval(interval);
  }, []);

  const showMaintenance = settings?.maintenanceMode && user && !user.isAdmin;
  const isMainPage = location.pathname === "/";

  if (showMaintenance) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-game-bg p-6 text-center select-none text-game-text">
        <div className="max-w-md border border-red-500/20 bg-game-surface p-8 shadow-xl shadow-black/40">
          <ShieldAlert className="mx-auto mb-4 size-12 text-red-400 animate-bounce" />
          <h1 className="text-xl font-bold text-red-300">
            Server Under Maintenance
          </h1>
          <p className="mt-3 text-sm text-game-text-dim leading-relaxed">
            The server is currently undergoing scheduled maintenance to deploy
            updates or perform server optimization. Please check back in a few
            minutes.
          </p>
          <div className="mt-6">
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="h-9 px-6 bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-game-bg text-game-text">
      {settings?.systemBanner && isMainPage && (
        <div className="bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 text-center text-xs text-amber-300 font-semibold flex items-center justify-center gap-2 select-none shrink-0 z-50">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {settings.systemBanner}
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        <Outlet />
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
