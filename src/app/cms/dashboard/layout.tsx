import Link from "next/link";
import { redirect } from "next/navigation";
import { getCmsSession } from "@/lib/cms/session";
import CmsUserPanel from "./CmsUserPanel";

const navItems = [
  { label: "Overview", href: "/cms/dashboard" },
  { label: "Updates", href: "/cms/dashboard/updates" },
  { label: "Mobile", href: "/cms/dashboard/mobile" },
  { label: "Web", href: "/cms/dashboard/web" },
  { label: "Settings", href: "/cms/dashboard/settings" },
];

export default async function CmsDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCmsSession();

  if (!session) {
    redirect("/cms");
  }

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
              <img src="/images/logo/logo_dark.png" alt="Hotelmedia" className="h-6 w-auto" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-[#1d1b16]">Control Deck</h2>
            <p className="mt-2 text-sm text-[#6a5f54]">Command your publishing pipeline.</p>

            <nav className="mt-8 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-[#4a4037] transition hover:bg-white/80"
                >
                  <span>{item.label}</span>
                  <span className="h-2 w-2 rounded-full bg-[#b46b2f] opacity-60" />
                </Link>
              ))}
            </nav>
          </div>

          <CmsUserPanel />
        </aside>

        <div className="flex h-full w-full flex-1 flex-col gap-8 overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  );
}
