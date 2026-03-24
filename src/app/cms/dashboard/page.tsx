import { getCmsSession } from "@/lib/cms/session";

const activityCards = [
  {
    title: "Drafts awaiting review",
    value: "24",
    detail: "8 updated today",
  },
  {
    title: "Scheduled releases",
    value: "13",
    detail: "Next drop in 2 hrs",
  },
  {
    title: "Editors online",
    value: "7",
    detail: "2 in approvals",
  },
];

export const metadata = {
  title: "CMS Dashboard",
};

export default async function CmsDashboardPage() {
  const session = await getCmsSession();

  return (
    <>
      <header className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/70 px-6 py-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold">Good evening, {session?.name ?? "Editor"}.</h1>
          <p className="mt-1 text-sm text-[#6a5f54]">You have 6 updates pending and 3 editorial tasks due today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-[#1d1b16] shadow-sm"
          >
            Export
          </button>
          <button
            type="button"
            className="rounded-2xl bg-[#1d1b16] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#1d1b16]/25"
          >
            New Story
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Today at a glance</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {activityCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
              >
                <p className="text-2xl font-semibold text-[#1d1b16]">{card.value}</p>
                <p className="mt-2 text-sm font-semibold text-[#4a4037]">{card.title}</p>
                <p className="mt-1 text-xs text-[#6a5f54]">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Approval queue</h2>
          <div className="mt-5 space-y-4">
            {[
              "Luxury Suite Revamp",
              "Summer Campaign Shoot",
              "Dining Experience Refresh",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm"
              >
                <div>
                  <p className="font-semibold text-[#1d1b16]">{item}</p>
                  <p className="text-xs text-[#6a5f54]">Due today</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-[#1d1b16] px-4 py-1 text-xs font-semibold text-white"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Publishing calendar</h2>
          <div className="mt-5 space-y-3">
            {[
              "11:00 AM · Resort spotlight newsletter",
              "02:30 PM · Photo gallery approval",
              "04:45 PM · Social release batch",
            ].map((slot) => (
              <div
                key={slot}
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm"
              >
                <span className="font-medium text-[#4a4037]">{slot}</span>
                <span className="text-xs text-[#6a5f54]">In progress</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Team pulse</h2>
          <div className="mt-4 space-y-4">
            {[
              { name: "Noah King", role: "Content Strategist" },
              { name: "Lea Santos", role: "Copy Lead" },
              { name: "Hana Ryu", role: "Visual Editor" },
            ].map((member) => (
              <div
                key={member.name}
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1d1b16]">{member.name}</p>
                  <p className="text-xs text-[#6a5f54]">{member.role}</p>
                </div>
                <span className="text-xs font-semibold text-[#8d5a2b]">Online</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
