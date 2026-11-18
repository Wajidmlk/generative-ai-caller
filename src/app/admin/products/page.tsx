"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Modal } from "@/components/Modal";

type StoreOption = {
  id: string;
  name: string;
  twilioNumber: string;
  _count?: { products: number };
};

type Product = {
  id: string;
  name: string;
  summary: string;
  description: string;
  price: string;
  quality: string;
  available: boolean;
};

const emptyForm = {
  name: "",
  summary: "",
  description: "",
  price: "",
  quality: "standard",
  available: true,
};

function ProductsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeIdParam = searchParams.get("storeId") || "";

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState(storeIdParam);
  const [storeName, setStoreName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

  const loadStores = useCallback(async () => {
    const res = await fetch("/api/admin/stores");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (!res.ok) return;
    setStores(await res.json());
  }, [router]);

  const loadProducts = useCallback(
    async (id: string) => {
      if (!id) {
        setProducts([]);
        setStoreName("");
        return;
      }
      await fetch("/api/admin/stores/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: id }),
      });
      const res = await fetch(`/api/admin/products?storeId=${encodeURIComponent(id)}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setStoreId(data.storeId);
      setStoreName(data.storeName || "");
      setProducts(data.products || []);
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      await loadStores();
      if (storeIdParam) {
        setStoreId(storeIdParam);
        await loadProducts(storeIdParam);
      }
      setReady(true);
    })();
  }, [loadStores, loadProducts, storeIdParam]);

  async function chooseStore(id: string) {
    setStoreId(id);
    setMsg("");
    setModalOpen(false);
    setEditingId(null);
    router.replace(`/admin/products?storeId=${encodeURIComponent(id)}`);
    await loadProducts(id);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
    setMsg("");
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      summary: p.summary || "",
      description: p.description || "",
      price: p.price || "",
      quality: p.quality || "standard",
      available: p.available,
    });
    setModalOpen(true);
    setMsg("");
  }

  async function persist(nextProducts: unknown[]) {
    const res = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, products: nextProducts }),
    });
    if (!res.ok) throw new Error("save failed");
    const data = await res.json();
    setProducts(data.products || []);
    return data;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    if (!form.name.trim()) {
      setMsg("Product name is required");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      if (editingId) {
        await persist([
          {
            id: editingId,
            name: form.name.trim(),
            summary: form.summary.trim(),
            description: form.description.trim(),
            price: form.price.trim(),
            quality: form.quality,
            available: form.available,
          },
        ]);
        setMsg("Product updated");
      } else {
        await persist([
          {
            name: form.name.trim(),
            summary: form.summary.trim(),
            description: form.description.trim(),
            price: form.price.trim(),
            quality: form.quality,
            available: form.available,
          },
        ]);
        setMsg("Product added");
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadStores();
    } catch {
      setMsg(editingId ? "Update failed" : "Could not add product");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: string) {
    if (!window.confirm("Remove this product?")) return;
    setMsg("");
    try {
      await persist([{ id, _delete: true }]);
      setMsg("Product removed");
      await loadStores();
    } catch {
      setMsg("Remove failed");
    }
  }

  return (
    <AdminShell
      title="Products"
      subtitle={storeName ? `Catalog for ${storeName}` : "Select a store to manage products"}
    >
      <div className="page-toolbar">
        <div>
          <h2>{storeName ? `Products · ${storeName}` : "Products"}</h2>
          <p className="muted">
            {storeId ? "Add or edit products for the selected store." : "Select a store below, then add products."}
          </p>
        </div>
        <div className="page-toolbar-actions">
          {storeId && (
            <>
              <Link className="btn secondary sm" href={`/admin/store?edit=${encodeURIComponent(storeId)}`}>
                Store settings
              </Link>
              <button className="btn sm" type="button" onClick={openAdd}>
                Add product
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <p className="muted" style={{ marginTop: 0 }}>{msg}</p>}

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Select store</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Choose a store, or open Products from the Stores table.
        </p>
        {!ready ? (
          <p className="muted">Loading stores…</p>
        ) : stores.length === 0 ? (
          <p className="muted">
            No stores yet. <Link href="/admin/store">Create a store first</Link>.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Twilio</th>
                  <th>Products</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className={storeId === s.id ? "selected" : ""}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.twilioNumber || <span className="muted">N/A</span>}</td>
                    <td>{s._count?.products ?? "N/A"}</td>
                    <td>
                      <button
                        className={`btn sm ${storeId === s.id ? "" : "secondary"}`}
                        type="button"
                        onClick={() => chooseStore(s.id)}
                      >
                        {storeId === s.id ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!storeId ? (
        <section className="card muted">Select a store above to manage products.</section>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Quality</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">No products yet. Click “Add product”.</td>
                  </tr>
                )}
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.description && (
                        <div className="muted" style={{ fontSize: "0.75rem", maxWidth: 220 }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td>{p.price || "N/A"}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.quality || "standard"}</td>
                    <td>
                      <span className={`badge ${p.available ? "ok" : "off"}`}>
                        {p.available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="muted" style={{ maxWidth: 220 }}>
                      {p.summary || "N/A"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button className="btn secondary sm" type="button" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button className="btn danger sm" type="button" onClick={() => removeProduct(p.id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? "Edit product" : "Add product"}
        subtitle={storeName ? `Store: ${storeName}` : undefined}
        onClose={() => { setModalOpen(false); setEditingId(null); }}
      >
        <form onSubmit={onSubmit}>
          <div className="grid2">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Chai"
                required
                autoFocus
              />
            </label>
            <label>
              Price
              <input
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="e.g. 150 PKR"
              />
            </label>
            <label>
              Quality
              <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })}>
                <option value="premium">Premium</option>
                <option value="standard">Standard</option>
                <option value="basic">Basic</option>
              </select>
            </label>
            <label>
              Availability
              <select
                value={form.available ? "available" : "unavailable"}
                onChange={(e) => setForm({ ...form, available: e.target.value === "available" })}
              >
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Short summary
              <input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="One line the AI can speak"
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Details
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Extra details, variants, notes"
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              className="btn secondary sm"
              type="button"
              onClick={() => { setModalOpen(false); setEditingId(null); }}
            >
              Cancel
            </button>
            <button className="btn sm" type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<AdminShell title="Products" subtitle="Loading…"><p className="muted">Loading…</p></AdminShell>}>
      <ProductsInner />
    </Suspense>
  );
}
