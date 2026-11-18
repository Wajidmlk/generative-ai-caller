"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";

type StoreOption = { id: string; name: string };

type Escalation = {
  id: string;
  type: string;
  summary: string;
  emailedTo: string;
  emailedAt: string;
  success: boolean;
  error: string;
};

type CallRow = {
  id: string;
  fromNumber: string;
  status: string;
  language: string;
  summary: string;
  startedAt: string;
  store?: StoreOption;
  escalations: { type: string }[];
};

type CallDetail = {
  id: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  language: string;
  summary: string;
  startedAt: string;
  endedAt?: string | null;
  store?: StoreOption;
  utterances: { id: string; role: string; text: string; createdAt: string }[];
  escalations: Escalation[];
};

export default function CallsPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterStoreId, setFilterStoreId] = useState("all");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [selected, setSelected] = useState<CallDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadStores = useCallback(async () => {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (res.ok) setStores(await res.json());
  }, [router]);

  const load = useCallback(async () => {
    const q = filterStoreId ? `?storeId=${encodeURIComponent(filterStoreId)}` : "";
    const res = await fetch(`/api/admin/calls${q}`);
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (res.ok) {
      setCalls(await res.json());
      setSelected(null);
    }
  }, [router, filterStoreId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    load();
  }, [load]);

  async function openCall(id: string) {
    setLoadingDetail(true);
    const res = await fetch(`/api/admin/calls?id=${encodeURIComponent(id)}`);
    setLoadingDetail(false);
    if (res.ok) setSelected(await res.json());
  }

  return (
    <AdminShell title="Calls" subtitle="Filter and review attended calls">
      <div className="page-toolbar">
        <div>
          <h2>Call history</h2>
          <p className="muted">Filter by store to review transcripts and escalations.</p>
        </div>
        <div className="page-toolbar-actions">
          <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", margin: 0 }}>
            <span className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>Store</span>
            <select
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
              style={{ minWidth: 180, height: 36, padding: "0 10px" }}
            >
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn secondary sm" type="button" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="calls-layout">
        <section className="card calls-panel">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Call list</h2>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Store</th>
                  <th>From</th>
                  <th>Lang</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr
                    key={c.id}
                    className={`clickable ${selected?.id === c.id ? "selected" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => openCall(c.id)}
                  >
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(c.startedAt).toLocaleString()}
                    </td>
                    <td>{c.store?.name || "N/A"}</td>
                    <td>{c.fromNumber}</td>
                    <td>{c.language || "N/A"}</td>
                    <td>
                      <span className={`badge ${c.status === "escalated" ? "warn" : c.status === "completed" ? "ok" : ""}`}>
                        {c.status}
                      </span>
                      {c.escalations?.length > 0 && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          {c.escalations[0].type}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {calls.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No calls for this filter yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card calls-panel">
          {loadingDetail ? (
            <p className="muted">Loading conversation…</p>
          ) : !selected ? (
            <div>
              <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Conversation</h2>
              <p className="muted">Select a call from the list to read the transcript.</p>
            </div>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Conversation</h2>
              <div className="muted" style={{ fontSize: "0.84rem", display: "grid", gap: 4 }}>
                <div>
                  <strong style={{ color: "var(--text)" }}>Store:</strong> {selected.store?.name || "N/A"}
                </div>
                <div>
                  <strong style={{ color: "var(--text)" }}>From:</strong> {selected.fromNumber}
                </div>
                <div>
                  <strong style={{ color: "var(--text)" }}>To:</strong> {selected.toNumber}
                </div>
                <div>
                  <strong style={{ color: "var(--text)" }}>Status:</strong> {selected.status} · {selected.language}
                </div>
                <div>
                  <strong style={{ color: "var(--text)" }}>Started:</strong>{" "}
                  {new Date(selected.startedAt).toLocaleString()}
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.55rem", marginTop: "1rem" }}>
                {selected.utterances.length === 0 && (
                  <p className="muted">No utterances recorded for this call.</p>
                )}
                {selected.utterances.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: "0.65rem 0.75rem",
                      borderRadius: 10,
                      background: u.role === "caller" ? "var(--bg)" : "color-mix(in srgb, var(--accent) 10%, var(--bg))",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div className="muted" style={{ fontSize: "0.72rem", marginBottom: 4, textTransform: "uppercase" }}>
                      {u.role}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{u.text}</div>
                  </div>
                ))}
              </div>

              {selected.escalations?.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--line)" }}>
                  <h3 style={{ margin: "0 0 0.55rem", fontSize: "0.95rem" }}>Escalations</h3>
                  {selected.escalations.map((e) => (
                    <div key={e.id} style={{ marginBottom: "0.65rem" }}>
                      <div>
                        <span className="badge warn">{e.type}</span>{" "}
                        <span className="muted">
                          → {e.emailedTo || "no email"} ({e.success ? "sent" : `failed: ${e.error}`})
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>{e.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
