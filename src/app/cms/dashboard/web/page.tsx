const webPages = [
  "Homepage",
  "Property detail",
  "Destinations",
  "Offers",
  "Blog",
  "Contact",
];

export default function WebDashboardPage() {
  return (
    <>
      <header className="rounded-[28px] border border-white/60 bg-white/70 px-6 py-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">Web</p>
        <h1 className="mt-2 text-2xl font-semibold">Website section workspace</h1>
        <p className="mt-1 text-sm text-[#6a5f54]">UI-only scaffold for web page management.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[28px] border border-white/60 bg-white/70 p-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8d5a2b]">Web pages</h2>
          <div className="mt-4 space-y-2">
            {webPages.map((page) => (
              <button
                key={page}
                type="button"
                className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-left text-sm font-medium text-[#4a4037] hover:bg-white"
              >
                {page}
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
          <h2 className="text-lg font-semibold">Section preview panel</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {webPages.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-[#1d1b16]">{item}</p>
                <p className="mt-2 text-xs text-[#6a5f54]">
                  Placeholder card. Replace with your real web page modules.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
