"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface UserProfileProps {
  className?: string;
}

interface UserData {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
}

export function UserProfile({ className }: UserProfileProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  useEffect(() => {
    const getUser = async () => {
      try {
        const session = await authClient.getSession();
        setUser(
          session.data?.user
            ? {
                id: session.data.user.id,
                email: session.data.user.email,
                name: session.data.user.name ?? undefined,
                image: session.data.user.image ?? null,
              }
            : null,
        );
        if (session.data?.user) {
          setFormData({
            name: session.data.user.name || "",
            email: session.data.user.email || "",
          });
        }
      } catch (error) {
        console.error("Failed to get user session:", error);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      setUser(null);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Update user profile
      setLoading(true);
      const result = await authClient.updateUser({
        name: formData.name,
      });

      if (result.error) {
        console.error("Profile update failed:", result.error);
        return;
      }

      setUser({
        ...user,
        name: formData.name,
      });
      setEditMode(false);
    } catch (error) {
      console.error("Profile update error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // User not signed in
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* User Info Display */}
      <div className="flex items-center gap-4">
        {user.image && (
          <Image src={user.image} alt={user.name || "User"} width={48} height={48} className="w-12 h-12 rounded-full" />
        )}
        {!editMode ? (
          <div className="flex-1">
            <h3 className="font-semibold text-quill-text">{user.name || "User"}</h3>
            <p className="text-sm text-quill-muted">{user.email}</p>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="flex-1 space-y-3">
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your name"
              className="rounded-xl border-quill-border bg-quill-surface px-4 py-2.5 text-sm text-quill-text"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-[#EF4444] py-2.5 text-sm font-semibold text-white"
              >
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    name: user.name || "",
                    email: user.email || "",
                  });
                  setEditMode(false);
                }}
                className="rounded-xl border-quill-border px-4 py-2.5 text-sm font-medium text-quill-text"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!editMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(true)}
            className="rounded-xl border-quill-border px-4 py-2.5 text-sm font-medium text-quill-text"
          >
            Edit
          </Button>
        )}
      </div>

      {/* Sign Out Button */}
      <Button
        variant="destructive"
        onClick={handleSignOut}
        className="w-full rounded-xl bg-[#dc2626] hover:bg-[#b91c1c]"
      >
        Sign Out
      </Button>
    </div>
  );
}
