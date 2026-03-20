"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type CmsUserInfo = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const STORAGE_KEY = "cmsUser";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

export default function CmsUserPanel() {
  const [user, setUser] = useState<CmsUserInfo | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CmsUserInfo;
      setUser(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const initials = useMemo(() => (user?.name ? getInitials(user.name) : "??"), [user]);

  async function handleLogout() {
    try {
      await axios.post("/api/cms/auth/logout", null, { withCredentials: true });
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/cms";
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-dashed border-[#d9c9b8] bg-white/70 p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#8d5a2b]">
        <span>User</span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[#e6d3bf] px-3 py-1 text-[10px] font-semibold text-[#8d5a2b] transition hover:border-[#bda48b] hover:bg-[#fbf2e6] hover:text-[#6f421c] active:scale-[0.98]"
        >
          Logout
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1b16] text-sm font-semibold text-white">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1d1b16]">
            {user?.name ?? "Signed in"}
          </p>
          <p className="text-xs text-[#6a5f54]">{user?.role ?? ""}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-[#6a5f54]">
        <span>Last sync</span>
        <span className="font-semibold text-[#1d1b16]">Just now</span>
      </div>
    </div>
  );
}
