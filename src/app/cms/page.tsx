export const metadata = {
  title: "CMS Hotel Media",
};

export default function CmsLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3f8] text-[#1d1b16]">
      <div className="pointer-events-none absolute inset-0 aurora-bg">
        <div className="aurora-layer bg-[conic-gradient(from_90deg_at_50%_50%,rgba(12,28,48,0.55),rgba(20,52,80,0.5),rgba(9,18,30,0.5),rgba(26,72,98,0.45),rgba(12,28,48,0.55))]" />
        <div className="aurora-layer bg-[linear-gradient(120deg,rgba(10,16,28,0.5),rgba(26,72,98,0.5),rgba(12,28,48,0.5),rgba(20,52,80,0.45))]" />
        <div className="aurora-layer bg-[radial-gradient(ellipse_at_top,rgba(20,52,80,0.5),rgba(20,52,80,0)),radial-gradient(ellipse_at_bottom,rgba(12,28,48,0.5),rgba(12,28,48,0)),radial-gradient(ellipse_at_left,rgba(26,72,98,0.45),rgba(26,72,98,0))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16 lg:flex-row lg:items-center lg:gap-12">
        <section className="flex w-full flex-col justify-center lg:w-1/2">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d7c3ae] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]">
            Editorial CMS
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Publish with clarity.
            <span className="block text-[#b46b2f]">Review with precision.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-[#5a534a]">
            Sign in to curate stories, schedule releases, and keep your content pipeline
            immaculate.
          </p>
          <div className="mt-10 hidden items-center gap-6 text-sm text-[#5a534a] sm:flex">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#b46b2f]" />
              Draft governance
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2f4858]" />
              Multichannel routing
            </div>
          </div>
        </section>

        <section className="mt-10 w-full max-w-md lg:mt-0 lg:w-1/2 lg:self-center">
          <div className="rounded-3xl border border-[#eadccf] bg-white/80 p-8 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.45)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">CMS Login</h2>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#f2e6d8] px-3 py-1 text-xs font-semibold text-[#8d5a2b]">
                  Secure Access
                </span>
                <img
                  src="/images/logo/logo_dark.png"
                  alt="Hotelmedia"
                  className="h-6 w-auto"
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-[#6a5f54]">
              Enter your credentials to reach the editorial console.
            </p>

            <form className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[#4a4037]">
                Work email
                <input
                  type="email"
                  placeholder="name@publisher.com"
                  className="mt-2 w-full rounded-2xl border border-[#e6d3bf] bg-white px-4 py-3 text-sm shadow-sm focus:border-[#b46b2f] focus:outline-none focus:ring-2 focus:ring-[#b46b2f]/30"
                />
              </label>
              <label className="block text-sm font-medium text-[#4a4037]">
                Password
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-2 w-full rounded-2xl border border-[#e6d3bf] bg-white px-4 py-3 text-sm shadow-sm focus:border-[#2f4858] focus:outline-none focus:ring-2 focus:ring-[#2f4858]/30"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-[#6a5f54]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-[#d1c2b1]" />
                  Keep me signed in
                </label>
                <a className="font-semibold text-[#8d5a2b]" href="#">
                  Reset password
                </a>
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-2xl bg-[#1d1b16] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1d1b16]/30 transition hover:-translate-y-0.5 hover:bg-[#2b2720]"
              >
                Enter CMS
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-dashed border-[#d9c9b8] bg-[#fbf7f1] px-4 py-3 text-xs text-[#6b5b4a]">
              Need access? Contact your managing editor to request a secure invite.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
