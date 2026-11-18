"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export default function HomePage() {
  const { theme, toggle } = useTheme();

  return (
    <main>
      <div className="content" style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <strong>Generative AI Caller</strong>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="btn secondary" type="button" onClick={toggle}>
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <Link className="btn" href="/admin/store">Admin</Link>
          </div>
        </div>

        <section style={{ maxWidth: 720, marginBottom: "2.5rem" }}>
          <p className="muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.8rem" }}>
            Phone AI for local stores
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.12, margin: "0.4rem 0 1rem" }}>
            Answer every call in Urdu or English - even when you are busy.
          </h1>
          <p className="muted" style={{ fontSize: "1.05rem", lineHeight: 1.6 }}>
            Configure your store, add products, and let the AI greet callers, answer questions,
            and email you when someone wants an order or a human callback.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
            <Link className="btn" href="/admin/store">Configure store</Link>
            <Link className="btn secondary" href="/admin/products">Manage products</Link>
          </div>
        </section>

        <section className="grid2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Store setup</h3>
            <p className="muted">Hours, address, contact email, default greeting language, and call policies.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Products</h3>
            <p className="muted">Add summaries and details so the AI can answer price and menu questions accurately.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Call logs</h3>
            <p className="muted">Review every conversation and escalation email from one place.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Light & dark</h3>
            <p className="muted">Switch theme anytime from the public page or the admin sidebar.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
