type DateLike = Date | string | null | undefined;

type UpdateLike = {
  _id: { toString(): string } | string;
  name: string;
  description?: string;
  status: string;
  isRolledOut: boolean;
  isInBeta: boolean;
  updatedAt?: DateLike;
  betaStatus?: string;
  betaRolledOutAt?: DateLike;
  liveStatus?: string;
  liveRolledOutAt?: DateLike;
};

function asDate(input: DateLike): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(input: DateLike): string | null {
  const date = asDate(input);
  return date ? date.toISOString() : null;
}

function toTimeLabel(status: string, updatedAt?: DateLike) {
  const updated = asDate(updatedAt);

  if (status === "rolled-out") {
    return "Rolled out";
  }

  if (updated) {
    return `Edited ${updated.toLocaleString()}`;
  }

  return "Draft";
}

export function toApiUpdate(item: UpdateLike) {
  return {
    id: typeof item._id === "string" ? item._id : item._id.toString(),
    title: item.name,
    summary: item.description ?? "",
    status: item.status as "draft" | "rolled-out",
    isRolledOut: item.isRolledOut,
    isInBeta: item.isInBeta,
    updatedAt: toIso(item.updatedAt) ?? new Date().toISOString(),
    betaStatus: item.betaStatus ?? "draft",
    betaRolledOutAt: toIso(item.betaRolledOutAt),
    liveStatus: item.liveStatus ?? "draft",
    liveRolledOutAt: toIso(item.liveRolledOutAt),
    time: toTimeLabel(item.status, item.updatedAt),
  };
}
