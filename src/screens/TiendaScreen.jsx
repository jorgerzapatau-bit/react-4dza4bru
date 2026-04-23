// ─────────────────────────────────────────────
//  src/screens/TiendaScreen.jsx
//
//  Catálogo de productos + Reservas.
//  Tarjetas mejoradas con:
//    · Stock disponible / Reservados / Disponibles
//    · Fecha de próximo arribo
//    · Historial de reservas por producto
// ─────────────────────────────────────────────

import { useState, useMemo, useCallback } from "react";
import { useReservations } from "../hooks/useReservations";

// ── Helpers ──────────────────────────────────
function fmt$(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

// ── Colores status reserva ────────────────────
const STATUS_LABEL = {
  reserved:       { label: "Reservado",     bg: "rgba(167,139,250,.18)", color: "#a78bfa" },
  partially_paid: { label: "Con anticipo",  bg: "rgba(251,191,36,.18)",  color: "#fbbf24" },
  paid:           { label: "Pagado",        bg: "rgba(52,211,153,.18)",  color: "#34d399" },
  delivered:      { label: "Entregado",     bg: "rgba(96,165,250,.18)",  color: "#60a5fa" },
  cancelled:      { label: "Cancelado",     bg: "rgba(248,113,113,.18)", color: "#f87171" },
};

function StatusPill({ status }) {
  const s = STATUS_LABEL[status] || { label: status, bg: "rgba(255,255,255,.1)", color: "#aaa" };
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600,
    }}>{s.label}</span>
  );
}

// ── Stat box pequeño ──────────────────────────
function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,.04)",
      borderRadius: 10, padding: "7px 10px",
      display: "flex", flexDirection: "column", gap: 2,
      border: "1px solid rgba(255,255,255,.06)",
    }}>
      <span style={{ fontSize: 9, color: "var(--text-tertiary, #6b7280)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: color || "var(--text-primary, #fff)" }}>{value}</span>
    </div>
  );
}

// ── ProductCard ───────────────────────────────
function ProductCard({ product, reservations, onApartar, onEdit, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);

  // Reservas activas de este producto
  const activeRes = useMemo(() =>
    reservations.filter(r =>
      r.product_id === product.id &&
      ["reserved", "partially_paid", "paid"].includes(r.status)
    ), [reservations, product.id]);

  const totalReserved = activeRes.reduce((s, r) => s + (r.quantity || 1), 0);
  const stock = product.stock_quantity ?? null;
  const available = stock !== null ? Math.max(0, stock - totalReserved) : null;

  // Próxima llegada: la fecha de expected_arrival_date más próxima entre reservas pendientes
  const nextArrival = useMemo(() => {
    const dates = reservations
      .filter(r => r.product_id === product.id && r.expected_arrival_date && ["reserved", "partially_paid"].includes(r.status))
      .map(r => r.expected_arrival_date)
      .sort();
    return dates[0] || null;
  }, [reservations, product.id]);

  // Todas las reservas del producto (historial)
  const allRes = useMemo(() =>
    reservations.filter(r => r.product_id === product.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  , [reservations, product.id]);

  const isActive = product.is_active !== false;

  return (
    <div style={{
      background: "var(--bg-card, #1a1a2e)",
      border: `1px solid ${isActive ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.04)"}`,
      borderRadius: 18,
      overflow: "hidden",
      opacity: isActive ? 1 : 0.55,
      display: "flex", flexDirection: "column",
      transition: "opacity .2s",
    }}>

      {/* Imagen */}
      {product.image_url ? (
        <div style={{ position: "relative", height: 180, background: "#0f0f1a", overflow: "hidden" }}>
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Badges sobre imagen */}
          <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {product.is_reservable && (
              <span style={{ background: "rgba(124,58,237,.75)", color: "#ede9fe", borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                🚀 Reservable
              </span>
            )}
            {product.min_deposit_amount > 0 && (
              <span style={{ background: "rgba(180,83,9,.75)", color: "#fde68a", borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                💰 Anticipo {fmt$(product.min_deposit_amount)}
              </span>
            )}
            {product.lead_time_days > 0 && (
              <span style={{ background: "rgba(6,95,70,.75)", color: "#a7f3d0", borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                🕐 {product.lead_time_days}d entrega
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ height: 100, background: "rgba(255,255,255,.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 36, opacity: .3 }}>📦</span>
        </div>
      )}

      {/* Cuerpo */}
      <div style={{ padding: "14px 14px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Nombre + precio */}
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary, #fff)", margin: 0 }}>{product.name}</p>
          {product.description && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary, #9ca3af)", margin: "2px 0 0" }}>{product.description}</p>
          )}
          <p style={{ fontSize: 22, fontWeight: 700, color: "#34d399", margin: "6px 0 0" }}>{fmt$(product.public_price)}</p>
        </div>

        {/* Separador */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.07)" }} />

        {/* Stats: Stock / Reservados / Disponibles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <StatBox
            label="En stock"
            value={stock !== null ? stock : "—"}
            color={stock === null ? "#6b7280" : stock > 5 ? "#34d399" : stock > 0 ? "#fbbf24" : "#f87171"}
          />
          <StatBox
            label="Reservados"
            value={totalReserved}
            color={totalReserved > 0 ? "#fbbf24" : "#6b7280"}
          />
          <StatBox
            label="Disponibles"
            value={available !== null ? available : "—"}
            color={available === null ? "#6b7280" : available > 0 ? "#60a5fa" : "#f87171"}
          />
        </div>

        {/* Próximo arribo */}
        {nextArrival ? (
          <div style={{
            background: "rgba(251,191,36,.08)",
            border: "1px solid rgba(251,191,36,.20)",
            borderRadius: 10, padding: "8px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Próximo arribo</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>📅 {fmtDate(nextArrival)}</span>
          </div>
        ) : product.is_reservable ? (
          <div style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 10, padding: "8px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Próximo arribo</span>
            <span style={{ fontSize: 12, color: "#4b5563" }}>Sin fecha definida</span>
          </div>
        ) : null}

        {/* Botones acción */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          {product.is_reservable && isActive && (
            <button
              onClick={() => onApartar(product)}
              style={{
                flex: 1, background: "linear-gradient(135deg,#7c3aed,#5b21b6)",
                color: "#fff", border: "none", borderRadius: 12,
                padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              🚀 Apartar
            </button>
          )}

          <button
            onClick={() => onEdit(product)}
            style={{
              width: 40, height: 40, background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.10)", borderRadius: 10,
              color: "#9ca3af", fontSize: 16, cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Editar"
          >✏️</button>

          <button
            onClick={() => onToggleActive(product.id, !isActive)}
            style={{
              width: 40, height: 40, background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.10)", borderRadius: 10,
              color: isActive ? "#9ca3af" : "#34d399", fontSize: 16, cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title={isActive ? "Pausar" : "Activar"}
          >{isActive ? "⏸" : "▶️"}</button>

          {allRes.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                width: 40, height: 40, background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.10)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
              }}
              title="Ver reservas"
            >{expanded ? "▲" : `${allRes.length}`}</button>
          )}
        </div>

        {/* Reservas expandidas */}
        {expanded && allRes.length > 0 && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 10,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", margin: 0 }}>Reservas</p>
            {allRes.map(r => (
              <div key={r.id} style={{
                background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "7px 10px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary, #fff)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.member_name || r.member_id?.slice(0, 8) || "Cliente"}
                  </p>
                  <p style={{ fontSize: 10, color: "#6b7280", margin: "1px 0 0" }}>
                    {fmtDate(r.created_at?.slice(0, 10))}
                    {r.expected_arrival_date ? ` · llega ${fmtDate(r.expected_arrival_date)}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>×{r.quantity || 1}</span>
                  <StatusPill status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Producto ────────────────────────────
function ProductModal({ product, onClose, onSave }) {
  const isNew = !product?.id;
  const [form, setForm] = useState({
    name:               product?.name || "",
    description:        product?.description || "",
    image_url:          product?.image_url || "",
    public_price:       product?.public_price || "",
    stock_quantity:     product?.stock_quantity ?? "",
    expected_arrival_date: product?.expected_arrival_date || "",
    is_reservable:      product?.is_reservable ?? true,
    min_deposit_amount: product?.min_deposit_amount || "",
    lead_time_days:     product?.lead_time_days ?? "",
    is_active:          product?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.name.trim() || !form.public_price) return;
    setSaving(true);
    try {
      const payload = {
        ...product,
        ...form,
        public_price:       parseFloat(form.public_price) || 0,
        stock_quantity:     form.stock_quantity !== "" ? parseInt(form.stock_quantity) : null,
        min_deposit_amount: form.min_deposit_amount !== "" ? parseFloat(form.min_deposit_amount) : null,
        lead_time_days:     form.lead_time_days !== "" ? parseInt(form.lead_time_days) : 0,
        expected_arrival_date: form.expected_arrival_date || null,
      };
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const S = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    sheet: { background: "var(--bg-base, #13131f)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", padding: "20px 20px 40px" },
    label: { display: "block", fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 },
    inp: { width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
    row: { marginBottom: 14 },
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: 0 }}>{isNew ? "➕ Nuevo producto" : "✏️ Editar producto"}</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 32, height: 32, color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={S.row}>
          <label style={S.label}>Nombre *</label>
          <input style={S.inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Guantes de Karate" />
        </div>

        <div style={S.row}>
          <label style={S.label}>Descripción</label>
          <input style={S.inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descripción breve" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Precio público *</label>
            <input style={S.inp} type="number" value={form.public_price} onChange={e => set("public_price", e.target.value)} placeholder="500" />
          </div>
          <div>
            <label style={S.label}>Stock en inventario</label>
            <input style={S.inp} type="number" value={form.stock_quantity} onChange={e => set("stock_quantity", e.target.value)} placeholder="0" />
          </div>
        </div>

        <div style={S.row}>
          <label style={S.label}>Fecha próximo arribo</label>
          <input style={S.inp} type="date" value={form.expected_arrival_date || ""} onChange={e => set("expected_arrival_date", e.target.value)} />
        </div>

        <div style={S.row}>
          <label style={S.label}>URL de imagen</label>
          <input style={S.inp} value={form.image_url} onChange={e => set("image_url", e.target.value)} placeholder="https://..." />
        </div>

        {/* Toggle reservable */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>Permitir reservas</p>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>Los clientes pueden apartar este producto</p>
          </div>
          <button
            onClick={() => set("is_reservable", !form.is_reservable)}
            style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: form.is_reservable ? "#7c3aed" : "rgba(255,255,255,.1)", position: "relative", transition: "background .2s" }}
          >
            <span style={{ position: "absolute", top: 2, left: form.is_reservable ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
          </button>
        </div>

        {form.is_reservable && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Anticipo mínimo ($)</label>
              <input style={S.inp} type="number" value={form.min_deposit_amount} onChange={e => set("min_deposit_amount", e.target.value)} placeholder="200" />
            </div>
            <div>
              <label style={S.label}>Días de entrega</label>
              <input style={S.inp} type="number" value={form.lead_time_days} onChange={e => set("lead_time_days", e.target.value)} placeholder="2" />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.public_price}
          style={{
            width: "100%", background: saving ? "rgba(124,58,237,.4)" : "linear-gradient(135deg,#7c3aed,#5b21b6)",
            color: "#fff", border: "none", borderRadius: 12, padding: 14,
            fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", marginTop: 6,
          }}
        >
          {saving ? "Guardando…" : isNew ? "Crear producto" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Modal Apartar ─────────────────────────────
function ApartarModal({ product, miembros, onClose, onSave }) {
  const [form, setForm] = useState({
    member_id: "",
    quantity: 1,
    deposit_amount: product?.min_deposit_amount || 0,
    expected_arrival_date: "",
    notes: "",
    payment_method: "Efectivo",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const total = (product?.public_price || 0) * form.quantity;

  async function handleSave() {
    if (!form.member_id) return;
    setSaving(true);
    try {
      await onSave({
        member_id:            form.member_id,
        product_id:           product.id,
        quantity:             parseInt(form.quantity) || 1,
        unit_price:           parseFloat(product.public_price) || 0,
        deposit_amount:       parseFloat(form.deposit_amount) || 0,
        expected_arrival_date: form.expected_arrival_date || null,
        notes:                form.notes || null,
        payment_method:       form.payment_method,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const S = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" },
    sheet: { background: "var(--bg-base, #13131f)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "20px 20px 40px" },
    label: { display: "block", fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 },
    inp: { width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
    row: { marginBottom: 14 },
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: 0 }}>🚀 Apartar: {product?.name}</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 32, height: 32, color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Precio referencia */}
        <div style={{ background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>Precio unitario</span>
          <span style={{ color: "#34d399", fontWeight: 700, fontSize: 15 }}>{fmt$(product?.public_price)}</span>
        </div>

        <div style={S.row}>
          <label style={S.label}>Miembro *</label>
          <select style={S.inp} value={form.member_id} onChange={e => set("member_id", e.target.value)}>
            <option value="">Seleccionar miembro…</option>
            {(miembros || []).map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Cantidad</label>
            <input style={S.inp} type="number" min={1} value={form.quantity} onChange={e => set("quantity", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Total</label>
            <div style={{ ...S.inp, color: "#34d399", fontWeight: 700 }}>{fmt$(total)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Anticipo ($)</label>
            <input style={S.inp} type="number" min={0} value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Forma de pago</label>
            <select style={S.inp} value={form.payment_method} onChange={e => set("payment_method", e.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
            </select>
          </div>
        </div>

        <div style={S.row}>
          <label style={S.label}>Fecha de llegada esperada</label>
          <input style={S.inp} type="date" value={form.expected_arrival_date} onChange={e => set("expected_arrival_date", e.target.value)} min={todayISO()} />
        </div>

        <div style={S.row}>
          <label style={S.label}>Notas</label>
          <input style={S.inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Talla, color, observaciones…" />
        </div>

        {/* Resumen */}
        {parseFloat(form.deposit_amount) > 0 && (
          <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.18)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>Anticipo</span>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>{fmt$(form.deposit_amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>Saldo pendiente</span>
              <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt$(Math.max(0, total - form.deposit_amount))}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !form.member_id}
          style={{
            width: "100%", background: saving ? "rgba(124,58,237,.4)" : "linear-gradient(135deg,#7c3aed,#5b21b6)",
            color: "#fff", border: "none", borderRadius: 12, padding: 14,
            fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Guardando…" : "Confirmar reserva"}
        </button>
      </div>
    </div>
  );
}

// ── Vista Reservas ────────────────────────────
function ReservasView({ reservations, products, miembros, onUpdateStatus }) {
  const [filtroStatus, setFiltroStatus] = useState("activas");

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (filtroStatus === "activas") return ["reserved", "partially_paid"].includes(r.status);
      if (filtroStatus === "pagadas") return r.status === "paid";
      if (filtroStatus === "entregadas") return r.status === "delivered";
      if (filtroStatus === "canceladas") return r.status === "cancelled";
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [reservations, filtroStatus]);

  const FILTERS = [
    { key: "activas",   label: "Activas" },
    { key: "pagadas",   label: "Pagadas" },
    { key: "entregadas",label: "Entregadas" },
    { key: "canceladas",label: "Canceladas" },
    { key: "todas",     label: "Todas" },
  ];

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFiltroStatus(f.key)}
            style={{
              background: filtroStatus === f.key ? "#7c3aed" : "rgba(255,255,255,.06)",
              color: filtroStatus === f.key ? "#fff" : "#9ca3af",
              border: `1px solid ${filtroStatus === f.key ? "#7c3aed" : "rgba(255,255,255,.1)"}`,
              borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#4b5563" }}>
          <p style={{ fontSize: 32, margin: "0 0 8px" }}>🚀</p>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Sin reservas {filtroStatus}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(r => {
            const prod = products.find(p => p.id === r.product_id);
            const miembro = miembros?.find(m => m.id === r.member_id);
            const balance = parseFloat(r.balance_due || 0);
            return (
              <div key={r.id} style={{
                background: "var(--bg-card, #1a1a2e)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* Imagen mini */}
                {prod?.image_url ? (
                  <img src={prod.image_url} alt={prod?.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>📦</div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{prod?.name || "Producto"}</p>
                    <StatusPill status={r.status} />
                  </div>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                    {miembro?.nombre || "—"} · ×{r.quantity || 1} · {fmt$(r.total_amount)}
                    {r.expected_arrival_date ? ` · 📅 ${fmtDate(r.expected_arrival_date)}` : ""}
                  </p>
                  {balance > 0 && (
                    <p style={{ fontSize: 11, color: "#fbbf24", margin: "2px 0 0" }}>Saldo: {fmt$(balance)}</p>
                  )}
                </div>

                {/* Acciones rápidas */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {r.status === "reserved" && (
                    <button onClick={() => onUpdateStatus(r.id, "partially_paid")}
                      style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Anticipo
                    </button>
                  )}
                  {["reserved", "partially_paid"].includes(r.status) && (
                    <button onClick={() => onUpdateStatus(r.id, "paid")}
                      style={{ background: "rgba(52,211,153,.15)", color: "#34d399", border: "1px solid rgba(52,211,153,.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Pagado
                    </button>
                  )}
                  {r.status === "paid" && (
                    <button onClick={() => onUpdateStatus(r.id, "delivered")}
                      style={{ background: "rgba(96,165,250,.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Entregar
                    </button>
                  )}
                  {["reserved", "partially_paid"].includes(r.status) && (
                    <button onClick={() => onUpdateStatus(r.id, "cancelled")}
                      style={{ background: "rgba(248,113,113,.10)", color: "#f87171", border: "1px solid rgba(248,113,113,.25)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TiendaScreen principal ────────────────────
export default function TiendaScreen({ gymId, miembros, onBack }) {
  const {
    products, reservations, loading, error,
    saveProduct, deleteProduct, toggleProductActive,
    createReservation, updateReservationStatus,
    reload,
  } = useReservations(gymId);

  const [tab, setTab] = useState(0); // 0=Catálogo, 1=Reservas
  const [busqueda, setBusqueda] = useState("");
  const [modalProducto, setModalProducto] = useState(null); // null | product | {}
  const [modalApartar, setModalApartar] = useState(null);   // null | product

  // Stats resumen
  const stats = useMemo(() => {
    const activos = products.filter(p => p.is_active).length;
    const criticos = products.filter(p => {
      const stock = p.stock_quantity;
      if (stock === null || stock === undefined) return false;
      const reserved = reservations.filter(r => r.product_id === p.id && ["reserved", "partially_paid", "paid"].includes(r.status)).reduce((s, r) => s + (r.quantity || 1), 0);
      return (stock - reserved) <= 2;
    }).length;
    const valorInv = products.reduce((s, p) => s + (parseFloat(p.public_price) || 0) * (p.stock_quantity || 0), 0);
    const resActivas = reservations.filter(r => ["reserved", "partially_paid"].includes(r.status)).length;
    return { activos, criticos, valorInv, resActivas };
  }, [products, reservations]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  }, [products, busqueda]);

  const TABS = ["📦 Catálogo", "🚀 Reservas"];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#9ca3af" }}>
      <p>Cargando tienda…</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-base, #13131f)", overflowX: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: "14px 16px 0", borderBottom: "1px solid rgba(255,255,255,.08)", background: "var(--bg-base, #13131f)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>🛍️ Tienda & Reservas</h1>
            <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>Catálogo de productos y apartados</p>
          </div>
          {tab === 0 && (
            <button
              onClick={() => setModalProducto({})}
              style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
            >+ Producto</button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              style={{
                background: tab === i ? "linear-gradient(135deg,#7c3aed,#9333ea)" : "rgba(255,255,255,.05)",
                color: tab === i ? "#fff" : "#9ca3af",
                border: `1px solid ${tab === i ? "#7c3aed" : "rgba(255,255,255,.1)"}`,
                borderRadius: 12, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 40px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { icon: "📦", label: "PRODUCTOS ACTIVOS", value: stats.activos, color: "#a78bfa" },
            { icon: "⚠️", label: "STOCK CRÍTICO",      value: stats.criticos, color: stats.criticos > 0 ? "#fbbf24" : "#34d399" },
            { icon: "💰", label: "VALOR INVENTARIO",   value: fmt$(stats.valorInv), color: "#34d399" },
            { icon: "🚀", label: "RESERVAS ACTIVAS",   value: stats.resActivas, color: stats.resActivas > 0 ? "#60a5fa" : "#6b7280" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--bg-card, #1a1a2e)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 4px" }}>{s.icon} {s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tab Catálogo ── */}
        {tab === 0 && (
          <>
            {/* Búsqueda */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: .4 }}>🔍</span>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar producto…"
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, padding: "10px 12px 10px 36px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 13 }}>
                Error: {error}
              </div>
            )}

            {productosFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>📦</p>
                <p style={{ color: "#9ca3af", fontSize: 15, fontWeight: 600 }}>Sin productos{busqueda ? " encontrados" : ""}</p>
                {!busqueda && (
                  <button onClick={() => setModalProducto({})} style={{ marginTop: 12, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    + Agregar primer producto
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {productosFiltrados.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    reservations={reservations}
                    onApartar={setModalApartar}
                    onEdit={setModalProducto}
                    onToggleActive={toggleProductActive}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tab Reservas ── */}
        {tab === 1 && (
          <ReservasView
            reservations={reservations}
            products={products}
            miembros={miembros}
            onUpdateStatus={updateReservationStatus}
          />
        )}
      </div>

      {/* ── Modales ── */}
      {modalProducto !== null && (
        <ProductModal
          product={modalProducto?.id ? modalProducto : null}
          onClose={() => setModalProducto(null)}
          onSave={saveProduct}
        />
      )}

      {modalApartar && (
        <ApartarModal
          product={modalApartar}
          miembros={miembros}
          onClose={() => setModalApartar(null)}
          onSave={createReservation}
        />
      )}
    </div>
  );
}
