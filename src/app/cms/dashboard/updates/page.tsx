"use client";

import { useEffect, useMemo, useState } from "react";

type UpdateItem = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "rolled-out";
  time: string;
  updatedAt: string;
  isRolledOut: boolean;
  isInBeta: boolean;
  betaStatus: "draft" | "rolled-out" | "rolled-back";
  betaRolledOutAt: string | null;
  liveStatus: "draft" | "rolled-out" | "rolled-back";
  liveRolledOutAt: string | null;
};

type UpdateAction = "rollback" | "rolloutBeta" | "rolloutUpdate" | "delete";

export default function UpdatesDashboardPage() {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [expandedId, setExpandedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<{ id: string; action: UpdateAction } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUpdates() {
      try {
        const res = await fetch("/api/cms/updates", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to load updates");
        }

        if (mounted) {
          const list = (data?.updates as UpdateItem[]) ?? [];
          setUpdates(list);
          setExpandedId(list[0]?.id ?? "");
        }
      } catch (error: any) {
        if (mounted) {
          setErrorMessage(error?.message ?? "Failed to load updates");
        }
      }
    }

    loadUpdates();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreateUpdate() {
    setErrorMessage("");

    if (name.trim().length < 3) {
      setErrorMessage("Update name must be at least 3 characters");
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch("/api/cms/updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create update");
      }

      const created = data?.update as UpdateItem;
      if (created) {
        setUpdates((prev) => [created, ...prev]);
        setExpandedId(created.id);
      }

      setName("");
      setDescription("");
      setShowCreate(false);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Failed to create update");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateAction(item: UpdateItem, action: UpdateAction) {
    setErrorMessage("");
    setActionLoading({ id: item.id, action });

    try {
      const endpoint = `/api/cms/updates/${item.id}/${action}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Action failed");
      }

      const updated = data?.update as UpdateItem;
      if (updated) {
        setUpdates((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteFromHistory(item: UpdateItem) {
    const confirmed = window.confirm(
      "Delete from history? This action is permanent and updates cannot be rolled back after deletion."
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setActionLoading({ id: item.id, action: "delete" });

    try {
      const res = await fetch(`/api/cms/updates/${item.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Delete failed");
      }

      setUpdates((prev) => {
        const next = prev.filter((entry) => entry.id !== item.id);

        setExpandedId((current) => {
          if (current !== item.id) return current;
          return next[0]?.id ?? "";
        });

        return next;
      });
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Delete failed");
    } finally {
      setActionLoading(null);
    }
  }

  const sortedUpdates = useMemo(
    () =>
      [...updates].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [updates]
  );

  return (
    <>
      <header className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/70 px-6 py-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">Updates</p>
          <h1 className="mt-2 text-2xl font-semibold">Release control room</h1>
          <p className="mt-1 text-sm text-[#6a5f54]">Create updates and manage rollout decisions from one place.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErrorMessage("");
            setShowCreate((prev) => !prev);
          }}
          className="rounded-2xl bg-[#1d1b16] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#1d1b16]/25"
        >
          + Update
        </button>
      </header>

      {showCreate ? (
        <section className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Create update</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
              Update name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Homepage spring refresh"
                className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
              />
            </label>

            <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What changed in this update?"
                rows={3}
                className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
              />
            </label>
          </div>

          {errorMessage ? <p className="mt-3 text-sm font-semibold text-[#b23a3a]">{errorMessage}</p> : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-[#e6d3bf] bg-white px-4 py-2 text-sm font-semibold text-[#6f421c]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateUpdate}
              disabled={isCreating}
              className="rounded-xl bg-[#1d1b16] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
            >
              {isCreating ? "Creating..." : "Create update"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
        <h2 className="text-lg font-semibold">Update list</h2>
        <p className="mt-1 text-xs text-[#6a5f54]">Sorted by most recent update.</p>

        {!sortedUpdates.length ? (
          <p className="mt-4 text-sm text-[#6a5f54]">No updates yet. Create your first update.</p>
        ) : null}

        <div className="mt-5 space-y-3">
          {sortedUpdates.map((item) => {
            const isExpanded = item.id === expandedId;
            const betaReady = item.betaStatus === "rolled-out";
            const liveReady = item.liveStatus === "rolled-out";
            const liveFinalized = item.liveStatus === "rolled-out";

            const rollbackLabel = liveReady ? "Rollback update" : "Rollback beta";
            const rollbackDisabled = !(betaReady || liveReady);

            const rolloutLabel = betaReady ? "Roll out update" : "Roll out beta";

            const rolloutAction: UpdateAction = betaReady ? "rolloutUpdate" : "rolloutBeta";

            const rolloutDisabled = liveFinalized;

            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  isExpanded
                    ? "border-[#b46b2f] bg-[#fff4e7]"
                    : "border-white/70 bg-white/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === item.id ? "" : item.id))}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#1d1b16]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#6a5f54]">{item.summary}</p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d5a2b]">
                        {item.status} · {item.time}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#8d5a2b]">{isExpanded ? "Hide" : "Open"}</span>
                  </div>
                </button>

                <div
                  className={`overflow-hidden border-t border-[#ecd9c4] bg-white/90 px-4 transition-all duration-300 ease-in-out ${
                    isExpanded ? "max-h-60 py-4 opacity-100" : "max-h-0 py-0 opacity-0"
                  }`}
                >
                  <h3 className="text-sm font-semibold text-[#1d1b16]">Update actions</h3>
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateAction(item, "rollback")}
                      disabled={rollbackDisabled || Boolean(actionLoading)}
                      className="rounded-xl border border-[#e0c0a0] bg-[#fff4e7] px-3 py-2 text-sm font-semibold text-[#8d5a2b] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {actionLoading?.id === item.id && actionLoading.action === "rollback"
                        ? "Working..."
                        : rollbackLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateAction(item, rolloutAction)}
                      disabled={rolloutDisabled || Boolean(actionLoading)}
                      className="rounded-xl bg-[#1d1b16] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {actionLoading?.id === item.id && actionLoading.action === rolloutAction
                        ? "Working..."
                        : rolloutLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFromHistory(item)}
                      disabled={Boolean(actionLoading)}
                      className="rounded-xl border border-[#f0c8c8] bg-[#fff3f3] px-3 py-2 text-sm font-semibold text-[#b23a3a]"
                    >
                      {actionLoading?.id === item.id && actionLoading.action === "delete"
                        ? "Deleting..."
                        : "Delete from history"}
                    </button>

                    <div className="min-w-[240px] flex-1 rounded-xl border border-white/70 bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                        Action note
                      </p>
                      <p className="mt-1 text-xs text-[#6a5f54]">
                        Choose an action to continue with this update workflow.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
