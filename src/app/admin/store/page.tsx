"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Modal } from "@/components/Modal";
import { AGENT_VOICES } from "@/lib/voices";

type Policy = {
  id: string;
  intent: string;
  label: string;
  enabled: boolean;
  shareInfo: boolean;
  notifyContact: boolean;
  notes: string;
};

type StoreRow = {
  id: string;
  name: string;
  twilioNumber: string;
  contactEmail: string;
  contactName: string;
  defaultLanguage: string;
  address: string;
  hours: string;
  _count?: { products: number; calls: number };
};

type Store = StoreRow & {
  description: string;
  greetingEn: string;
  greetingUr: string;
  agentVoice: string;
  policies: Policy[];
};

const emptyCreate = {
  name: "",
  contactEmail: "",
  contactName: "",
  twilioNumber: "",
  defaultLanguage: "en",
};

function StoreSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editFromUrl = searchParams.get("edit");

  const [rows, setRows] = useState<StoreRow[]>([]);
  const [create, setCreate] = useState(emptyCreate);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);
  const [msg, setMsg] = useState("");

  const loadRows = useCallback(async () => {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401) {
      router.push("/admin/login");
      return [];
    }
    if (!res.ok) return [];
    const list = (await res.json()) as StoreRow[];
    setRows(list);
    return list;
  }, [router]);

  const openEditor = useCallback(
    async (id: string) => {
      await fetch("/api/admin/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: id }),
      });
      const res = await fetch(`/api/admin/store?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        setMsg("Could not load store settings");
        return;
      }
      setEditing(await res.json());
      setMsg("");
      setDemoMsg("");
      setDemoPlaying(false);
      router.replace(`/admin/store?edit=${encodeURIComponent(id)}`);
    },
    [router],
  );

  function closeEditor() {
    setEditing(null);
    router.replace("/admin/store");
  }

  useEffect(() => {
    (async () => {
      const list = await loadRows();
      if (editFromUrl && list.some((s) => s.id === editFromUrl)) {
        await openEditor(editFromUrl);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!create.name.trim()) {
      setMsg("Store name is required");
      return;
    }
    setCreating(true);
    setMsg("");
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: create.name.trim() }),
    });
    if (!res.ok) {
      setCreating(false);
      setMsg("Could not create store");
      return;
    }
    const store = await res.json();
    await fetch("/api/admin/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: store.id,
        name: create.name.trim(),
        contactEmail: create.contactEmail.trim(),
        contactName: create.contactName.trim(),
        twilioNumber: create.twilioNumber.trim(),
        defaultLanguage: create.defaultLanguage,
      }),
    });
    setCreating(false);
    setCreate(emptyCreate);
    setCreateOpen(false);
    await loadRows();
    await openEditor(store.id);
    setMsg("Store created");
  }

  async function saveEditing(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.error || "Save failed");
      return;
    }
    setEditing(await res.json());
    await loadRows();
    setMsg("Settings saved");
    closeEditor();
  }


  async function playVoiceDemo(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!editing || demoPlaying) return;

    const text =
      editing.defaultLanguage === "ur"
        ? editing.greetingUr || editing.greetingEn
        : editing.greetingEn || editing.greetingUr;
    if (!text.trim()) {
      setDemoMsg("Add a greeting first to preview the voice.");
      return;
    }

    if (demoAudioRef.current) {
      demoAudioRef.current.pause();
      demoAudioRef.current = null;
    }

    setDemoPlaying(true);
    setDemoMsg("Generating demo…");
    try {
      const res = await fetch("/api/admin/voice-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: editing.agentVoice || "alloy",
          language: editing.defaultLanguage,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const err = contentType.includes("json")
          ? await res.json().catch(() => ({}))
          : {};
        throw new Error(err.error || `Demo failed (${res.status})`);
      }
      if (!contentType.includes("audio")) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Server did not return audio. Check OPENAI_API_KEY.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      demoAudioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        if (demoAudioRef.current === audio) demoAudioRef.current = null;
        setDemoPlaying(false);
        setDemoMsg("");
      };
      audio.onended = done;
      audio.onerror = () => {
        done();
        setDemoMsg("Could not play demo audio in the browser.");
      };
      setDemoMsg("Playing…");
      await audio.play();
    } catch (err) {
      setDemoPlaying(false);
      setDemoMsg(err instanceof Error ? err.message : "Voice demo failed");
    }
  }

  return (
    <AdminShell title="Stores" subtitle="Create stores and manage each store’s settings">
      <div className="page-toolbar">
        <div>
          <h2>Your stores</h2>
          <p className="muted">Add a store, then open settings or products.</p>
        </div>
        <div className="page-toolbar-actions">
          <button
            className="btn sm"
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setMsg("");
            }}
          >
            Add store
          </button>
        </div>
      </div>

      {msg && <p className="muted" style={{ marginTop: 0 }}>{msg}</p>}

      <section className="card">
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>Twilio</th>
                <th>Contact</th>
                <th>Lang</th>
                <th>Products</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">No stores yet. Click “Add store”.</td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className={editing?.id === s.id ? "selected" : ""}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.twilioNumber || <span className="muted">N/A</span>}</td>
                  <td>
                    <div>{s.contactEmail || <span className="muted">N/A</span>}</div>
                    {s.contactName && (
                      <div className="muted" style={{ fontSize: "0.75rem" }}>{s.contactName}</div>
                    )}
                  </td>
                  <td>{s.defaultLanguage === "ur" ? "Urdu" : "English"}</td>
                  <td>{s._count?.products ?? 0}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button className="btn secondary sm" type="button" onClick={() => openEditor(s.id)}>
                        Settings
                      </button>
                      <Link className="btn sm" href={`/admin/products?storeId=${encodeURIComponent(s.id)}`}>
                        Products
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Add store"
        subtitle="Basic details - you can finish settings after create"
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onCreate}>
          <div className="grid2">
            <label>
              Store name
              <input
                value={create.name}
                onChange={(e) => setCreate({ ...create, name: e.target.value })}
                placeholder="e.g. Downtown Cafe"
                required
                autoFocus
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={create.contactEmail}
                onChange={(e) => setCreate({ ...create, contactEmail: e.target.value })}
                placeholder="owner@example.com"
              />
            </label>
            <label>
              Contact name
              <input
                value={create.contactName}
                onChange={(e) => setCreate({ ...create, contactName: e.target.value })}
              />
            </label>
            <label>
              Twilio number
              <input
                value={create.twilioNumber}
                onChange={(e) => setCreate({ ...create, twilioNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </label>
            <label>
              Default language
              <select
                value={create.defaultLanguage}
                onChange={(e) => setCreate({ ...create, defaultLanguage: e.target.value })}
              >
                <option value="en">English</option>
                <option value="ur">Urdu</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn secondary sm" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn sm" type="submit" disabled={creating}>
              {creating ? "Creating…" : "Add store"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editing}
        title={editing ? `Settings · ${editing.name}` : "Settings"}
        subtitle="Contact, Twilio, language, greetings, and policies"
        wide
        onClose={closeEditor}
      >
        {editing && (
          <form onSubmit={saveEditing}>
            <div className="grid2">
              <label>
                Store name
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label>
                Contact email
                <input
                  type="email"
                  value={editing.contactEmail}
                  onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })}
                />
              </label>
              <label>
                Contact name
                <input
                  value={editing.contactName}
                  onChange={(e) => setEditing({ ...editing, contactName: e.target.value })}
                />
              </label>
              <label>
                Twilio number (saved as E.164)
                <input
                  value={editing.twilioNumber}
                  onChange={(e) => setEditing({ ...editing, twilioNumber: e.target.value })}
                  placeholder="+14155552671"
                />
              </label>
              <label>
                Address
                <input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </label>
              <label>
                Hours
                <input value={editing.hours} onChange={(e) => setEditing({ ...editing, hours: e.target.value })} />
              </label>
            </div>
            <label style={{ marginTop: "0.85rem" }}>
              Description
              <textarea
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>

            <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "0.92rem" }}>Default language</h3>
            <div className="seg">
              <button
                type="button"
                className={editing.defaultLanguage === "en" ? "active" : ""}
                onClick={() => setEditing({ ...editing, defaultLanguage: "en" })}
              >
                English
              </button>
              <button
                type="button"
                className={editing.defaultLanguage === "ur" ? "active" : ""}
                onClick={() => setEditing({ ...editing, defaultLanguage: "ur" })}
              >
                Urdu
              </button>
            </div>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <label>
                Greeting (English)
                <textarea
                  rows={2}
                  value={editing.greetingEn}
                  onChange={(e) => setEditing({ ...editing, greetingEn: e.target.value })}
                />
              </label>
              <label>
                Greeting (Urdu)
                <textarea
                  rows={2}
                  value={editing.greetingUr}
                  onChange={(e) => setEditing({ ...editing, greetingUr: e.target.value })}
                />
              </label>
            </div>

            <h3 style={{ margin: "1rem 0 0.35rem", fontSize: "0.92rem" }}>Agent voice</h3>
            <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.8rem" }}>
              Choose the TTS voice for this store, then play a demo using the greeting above.
            </p>
            <label>
              Voice
              <select
                value={editing.agentVoice || "alloy"}
                onChange={(e) => setEditing({ ...editing, agentVoice: e.target.value })}
              >
                {AGENT_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} - {v.hint}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: "0.75rem" }}>
              <button
                className="btn sm"
                type="button"
                disabled={demoPlaying}
                onClick={playVoiceDemo}
              >
                {demoPlaying ? "Playing…" : "Play voice demo"}
              </button>
            </div>
            {demoMsg && (
              <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
                {demoMsg}
              </p>
            )}

            <h3 style={{ margin: "1rem 0 0.35rem", fontSize: "0.92rem" }}>Call policies</h3>
            <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.8rem" }}>
              Control what the AI may handle on calls, what info it can share, and when it should email your contact person.
            </p>
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Caller request type</th>
                    <th>AI can handle this</th>
                    <th>AI may share store info</th>
                    <th>Email contact person</th>
                  </tr>
                </thead>
                <tbody>
                  {editing.policies.map((pol, i) => (
                    <tr key={pol.id}>
                      <td>
                        <div>{pol.label}</div>
                        <div className="muted" style={{ fontSize: "0.75rem" }}>{pol.intent}</div>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pol.enabled}
                          style={{ width: "auto" }}
                          onChange={(e) => {
                            const policies = [...editing.policies];
                            policies[i] = { ...pol, enabled: e.target.checked };
                            setEditing({ ...editing, policies });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pol.shareInfo}
                          style={{ width: "auto" }}
                          onChange={(e) => {
                            const policies = [...editing.policies];
                            policies[i] = { ...pol, shareInfo: e.target.checked };
                            setEditing({ ...editing, policies });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pol.notifyContact}
                          style={{ width: "auto" }}
                          onChange={(e) => {
                            const policies = [...editing.policies];
                            policies[i] = { ...pol, notifyContact: e.target.checked };
                            setEditing({ ...editing, policies });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <Link className="btn secondary sm" href={`/admin/products?storeId=${encodeURIComponent(editing.id)}`}>
                Products
              </Link>
              <button className="btn secondary sm" type="button" onClick={closeEditor}>
                Cancel
              </button>
              <button className="btn sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AdminShell>
  );
}

export default function StoreSetupPage() {
  return (
    <Suspense fallback={<AdminShell title="Stores" subtitle="Loading…"><p className="muted">Loading…</p></AdminShell>}>
      <StoreSetupInner />
    </Suspense>
  );
}
