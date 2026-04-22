// ─────────────────────────────────────────────
//  src/screens/TiendaScreen.jsx
//  Módulo: Catálogo de Productos + Reservas / Apartados
// ─────────────────────────────────────────────

import { useState, useMemo, useRef } from "react";
import { useReservations } from "../hooks/useReservations";
import { fmt, todayISO, fmtDate } from "../utils/dateUtils";

// ── Colores y labels por estado ───────────────────────────────────
const STATUS_META = {
  reserved:         { label: "Apartado",          color: "#a78bfa", bg: "rgba(167,139,250,.12)", icon: "🔖" },
  partially_paid:   { label: "Anticipo pagado",   color: "#f59e0b", bg: "rgba(245,158,11,.12)",  icon: "💰" },
  ordered:          { label: "Pedido realizado",  color: "#22d3ee", bg: "rgba(34,211,238,.12)",  icon: "📦" },
  ready_for_pickup: { label: "Listo para entrega",color: "#4ade80", bg: "rgba(74,222,128,.12)",  icon: "✅" },
  delivered:        { label: "Entregado",         color: "#6ee7b7", bg: "rgba(110,231,183,.12)", icon: "🎉" },
  cancelled:        { label: "Cancelado",         color: "#f43f5e", bg: "rgba(244,63,94,.12)",   icon: "❌" },
  refunded:         { label: "Reembolsado",       color: "#8b949e", bg: "rgba(139,148,158,.12)", icon: "↩️" },
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"];

// ── Componente: StatusBadge ───────────────────────────────────────
function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.reserved;
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.color}40`,
      borderRadius: 8, padding: "3px 9px",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Componente: Modal base ────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-card, #1e1e30)",
        border: "1px solid rgba(108,99,255,.2)",
        borderRadius: 20, padding: 20,
        width: "100%", maxWidth: wide ? 640 : 420,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <h2 style={{ color: "var(--text-primary,#fff)", fontSize: 16, fontWeight: 700, flex: 1 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--text-primary,#fff)", fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Componente: Field (label + input) ─────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ color: "#8b949e", fontSize: 10, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "var(--bg-elevated,#13131f)",
  border: "1px solid var(--border-strong,#30363d)",
  borderRadius: 10, padding: "10px 12px",
  color: "var(--text-primary,#fff)", fontSize: 13,
  fontFamily: "inherit", outline: "none",
};

// ── Sub-modal: Nuevo/Editar Producto ─────────────────────────────
function ModalProducto({ product, onSave, onClose }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    name:                product?.name                || "",
    sku:                 product?.sku                 || "",
    category:            product?.category            || "",
    description:         product?.description         || "",
    image_url:           product?.image_url           || "",
    public_price:        product?.public_price        ?? "",
    acquisition_cost:    product?.acquisition_cost    ?? "",
    stock_initial:       product?.stock_initial       ?? "",
    stock_alert_limit:   product?.stock_alert_limit   ?? "",
    is_active:           product?.is_active           ?? true,
    is_reservable:       product?.is_reservable       ?? true,
    min_deposit_amount:  product?.min_deposit_amount  ?? "",
    min_deposit_percent: product?.min_deposit_percent ?? "",
    lead_time_days:      product?.lead_time_days      ?? "",
  });
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [imgMode,     setImgMode]     = useState("url"); // "url" | "upload" | "camera"
  const [cameraActive,setCameraActive]= useState(false);
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const fileInputRef= useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Cámara ──────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setError("No se pudo acceder a la cámara");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    set("image_url", dataUrl);
    stopCamera();
    setImgMode("url");
  };

  // ── Galería / subir archivo ──────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set("image_url", ev.target.result);
      setImgMode("url");
    };
    reader.readAsDataURL(file);
  };

  // ── Cambio de modo imagen ────────────────────────────────────────
  const switchImgMode = (mode) => {
    if (cameraActive) stopCamera();
    setImgMode(mode);
    if (mode === "camera") startCamera();
    if (mode === "upload") setTimeout(() => fileInputRef.current?.click(), 50);
  };

  // cleanup on unmount
  const cleanupRef = useRef(stopCamera);
  cleanupRef.current = stopCamera;
  useState(() => () => cleanupRef.current());

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.public_price || isNaN(Number(form.public_price))) { setError("Precio público inválido"); return; }
    setSaving(true);
    try {
      await onSave({
        ...(isEdit ? { id: product.id } : {}),
        name:                form.name.trim(),
        sku:                 form.sku.trim() || null,
        category:            form.category.trim() || null,
        description:         form.description.trim() || null,
        image_url:           form.image_url.trim() || null,
        public_price:        Number(form.public_price),
        acquisition_cost:    form.acquisition_cost !== "" ? Number(form.acquisition_cost) : null,
        stock_initial:       form.stock_initial !== "" ? Number(form.stock_initial) : null,
        stock_alert_limit:   form.stock_alert_limit !== "" ? Number(form.stock_alert_limit) : null,
        is_active:           form.is_active,
        is_reservable:       form.is_reservable,
        min_deposit_amount:  form.min_deposit_amount !== "" ? Number(form.min_deposit_amount) : null,
        min_deposit_percent: form.min_deposit_percent !== "" ? Number(form.min_deposit_percent) : null,
        lead_time_days:      form.lead_time_days !== "" ? Number(form.lead_time_days) : 0,
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sectionLabel = (txt) => (
    <p style={{ color: "#6c63ff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, marginBottom: 10, marginTop: 6, borderBottom: "1px solid rgba(108,99,255,.15)", paddingBottom: 6 }}>
      {txt}
    </p>
  );

  return (
    <Modal title={isEdit ? "✏️ Editar producto" : "📦 Nuevo producto"} onClose={onClose}>
      {error && (
        <div style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, color: "#f43f5e", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Sección: Información básica ── */}
      {sectionLabel("📋 Información básica")}

      <Field label="Nombre del producto *">
        <input value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} placeholder="Ej: Guantes de Box Everlast" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="SKU / Identificador" hint="Código único del producto">
          <input value={form.sku} onChange={e => set("sku", e.target.value)} style={inputStyle} placeholder="Ej: GBX-001" />
        </Field>
        <Field label="Categoría">
          <input value={form.category} onChange={e => set("category", e.target.value)} style={inputStyle} placeholder="Ej: Equipamiento" />
        </Field>
      </div>

      <Field label="Descripción">
        <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "none" }} placeholder="Características, talla, color..." />
      </Field>

      {/* ── Sección: Imagen ── */}
      {sectionLabel("🖼️ Imagen del producto")}

      {/* Selector de modo imagen */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          { mode: "url",    icon: "🔗", label: "URL" },
          { mode: "upload", icon: "🖼️", label: "Galería" },
          { mode: "camera", icon: "📷", label: "Cámara" },
        ].map(({ mode, icon, label }) => (
          <button key={mode} onClick={() => switchImgMode(mode)} style={{
            flex: 1, padding: "8px 4px", border: "none", borderRadius: 10, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            background: imgMode === mode ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated,#13131f)",
            color: imgMode === mode ? "#fff" : "#8b949e",
            border: imgMode === mode ? "none" : "1px solid var(--border-strong,#30363d)",
            transition: "all .2s",
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Input oculto para archivo */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

      {/* Modo URL */}
      {imgMode === "url" && (
        <Field label="URL de imagen">
          <input value={form.image_url} onChange={e => set("image_url", e.target.value)} style={inputStyle} placeholder="https://..." />
        </Field>
      )}

      {/* Modo cámara */}
      {imgMode === "camera" && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ borderRadius: 12, overflow: "hidden", background: "#000", position: "relative", marginBottom: 8 }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
            {!cameraActive && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#8b949e", fontSize: 12 }}>Iniciando cámara…</p>
              </div>
            )}
          </div>
          {cameraActive && (
            <button onClick={capturePhoto} style={{
              width: "100%", padding: "10px", border: "none", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,#22d3ee,#059669)", color: "#fff",
            }}>
              📸 Tomar foto
            </button>
          )}
        </div>
      )}

      {/* Preview imagen */}
      {form.image_url && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <img src={form.image_url} alt="" onError={e => e.target.style.display = "none"}
            style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12 }} />
          <button onClick={() => set("image_url", "")} style={{
            position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.7)",
            border: "none", borderRadius: "50%", width: 26, height: 26,
            cursor: "pointer", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
      )}

      {/* ── Sección: Precios ── */}
      {sectionLabel("💰 Precios")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Precio público *">
          <input type="number" value={form.public_price} onChange={e => set("public_price", e.target.value)}
            style={inputStyle} placeholder="0.00" min="0" />
        </Field>
        <Field label="Costo de adquisición" hint="Tu costo (interno)">
          <input type="number" value={form.acquisition_cost} onChange={e => set("acquisition_cost", e.target.value)}
            style={inputStyle} placeholder="0.00" min="0" />
        </Field>
      </div>

      {/* Margen calculado */}
      {form.public_price && form.acquisition_cost && Number(form.public_price) > 0 && (
        <div style={{ background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#8b949e", fontSize: 12 }}>Margen de ganancia</span>
          <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>
            {(((Number(form.public_price) - Number(form.acquisition_cost)) / Number(form.public_price)) * 100).toFixed(1)}%
            &nbsp;·&nbsp;
            +${(Number(form.public_price) - Number(form.acquisition_cost)).toFixed(2)}
          </span>
        </div>
      )}

      {/* ── Sección: Inventario ── */}
      {sectionLabel("📦 Inventario")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Stock inicial" hint="Unidades disponibles al crear">
          <input type="number" value={form.stock_initial} onChange={e => set("stock_initial", e.target.value)}
            style={inputStyle} placeholder="0" min="0" />
        </Field>
        <Field label="Límite crítico 🔔" hint="Alerta cuando el stock baje a este nivel">
          <input type="number" value={form.stock_alert_limit} onChange={e => set("stock_alert_limit", e.target.value)}
            style={inputStyle} placeholder="Ej: 5" min="0" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Días de espera (pedido)">
          <input type="number" value={form.lead_time_days} onChange={e => set("lead_time_days", e.target.value)}
            style={inputStyle} placeholder="0" min="0" />
        </Field>
      </div>

      {/* ── Sección: Anticipo ── */}
      {sectionLabel("🔖 Anticipo mínimo (elige uno o deja vacío)")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Monto fijo $">
          <input type="number" value={form.min_deposit_amount} onChange={e => set("min_deposit_amount", e.target.value)}
            style={inputStyle} placeholder="Ej: 200" min="0" />
        </Field>
        <Field label="Porcentaje %">
          <input type="number" value={form.min_deposit_percent} onChange={e => set("min_deposit_percent", e.target.value)}
            style={inputStyle} placeholder="Ej: 30" min="0" max="100" />
        </Field>
      </div>

      {/* ── Toggles ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {[["is_active", "Activo"], ["is_reservable", "Reservable"]].map(([k, lbl]) => (
          <div key={k} onClick={() => set(k, !form[k])}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{
              width: 40, height: 22, borderRadius: 11,
              background: form[k] ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.1)",
              position: "relative", transition: "background .2s",
            }}>
              <div style={{
                position: "absolute", top: 3, left: form[k] ? 20 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: "#fff", transition: "left .2s",
                boxShadow: "0 1px 4px rgba(0,0,0,.3)",
              }} />
            </div>
            <span style={{ color: "var(--text-secondary,#aaa)", fontSize: 13 }}>{lbl}</span>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        width: "100%", padding: "12px", border: "none", borderRadius: 12,
        cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
        fontSize: 14, fontWeight: 700,
        background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
        boxShadow: "0 4px 16px rgba(108,99,255,.3)",
      }}>
        {saving ? "Guardando…" : (isEdit ? "💾 Guardar cambios" : "✅ Crear producto")}
      </button>
    </Modal>
  );
}

// ── Sub-modal: Nueva Reserva ──────────────────────────────────────
function ModalNuevaReserva({ product, miembros, onSave, onClose }) {
  const minDeposit = product.min_deposit_amount
    ? product.min_deposit_amount
    : product.min_deposit_percent
      ? Math.ceil(product.public_price * product.min_deposit_percent / 100)
      : 0;

  const [form, setForm] = useState({
    member_id:            "",
    quantity:             1,
    deposit_amount:       String(minDeposit || ""),
    payment_method:       "Efectivo",
    expected_arrival_date: product.lead_time_days
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + product.lead_time_days);
          return d.toISOString().slice(0, 10);
        })()
      : "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [busqueda, setBusqueda] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const total    = product.public_price * form.quantity;
  const deposit  = Number(form.deposit_amount) || 0;
  const balance  = Math.max(total - deposit, 0);

  const miembrosFiltrados = miembros.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.tel || "").includes(busqueda)
  );

  const selMiembro = miembros.find(m => m.id === form.member_id);

  const handleSave = async () => {
    if (!form.member_id) { setError("Selecciona un miembro"); return; }
    if (minDeposit > 0 && deposit < minDeposit) {
      setError(`El anticipo mínimo es ${fmt(minDeposit)}`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        member_id:            form.member_id,
        product_id:           product.id,
        quantity:             Number(form.quantity),
        unit_price:           product.public_price,
        deposit_amount:       deposit,
        payment_method:       form.payment_method,
        expected_arrival_date: form.expected_arrival_date || null,
        notes:                form.notes || null,
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🔖 Nueva reserva" onClose={onClose} wide>
      {/* Producto seleccionado */}
      <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        {product.image_url && (
          <img src={product.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div>
          <p style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700 }}>{product.name}</p>
          <p style={{ color: "#8b949e", fontSize: 12 }}>{fmt(product.public_price)} c/u</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, color: "#f43f5e", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Selección de miembro */}
      {!selMiembro ? (
        <Field label="Miembro *">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...inputStyle, marginBottom: 6 }} placeholder="Buscar por nombre o teléfono..." />
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {miembrosFiltrados.slice(0, 8).map(m => (
              <button key={m.id} onClick={() => { set("member_id", m.id); setBusqueda(""); }}
                style={{ background: "var(--bg-elevated,#13131f)", border: "1px solid var(--border,#21262d)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 8, alignItems: "center", textAlign: "left" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                  {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : m.nombre.charAt(0)}
                </div>
                <div>
                  <p style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                  {m.tel && <p style={{ color: "#8b949e", fontSize: 11 }}>{m.tel}</p>}
                </div>
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {selMiembro.foto ? <img src={selMiembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : selMiembro.nombre.charAt(0)}
          </div>
          <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, flex: 1 }}>{selMiembro.nombre}</p>
          <button onClick={() => set("member_id", "")} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Cantidad">
          <input type="number" value={form.quantity} min="1"
            onChange={e => set("quantity", Math.max(1, Number(e.target.value)))}
            style={inputStyle} />
        </Field>
        <Field label="Fecha estimada de llegada">
          <input type="date" value={form.expected_arrival_date}
            onChange={e => set("expected_arrival_date", e.target.value)} style={inputStyle} />
        </Field>
      </div>

      {/* Resumen de montos */}
      <div style={{ background: "var(--bg-elevated,#13131f)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#8b949e", fontSize: 12 }}>Total ({form.quantity} × {fmt(product.public_price)})</span>
          <span style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 700 }}>{fmt(total)}</span>
        </div>
        {minDeposit > 0 && (
          <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 4 }}>
            ⚠️ Anticipo mínimo: {fmt(minDeposit)}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#8b949e", fontSize: 12 }}>Anticipo registrado</span>
          <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>{fmt(deposit)}</span>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#8b949e", fontSize: 12, fontWeight: 700 }}>Saldo pendiente</span>
          <span style={{ color: balance > 0 ? "#f59e0b" : "#4ade80", fontSize: 14, fontWeight: 700 }}>{fmt(balance)}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label={`Anticipo${minDeposit > 0 ? ` (mín ${fmt(minDeposit)})` : ""}`}>
          <input type="number" value={form.deposit_amount} min="0" max={total}
            onChange={e => set("deposit_amount", e.target.value)} style={inputStyle} placeholder="0" />
        </Field>
        <Field label="Forma de pago anticipo">
          <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Notas">
        <input value={form.notes} onChange={e => set("notes", e.target.value)}
          style={inputStyle} placeholder="Talla, color, indicaciones..." />
      </Field>

      <button onClick={handleSave} disabled={saving || !form.member_id} style={{
        width: "100%", padding: "12px", border: "none", borderRadius: 12,
        cursor: (saving || !form.member_id) ? "not-allowed" : "pointer",
        fontFamily: "inherit", fontSize: 14, fontWeight: 700,
        background: form.member_id ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "#21262d",
        color: form.member_id ? "#fff" : "#8b949e",
        boxShadow: form.member_id ? "0 4px 16px rgba(108,99,255,.3)" : "none",
      }}>
        {saving ? "Guardando…" : "🔖 Crear apartado"}
      </button>
    </Modal>
  );
}

// ── Sub-modal: Detalle de Reserva ─────────────────────────────────
function ModalDetalleReserva({ reservation, product, miembro, payments, onAddPayment, onUpdateStatus, onClose, addingToCaja }) {
  const [showPago, setShowPago] = useState(false);
  const [pago, setPago]         = useState({ amount: "", payment_method: "Efectivo", notes: "" });
  const [saving, setSaving]     = useState(false);
  const [error,  setError]      = useState("");

  const totalPagado = payments.reduce((s, p) => s + Number(p.amount), 0);
  const saldo       = Math.max(reservation.total_amount - totalPagado, 0);
  const meta        = STATUS_META[reservation.status] || STATUS_META.reserved;

  const handlePago = async () => {
    if (!pago.amount || isNaN(Number(pago.amount)) || Number(pago.amount) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setSaving(true);
    try {
      await onAddPayment({
        reservation_id: reservation.id,
        amount:         Number(pago.amount),
        payment_method: pago.payment_method,
        notes:          pago.notes || null,
      });
      setPago({ amount: "", payment_method: "Efectivo", notes: "" });
      setShowPago(false);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Acciones de flujo según estado actual
  const actions = {
    ordered:    { label: "Marcar como listo para entregar", status: "ready_for_pickup", icon: "✅", color: "#4ade80" },
    ready_for_pickup: { label: "Marcar como entregado", status: "delivered", icon: "🎉", color: "#6ee7b7" },
  };
  const nextAction = actions[reservation.status];
  const canCancel  = !["delivered", "cancelled", "refunded"].includes(reservation.status);

  return (
    <Modal title="📋 Detalle de reserva" onClose={onClose} wide>
      {/* Header producto + miembro */}
      <div style={{ background: "var(--bg-elevated,#13131f)", borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {product?.image_url && (
          <img src={product.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <p style={{ color: "var(--text-primary,#fff)", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{product?.name || "Producto"}</p>
          <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 4 }}>
            {miembro?.nombre} · x{reservation.quantity}
          </p>
          <StatusBadge status={reservation.status} />
        </div>
      </div>

      {/* Resumen financiero */}
      <div style={{ background: "var(--bg-elevated,#13131f)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        {[
          ["Total", fmt(reservation.total_amount), "var(--text-primary,#fff)"],
          ["Pagado", fmt(totalPagado), "#4ade80"],
          ["Saldo pendiente", fmt(saldo), saldo > 0 ? "#f59e0b" : "#4ade80"],
        ].map(([lbl, val, color]) => (
          <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#8b949e", fontSize: 12 }}>{lbl}</span>
            <span style={{ color, fontSize: 13, fontWeight: 700 }}>{val}</span>
          </div>
        ))}
        {reservation.expected_arrival_date && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <p style={{ color: "#8b949e", fontSize: 11 }}>📅 Llegada estimada: {fmtDate(reservation.expected_arrival_date)}</p>
          </div>
        )}
        {reservation.notes && (
          <p style={{ color: "#8b949e", fontSize: 11, marginTop: 4 }}>📝 {reservation.notes}</p>
        )}
      </div>

      {/* Historial de pagos */}
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>
        Pagos registrados ({payments.length})
      </p>
      {payments.length === 0 ? (
        <p style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: "12px 0", marginBottom: 12 }}>Sin pagos aún</p>
      ) : (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {payments.map(p => (
            <div key={p.id} style={{ background: "var(--bg-card,#191928)", border: "1px solid rgba(74,222,128,.15)", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>{fmt(p.amount)}</p>
                <p style={{ color: "#8b949e", fontSize: 11 }}>{p.payment_method} · {fmtDate(p.created_at?.slice(0, 10))}</p>
                {p.notes && <p style={{ color: "#8b949e", fontSize: 10 }}>{p.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 10, color: "#f43f5e", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Registrar pago */}
      {!["delivered", "cancelled", "refunded"].includes(reservation.status) && saldo > 0 && (
        <>
          {!showPago ? (
            <button onClick={() => setShowPago(true)} style={{
              width: "100%", padding: "11px", border: "1px solid rgba(74,222,128,.3)", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: "rgba(74,222,128,.08)", color: "#4ade80", marginBottom: 10,
            }}>
              💵 Registrar pago
            </button>
          ) : (
            <div style={{ background: "rgba(74,222,128,.05)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <p style={{ color: "#4ade80", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Nuevo pago</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <Field label="Monto">
                  <input type="number" value={pago.amount} min="0.01" max={saldo}
                    onChange={e => setPago(p => ({ ...p, amount: e.target.value }))}
                    style={inputStyle} placeholder={`Máx ${fmt(saldo)}`} autoFocus />
                </Field>
                <Field label="Forma de pago">
                  <select value={pago.payment_method}
                    onChange={e => setPago(p => ({ ...p, payment_method: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notas (opcional)">
                <input value={pago.notes} onChange={e => setPago(p => ({ ...p, notes: e.target.value }))}
                  style={inputStyle} placeholder="Ej: Pago de saldo completo" />
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowPago(false); setError(""); }}
                  style={{ flex: 1, padding: "10px", border: "1px solid var(--border-strong,#30363d)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "var(--bg-elevated,#13131f)", color: "#8b949e" }}>
                  Cancelar
                </button>
                <button onClick={handlePago} disabled={saving}
                  style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#22d3ee,#059669)", color: "#fff" }}>
                  {saving ? "Guardando…" : "✅ Guardar pago"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Acciones de estado */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nextAction && (
          <button onClick={() => onUpdateStatus(reservation.id, nextAction.status)} style={{
            width: "100%", padding: "11px", border: "none", borderRadius: 12,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: `${nextAction.color}18`, color: nextAction.color,
            border: `1px solid ${nextAction.color}40`,
          }}>
            {nextAction.icon} {nextAction.label}
          </button>
        )}
        {reservation.status === "partially_paid" && (
          <button onClick={() => onUpdateStatus(reservation.id, "ordered")} style={{
            width: "100%", padding: "11px", border: "1px solid rgba(34,211,238,.3)", borderRadius: 12,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: "rgba(34,211,238,.08)", color: "#22d3ee",
          }}>
            📦 Marcar pedido realizado al proveedor
          </button>
        )}
        {canCancel && (
          <button onClick={() => { if (window.confirm("¿Cancelar esta reserva?")) onUpdateStatus(reservation.id, "cancelled"); }}
            style={{ width: "100%", padding: "10px", border: "1px solid rgba(244,63,94,.2)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "transparent", color: "#f43f5e" }}>
            ❌ Cancelar reserva
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── PANTALLA PRINCIPAL ────────────────────────────────────────────
export default function TiendaScreen({ gymId, miembros, txs, onBack, onAddTx }) {
  const {
    products, reservations, loading, error,
    saveProduct, deleteProduct, toggleProductActive,
    createReservation, updateReservationStatus,
    addPayment, getPaymentsForReservation, getProductById, reload,
  } = useReservations(gymId);

  const [tab,            setTab]            = useState("catalogo"); // catalogo | reservas
  const [modalProducto,  setModalProducto]  = useState(null); // null | {} | product
  const [modalReserva,   setModalReserva]   = useState(null); // null | product
  const [modalDetalle,   setModalDetalle]   = useState(null); // null | reservation
  const [filtroEstado,   setFiltroEstado]   = useState("activas");
  const [busquedaProd,   setBusquedaProd]   = useState("");
  const [saving,         setSaving]         = useState(false);

  // Integración con Caja: cada pago de reserva genera un ingreso
  const handleAddPayment = async (data) => {
    const result = await addPayment(data);
    // Reflejar en caja / transacciones si onAddTx está disponible
    if (onAddTx && result) {
      const reservation = reservations.find(r => r.id === data.reservation_id);
      const product     = reservation ? getProductById(reservation.product_id) : null;
      const miembro     = reservation ? miembros.find(m => m.id === reservation.member_id) : null;
      await onAddTx({
        tipo:       "ingreso",
        categoria:  "Tienda",
        descripcion: `Reserva: ${product?.name || "Producto"} — ${miembro?.nombre || ""}`,
        monto:      data.amount,
        fecha:      todayISO(),
        miembroId:  reservation?.member_id || null,
      });
    }
    // Actualizar detalle si está abierto
    if (modalDetalle?.id === data.reservation_id) {
      setModalDetalle(prev => ({ ...prev, _refreshPays: Date.now() }));
    }
    return result;
  };

  const handleCreateReservation = async (data) => {
    setSaving(true);
    try {
      const result = await createReservation(data);
      // Anticipo inicial → caja
      if (onAddTx && data.deposit_amount > 0) {
        const product = getProductById(data.product_id);
        const miembro = miembros.find(m => m.id === data.member_id);
        await onAddTx({
          tipo:        "ingreso",
          categoria:   "Tienda",
          descripcion: `Anticipo reserva: ${product?.name || "Producto"} — ${miembro?.nombre || ""}`,
          monto:       data.deposit_amount,
          fecha:       todayISO(),
          miembroId:   data.member_id,
        });
      }
      return result;
    } finally {
      setSaving(false);
    }
  };

  // Filtros de reservas
  const reservasFiltradas = useMemo(() => {
    if (filtroEstado === "activas") {
      return reservations.filter(r => !["delivered", "cancelled", "refunded"].includes(r.status));
    }
    if (filtroEstado === "entregadas") {
      return reservations.filter(r => r.status === "delivered");
    }
    if (filtroEstado === "canceladas") {
      return reservations.filter(r => ["cancelled", "refunded"].includes(r.status));
    }
    return reservations;
  }, [reservations, filtroEstado]);

  const productosFiltrados = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(busquedaProd.toLowerCase())),
    [products, busquedaProd]
  );

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🛍️</div>
        <p style={{ color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>Cargando catálogo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, padding: 20 }}>
        <div style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 14, padding: 16 }}>
          <p style={{ color: "#f43f5e", fontWeight: 700, marginBottom: 4 }}>Error al cargar</p>
          <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 10 }}>{error}</p>
          <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 8 }}>¿Las tablas están creadas? Ejecuta en Supabase SQL Editor:</p>
          <code style={{ display: "block", background: "#0d1117", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#a78bfa" }}>
            -- Ver archivo: sql/catalogo_reservas.sql
          </code>
          <button onClick={reload} style={{ marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff" }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Modales */}
      {modalProducto !== null && (
        <ModalProducto
          product={modalProducto?.id ? modalProducto : null}
          onSave={saveProduct}
          onClose={() => setModalProducto(null)}
        />
      )}
      {modalReserva && (
        <ModalNuevaReserva
          product={modalReserva}
          miembros={miembros}
          onSave={handleCreateReservation}
          onClose={() => setModalReserva(null)}
        />
      )}
      {modalDetalle && (() => {
        const res     = reservations.find(r => r.id === modalDetalle.id) || modalDetalle;
        const product = getProductById(res.product_id);
        const miembro = miembros.find(m => m.id === res.member_id);
        const pays    = getPaymentsForReservation(res.id);
        return (
          <ModalDetalleReserva
            key={modalDetalle._refreshPays}
            reservation={res}
            product={product}
            miembro={miembro}
            payments={pays}
            onAddPayment={handleAddPayment}
            onUpdateStatus={updateReservationStatus}
            onClose={() => setModalDetalle(null)}
          />
        );
      })()}

      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "#21262d", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary,#fff)", fontSize: 19, fontWeight: 700 }}>🛍️ Tienda & Reservas</h1>
              <p style={{ color: "#8b949e", fontSize: 11 }}>Catálogo de productos y apartados</p>
            </div>
            {tab === "catalogo" && (
              <button onClick={() => setModalProducto({})} style={{
                padding: "8px 14px", border: "none", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
              }}>
                + Producto
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated,#13131f)", borderRadius: 12, padding: 4, marginBottom: 14 }}>
            {[["catalogo", "📦 Catálogo"], ["reservas", "🔖 Reservas"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: "9px 4px", border: "none", borderRadius: 9,
                cursor: "pointer", fontFamily: "inherit",
                background: tab === k ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "transparent",
                color: tab === k ? "#fff" : "#8b949e",
                fontSize: 13, fontWeight: tab === k ? 700 : 500,
                boxShadow: tab === k ? "0 2px 12px rgba(108,99,255,.3)" : "none",
                transition: "all .2s",
              }}>
                {lbl}
                {k === "reservas" && reservasFiltradas.length > 0 && tab !== "reservas" && (
                  <span style={{ marginLeft: 6, background: "#f43f5e", color: "#fff", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                    {reservasFiltradas.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido scrollable ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* ════ TAB: CATÁLOGO ════ */}
          {tab === "catalogo" && (
            <>
              {/* Buscador */}
              <div style={{ position: "relative", marginBottom: 14 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8b949e" }}>🔍</span>
                <input value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                  placeholder="Buscar producto..."
                  style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
              </div>

              {productosFiltrados.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 36, marginBottom: 10 }}>📦</p>
                  <p style={{ color: "#8b949e", fontSize: 14, marginBottom: 8 }}>
                    {busquedaProd ? `Sin resultados para "${busquedaProd}"` : "No hay productos aún"}
                  </p>
                  {!busquedaProd && (
                    <button onClick={() => setModalProducto({})} style={{ padding: "10px 20px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff" }}>
                      + Agregar primer producto
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {productosFiltrados.map(product => {
                  const resActivas = reservations.filter(r => r.product_id === product.id && !["delivered", "cancelled", "refunded"].includes(r.status)).length;
                  return (
                    <div key={product.id} style={{
                      background: "var(--bg-card,#1e1e30)",
                      border: `1px solid ${product.is_active ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.06)"}`,
                      borderRadius: 16, overflow: "hidden",
                      opacity: product.is_active ? 1 : 0.6,
                      transition: "transform .2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                    >
                      {/* Imagen */}
                      <div style={{ width: "100%", height: 140, background: "rgba(108,99,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                        {product.image_url
                          ? <img src={product.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          : <span style={{ fontSize: 40 }}>📦</span>
                        }
                        {!product.is_active && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, background: "#0d1117", borderRadius: 6, padding: "4px 8px" }}>INACTIVO</span>
                          </div>
                        )}
                        {resActivas > 0 && (
                          <span style={{ position: "absolute", top: 8, right: 8, background: "#f43f5e", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                            {resActivas} apartado{resActivas > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: "12px 14px" }}>
                        <p style={{ color: "var(--text-primary,#fff)", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{product.name}</p>
                        {product.description && (
                          <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.description}</p>
                        )}
                        <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{fmt(product.public_price)}</p>

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {product.is_reservable && (
                            <span style={{ background: "rgba(167,139,250,.12)", color: "#a78bfa", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                              🔖 Reservable
                            </span>
                          )}
                          {(product.min_deposit_amount || product.min_deposit_percent) && (
                            <span style={{ background: "rgba(245,158,11,.1)", color: "#f59e0b", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                              💰 Anticipo {product.min_deposit_amount ? fmt(product.min_deposit_amount) : `${product.min_deposit_percent}%`}
                            </span>
                          )}
                          {product.lead_time_days > 0 && (
                            <span style={{ background: "rgba(34,211,238,.1)", color: "#22d3ee", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                              ⏱ {product.lead_time_days}d
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          {product.is_reservable && product.is_active && (
                            <button onClick={() => setModalReserva(product)} style={{
                              flex: 2, padding: "8px", border: "none", borderRadius: 10,
                              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                              background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                            }}>
                              🔖 Apartar
                            </button>
                          )}
                          <button onClick={() => setModalProducto(product)} style={{
                            flex: 1, padding: "8px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                            background: "transparent", color: "#8b949e",
                          }}>
                            ✏️
                          </button>
                          <button onClick={() => toggleProductActive(product.id, !product.is_active)} style={{
                            padding: "8px 10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                            background: "transparent", color: product.is_active ? "#f43f5e" : "#4ade80",
                          }} title={product.is_active ? "Desactivar" : "Activar"}>
                            {product.is_active ? "⏸" : "▶"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ════ TAB: RESERVAS ════ */}
          {tab === "reservas" && (
            <>
              {/* Filtros de estado */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
                {[
                  ["activas", "Activas"],
                  ["entregadas", "Entregadas"],
                  ["canceladas", "Canceladas"],
                  ["todas", "Todas"],
                ].map(([k, lbl]) => (
                  <button key={k} onClick={() => setFiltroEstado(k)} style={{
                    padding: "7px 14px", border: "none", borderRadius: 20, whiteSpace: "nowrap",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                    background: filtroEstado === k ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated,#13131f)",
                    color: filtroEstado === k ? "#fff" : "#8b949e",
                    transition: "all .2s",
                  }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {reservasFiltradas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 36, marginBottom: 10 }}>🔖</p>
                  <p style={{ color: "#8b949e", fontSize: 14 }}>No hay reservas {filtroEstado !== "todas" ? `"${filtroEstado}"` : ""}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reservasFiltradas.map(res => {
                    const product = getProductById(res.product_id);
                    const miembro = miembros.find(m => m.id === res.member_id);
                    const pays    = getPaymentsForReservation(res.id);
                    const totalPagado = pays.reduce((s, p) => s + Number(p.amount), 0);
                    const saldo = Math.max(res.total_amount - totalPagado, 0);
                    const progreso = res.total_amount > 0 ? Math.min(100, (totalPagado / res.total_amount) * 100) : 0;
                    const meta = STATUS_META[res.status] || STATUS_META.reserved;

                    return (
                      <div key={res.id} onClick={() => setModalDetalle(res)}
                        style={{
                          background: "var(--bg-card,#1e1e30)",
                          border: `1px solid ${meta.color}25`,
                          borderRadius: 16, padding: "14px 16px",
                          cursor: "pointer", transition: "all .2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${meta.color}60`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${meta.color}25`; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          {/* Imagen mini */}
                          <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(108,99,255,.1)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {product?.image_url
                              ? <img src={product.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: 20 }}>📦</span>
                            }
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                              <p style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 700 }}>{product?.name || "Producto"}</p>
                              <StatusBadge status={res.status} />
                            </div>
                            <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 6 }}>
                              👤 {miembro?.nombre || "—"} · x{res.quantity}
                              {res.expected_arrival_date && ` · 📅 ${fmtDate(res.expected_arrival_date)}`}
                            </p>

                            {/* Barra de progreso */}
                            <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${progreso}%`, background: progreso === 100 ? "#4ade80" : "linear-gradient(90deg,#6c63ff,#e040fb)", borderRadius: 2, transition: "width .4s" }} />
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                              <span style={{ color: "#8b949e", fontSize: 11 }}>Total: <strong style={{ color: "var(--text-primary,#fff)" }}>{fmt(res.total_amount)}</strong></span>
                              <span style={{ color: "#8b949e", fontSize: 11 }}>Pagado: <strong style={{ color: "#4ade80" }}>{fmt(totalPagado)}</strong></span>
                              {saldo > 0 && <span style={{ color: "#8b949e", fontSize: 11 }}>Saldo: <strong style={{ color: "#f59e0b" }}>{fmt(saldo)}</strong></span>}
                            </div>
                          </div>

                          <span style={{ color: "#8b949e", fontSize: 18 }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
