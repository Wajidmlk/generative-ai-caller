"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

const links = [
  { href: "/admin/store", label: "Stores" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/calls", label: "Calls" },
  { href: "/", label: "Public site" },
];

type StoreOption = {
  id: string;
  name: string;
  twilioNumber: string;
};

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
  onStoreChange,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onStoreChange?: (storeId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState("");

  const loadStores = useCallback(async () => {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (!res.ok) return;
    const list = (await res.json()) as StoreOption[];
    setStores(list);
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("gai_store_id="))
      ?.split("=")[1];
    const selected = list.find((s) => s.id === cookie)?.id || list[0]?.id || "";
    setStoreId(selected);
    if (selected && selected !== cookie) {
      await fetch("/api/admin/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: selected }),
      });
    }
  }, [router]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  async function selectStore(id: string) {
    setStoreId(id);
    await fetch("/api/admin/stores/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: id }),
    });
    onStoreChange?.(id);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const current = stores.find((s) => s.id === storeId);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "" : "collapsed"}`}>
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>Generative AI Caller</strong>
            <span>Admin</span>
          </div>
        </div>

        <div className="store-switch">
          <label>Active store</label>
          <select
            value={storeId}
            onChange={(e) => selectStore(e.target.value)}
            disabled={!stores.length}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="store-meta">
            {current?.twilioNumber || "No Twilio number set"}
          </div>
        </div>

        <nav className="nav-list" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${isActive(l.href) ? "active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="btn secondary sm"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "Dark theme" : "Light theme"}
          </button>
          <button className="btn ghost sm" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <button
              className="btn secondary sm mobile-toggle"
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                {subtitle || current?.name || "N/A"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
            <div className="seg" aria-label="Theme">
              <button
                type="button"
                className={theme === "light" ? "active" : ""}
                onClick={() => setTheme("light")}
              >
                Light
              </button>
              <button
                type="button"
                className={theme === "dark" ? "active" : ""}
                onClick={() => setTheme("dark")}
              >
                Dark
              </button>
            </div>
            {actions}
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
