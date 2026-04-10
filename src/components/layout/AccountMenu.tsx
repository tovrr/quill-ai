"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { authClient } from "@/lib/auth/client";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { Button } from "@/components/ui/button";

type SessionData = {
  user: { id: string; name: string; email: string; image?: string | null } | null;
} | null;

interface AccountMenuProps {
  compact?: boolean;
}

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData>(null);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setSessionStatus("loading");
        const result = await authClient.getSession();
        const data = result?.data;
        if (data?.user) {
          setSession({ user: data.user });
          setSessionStatus("authenticated");
        } else {
          setSession(null);
          setSessionStatus("unauthenticated");
        }
      } catch {
        setSession(null);
        setSessionStatus("unauthenticated");
      }
    };

    void loadSession();
  }, []);

  if (sessionStatus !== "authenticated" || !session?.user) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const userInitial = (session.user.name ?? session.user.email ?? "U")[0].toUpperCase();

  if (compact) {
    // Compact mode: just avatar + dropdown icon
    return (
      <>
        <div className="relative">
          <Button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-2 py-1.5"
            title={`${session.user.name ?? session.user.email}`}
          >
            <div className="w-6 h-6 rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] flex items-center justify-center text-xs font-bold text-white">
              {userInitial}
            </div>
            <ChevronDownIcon className="w-3.5 h-3.5 text-quill-muted" aria-hidden="true" />
          </Button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-quill-border bg-quill-surface shadow-lg z-50">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-quill-border">
                <p className="text-sm font-medium text-quill-text truncate">
                  {session.user.name ?? session.user.email?.split("@")[0] ?? "User"}
                </p>
                <p className="text-[11px] text-quill-muted truncate">{session.user.email}</p>
              </div>

              {/* Actions */}
              <div className="p-1.5 space-y-1">
                <Button
                  onClick={() => {
                    setSettingsOpen(true);
                    setDropdownOpen(false);
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Cog6ToothIcon className="w-4 h-4" aria-hidden="true" />
                  Settings
                </Button>

                <Button
                  onClick={() => {
                    handleSignOut();
                    setDropdownOpen(false);
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-quill-muted hover:text-[#f87171]"
                >
                  <ArrowRightStartOnRectangleIcon className="w-4 h-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Settings modal */}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Close dropdown on settings modal open */}
        {settingsOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
            aria-hidden="true"
          />
        )}
      </>
    );
  }

  // Full mode (for future use): include user card with profile details
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#F87171] to-[#F87171] text-xs font-bold uppercase text-white">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight text-quill-text">
            {session.user.name ?? session.user.email?.split("@")[0] ?? "User"}
          </p>
          <p className="truncate text-[11px] leading-tight text-quill-muted">{session.user.email}</p>
        </div>
        <Button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          variant="ghost"
          size="sm"
          className="shrink-0 p-1.5 text-quill-muted hover:text-quill-text"
        >
          <Cog6ToothIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          onClick={handleSignOut}
          title="Sign out"
          variant="ghost"
          size="sm"
          className="shrink-0 p-1.5 text-quill-muted hover:text-[#f87171]"
        >
          <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
