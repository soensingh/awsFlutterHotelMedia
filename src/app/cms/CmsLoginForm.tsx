"use client";

import { useState } from "react";
import axios from "axios";

export default function CmsLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { data } = await axios.post(
        "/api/cms/auth/login",
        { email, password },
        { withCredentials: true }
      );

      if (data?.user) {
        localStorage.setItem("cmsUser", JSON.stringify(data.user));
      }

      window.location.href = "/cms/dashboard";
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Login failed");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-[#4a4037]">
        Work email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@publisher.com"
          className="mt-2 w-full rounded-2xl border border-[#e6d3bf] bg-white px-4 py-3 text-sm shadow-sm focus:border-[#b46b2f] focus:outline-none focus:ring-2 focus:ring-[#b46b2f]/30"
        />
      </label>
      <label className="block text-sm font-medium text-[#4a4037]">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-2 w-full rounded-2xl border border-[#e6d3bf] bg-white px-4 py-3 text-sm shadow-sm focus:border-[#2f4858] focus:outline-none focus:ring-2 focus:ring-[#2f4858]/30"
        />
      </label>
      <div className="flex items-center justify-end text-xs text-[#6a5f54]">
        <a className="font-semibold text-[#8d5a2b]" href="#">
          Reset password
        </a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-2xl bg-[#1d1b16] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1d1b16]/30 transition hover:-translate-y-0.5 hover:bg-[#2b2720] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Enter CMS"}
      </button>
    </form>
  );
}
