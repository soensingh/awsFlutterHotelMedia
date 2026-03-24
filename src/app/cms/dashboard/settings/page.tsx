"use client";

import axios from "axios";
import { useEffect, useState } from "react";

type GeneralFormSnapshot = {
  fullName: string;
  email: string;
  timeZone: string;
  locale: string;
};

const settingsSections = [
  {
    heading: "Workspace",
    items: [
      { title: "General", subtitle: "Name, locale, timezone, and branding" },
      { title: "Roles & Access", subtitle: "Editors, reviewers, and admin permissions" },
      { title: "Notifications", subtitle: "Alerts, digests, and rollout reminders" },
      { title: "Integrations", subtitle: "Analytics, storage, and deployment channels" },
    ],
  },
  {
    heading: "Publishing",
    items: [
      { title: "Content Defaults", subtitle: "Default statuses and approval flow" },
      { title: "Update Policies", subtitle: "Rollback, rollout, and scheduling rules" },
      { title: "Media Preferences", subtitle: "Compression and upload behavior" },
    ],
  },
];

export default function SettingsDashboardPage() {
  const [isGeneralOpen, setIsGeneralOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [locale, setLocale] = useState("en");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [initialGeneral, setInitialGeneral] = useState<GeneralFormSnapshot>({
    fullName: "",
    email: "",
    timeZone: "Asia/Kolkata",
    locale: "en",
  });

  useEffect(() => {
    const raw = localStorage.getItem("cmsUser");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        name?: string;
        email?: string;
      };

      setFullName(parsed.name ?? "");
      setEmail(parsed.email ?? "");
      setInitialGeneral((prev) => ({
        ...prev,
        fullName: parsed.name ?? "",
        email: parsed.email ?? "",
      }));
    } catch {
      // Ignore invalid localStorage payload.
    }
  }, []);

  function handleGeneralCancel() {
    setFullName(initialGeneral.fullName);
    setEmail(initialGeneral.email);
    setTimeZone(initialGeneral.timeZone);
    setLocale(initialGeneral.locale);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaveMessage("");
    setIsGeneralOpen(false);
  }

  async function handleGeneralSave() {
    setSaveMessage("");

    if (!fullName.trim()) {
      setSaveMessage("Name is required");
      return;
    }

    if (!email.trim()) {
      setSaveMessage("Email is required");
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveMessage("Fill current, new, and confirm password fields");
        return;
      }

      if (newPassword !== confirmPassword) {
        setSaveMessage("New password and confirm password do not match");
        return;
      }
    }

    try {
      setIsSaving(true);

      await axios.post("/api/cms/profile/changeName", {
        name: fullName,
      });

      const emailRes = await axios.post("/api/cms/profile/changeEmail", {
        email,
      });

      await axios.post("/api/cms/profile/changeTimeZone", {
        timeZone,
      });

      await axios.post("/api/cms/profile/changeLocale", {
        locale,
      });

      if (newPassword && confirmPassword && currentPassword) {
        await axios.post("/api/cms/profile/changePassword", {
          currentPassword,
          newPassword,
        });
      }

      const raw = localStorage.getItem("cmsUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            id: string;
            name: string;
            email: string;
            role: string;
          };

          localStorage.setItem(
            "cmsUser",
            JSON.stringify({
              ...parsed,
              name: fullName.trim(),
              email: emailRes.data?.user?.email ?? email.trim().toLowerCase(),
            })
          );
        } catch {
          // Ignore localStorage parsing errors.
        }
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setInitialGeneral({
        fullName: fullName.trim(),
        email: emailRes.data?.user?.email ?? email.trim().toLowerCase(),
        timeZone,
        locale,
      });
      setSaveMessage("General settings updated successfully");
    } catch (error: any) {
      setSaveMessage(error?.response?.data?.error ?? "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <header className="rounded-[28px] border border-white/60 bg-white/70 px-6 py-5 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8d5a2b]">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold">Workspace settings</h1>
        <p className="mt-1 text-sm text-[#6a5f54]">A phone-style settings list. Functionality can be wired later.</p>
      </header>

      <section className="space-y-6">
        {settingsSections.map((section) => (
          <div
            key={section.heading}
            className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-[0_30px_80px_-40px_rgba(34,21,6,0.35)] backdrop-blur"
          >
            <h2 className="px-2 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d5a2b]">
              {section.heading}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/85">
              {section.items.map((item, index) => (
                <div key={item.title} className={index !== 0 ? "border-t border-[#eee5db]" : ""}>
                  <button
                    type="button"
                    onClick={() => {
                      if (section.heading === "Workspace" && item.title === "General") {
                        setIsGeneralOpen((prev) => !prev);
                      }
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1d1b16]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[#6a5f54]">{item.subtitle}</p>
                    </div>
                    <span className="text-lg leading-none text-[#a68260]">
                      {section.heading === "Workspace" && item.title === "General"
                        ? isGeneralOpen
                          ? "⌄"
                          : "›"
                        : "›"}
                    </span>
                  </button>

                  {section.heading === "Workspace" && item.title === "General" ? (
                    <div
                      aria-hidden={!isGeneralOpen}
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isGeneralOpen
                          ? "max-h-[900px] border-t border-[#eee5db] opacity-100"
                          : "max-h-0 border-t-0 opacity-0"
                      }`}
                    >
                      <div className="bg-[#fcfaf7] px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Full Name
                          <input
                            type="text"
                            placeholder="Amit Kesle"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          />
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Email
                          <input
                            type="email"
                            placeholder="name@thehotelmedia.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          />
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Current Password
                          <input
                            type="password"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          />
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Change Password
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          />
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Confirm Password
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          />
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Timezone
                          <select
                            value={timeZone}
                            onChange={(e) => setTimeZone(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          >
                            <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                            <option value="UTC">UTC (GMT+0)</option>
                            <option value="America/New_York">America/New_York (GMT-5)</option>
                          </select>
                        </label>

                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8d5a2b]">
                          Locale
                          <select
                            value={locale}
                            onChange={(e) => setLocale(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#e6d3bf] bg-white px-3 py-2 text-sm font-medium text-[#1d1b16]"
                          >
                            <option value="en">English</option>
                            <option value="hi">Hindi</option>
                            <option value="ar">Arabic</option>
                          </select>
                        </label>
                      </div>

                      {saveMessage ? (
                        <p className="mt-3 text-xs font-semibold text-[#8d5a2b]">{saveMessage}</p>
                      ) : null}

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleGeneralCancel}
                          className="rounded-xl border border-[#e6d3bf] bg-white px-4 py-2 text-xs font-semibold text-[#6f421c]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleGeneralSave}
                          disabled={isSaving}
                          className="rounded-xl bg-[#1d1b16] px-4 py-2 text-xs font-semibold text-white"
                        >
                          {isSaving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}