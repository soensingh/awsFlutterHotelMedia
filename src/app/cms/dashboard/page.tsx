const navItems = [
  "Overview",
  "Stories",
  "Calendar",
  "Review Queue",
  "Media Library",
  "Analytics",
  "Settings",
];

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

export default function CmsDashboardPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3f8] text-[#1d1b16]">
      <div className="pointer-events-none absolute inset-0 aurora-bg">
        <div className="aurora-layer bg-[conic-gradient(from_90deg_at_50%_50%,rgba(12,28,48,0.55),rgba(20,52,80,0.5),rgba(9,18,30,0.5),rgba(26,72,98,0.45),rgba(12,28,48,0.55))]" />
        <div className="aurora-layer bg-[linear-gradient(120deg,rgba(10,16,28,0.5),rgba(26,72,98,0.5),rgba(12,28,48,0.5),rgba(20,52,80,0.45))]" />
        <div className="aurora-layer bg-[radial-gradient(ellipse_at_top,rgba(20,52,80,0.5),rgba(20,52,80,0)),radial-gradient(ellipse_at_bottom,rgba(12,28,48,0.5),rgba(12,28,48,0)),radial-gradient(ellipse_at_left,rgba(26,72,98,0.45),rgba(26,72,98,0))]" />
      </div>

      <div className="relative mx-auto flex h-screen w-full max-w-none gap-8 px-10 py-10">
        <aside className="hidden h-[calc(100vh-5rem)] w-80 flex-col justify-between rounded-[28px] border border-white/60 bg-white/70 p-7 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur lg:flex">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">
                Editorial CMS
              </div>
              <img
                src="/images/logo/logo_dark.png"
                alt="Hotelmedia"
                className="h-6 w-auto"
              />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-[#1d1b16]">Control Deck</h2>
            <p className="mt-2 text-sm text-[#6a5f54]">
              Command your publishing pipeline.
            </p>

            <nav className="mt-8 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-[#4a4037] transition hover:bg-white/80"
                >
                  <span>{item}</span>
                  <span className="h-2 w-2 rounded-full bg-[#b46b2f] opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-10 rounded-2xl border border-dashed border-[#d9c9b8] bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d5a2b]">
              User
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1b16] text-sm font-semibold text-white">
                AD
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1d1b16]">Ariana Doyle</p>
                <p className="text-xs text-[#6a5f54]">Senior Editor</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-[#6a5f54]">
              <span>Last sync</span>
              <span className="font-semibold text-[#1d1b16]">2 min ago</span>
            </div>
          </div>
        </aside>

        <div className="flex h-full w-full flex-1 flex-col gap-8 overflow-y-auto pr-2">
          <header className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/70 px-6 py-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">
                Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-semibold">Good evening, Ariana.</h1>
              <p className="mt-1 text-sm text-[#6a5f54]">
                You have 6 approvals waiting and 3 stories due today.
              </p>
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
                    <p className="mt-2 text-sm font-semibold text-[#4a4037]">
                      {card.title}
                    </p>
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
                      <p className="text-sm font-semibold text-[#1d1b16]">
                        {member.name}
                      </p>
                      <p className="text-xs text-[#6a5f54]">{member.role}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#8d5a2b]">Online</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
