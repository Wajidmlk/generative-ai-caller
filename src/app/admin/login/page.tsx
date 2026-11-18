"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Wrong password");
      return;
    }
    router.push("/admin/store");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <div style={{ width: "min(420px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <Link href="/" className="muted">← Home</Link>
          <button className="btn secondary" type="button" onClick={toggle}>
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Admin login</h1>
          <p className="muted">Use ADMIN_PASSWORD from your .env.</p>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
