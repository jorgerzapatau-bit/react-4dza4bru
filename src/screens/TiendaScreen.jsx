// ─────────────────────────────────────────────
//  src/screens/TiendaScreen.jsx
//  Módulo: Catálogo · Reservas · Inventario · Kardex
// ─────────────────────────────────────────────

import { useState, useMemo, useRef } from "react";
import { useReservations } from "../hooks/useReservations";
import { fmt, todayISO, fmtDate } from "../utils/dateUtils";

// ── Colores y labels por estado ───────────────────────────────────
const STATUS_META = {
  reserved:         { label: "Apartado",           color: "var(--col-accent-text)", bg: "rgba(167,139,250,.12)", icon: "🔖" },
  partially_paid:   { label: "Anticipo pagado",    color: "var(--col-warning)", bg: "var(--col-warning-soft)",  icon: "💰" },
  ordered:          { label: "Pedido realizado",   color: "var(--col-info)", bg: "var(--col-info-soft)",  icon: "📦" },
  ready_for_pickup: { label: "Listo para entrega", color: "var(--col-success)", bg: "var(--col-success-soft)",  icon: "✅" },
  delivered:        { label: "Entregado",          color: "#6ee7b7", bg: "rgba(110,231,183,.12)", icon: "🎉" },
  cancelled:        { label: "Cancelado",          color: "var(--col-danger)", bg: "var(--col-danger-soft)",   icon: "❌" },
  refunded:         { label: "Reembolsado",        color: "var(--text-secondary)", bg: "rgba(139,148,158,.12)", icon: "↩️" },
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
        background: "var(--bg-card, var(--bg-card))",
        border: "1px solid var(--col-accent-border)",
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

// ── Modal de Confirmación ─────────────────────────────────────────
function ModalConfirm({ title, message, onConfirm, onCancel, confirmLabel = "Confirmar", confirmColor = "var(--col-danger)" }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--bg-card,var(--bg-card))",
        border: "1px solid rgba(244,63,94,.25)",
        borderRadius: 18, padding: 24, width: "100%", maxWidth: 360,
        boxShadow: "0 24px 64px rgba(0,0,0,.6)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ color: "var(--text-primary,#fff)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            background: "transparent", color: "var(--text-secondary)",
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px", border: "none", borderRadius: 12,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: confirmColor, color: "#fff",
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente: Field (label + input) ─────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ color: "var(--text-secondary)", fontSize: 10, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "var(--bg-elevated,var(--bg-base))",
  border: "1px solid var(--border-strong,var(--border-strong))",
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
    stock_alert_limit:   product?.stock_alert_limit   ?? "",
    is_active:           product?.is_active           ?? true,
    is_reservable:       product?.is_reservable       ?? true,
    min_deposit_amount:  product?.min_deposit_amount  ?? "",
    min_deposit_percent: product?.min_deposit_percent ?? "",
  });
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [imgMode,      setImgMode]      = useState("idle");
  const [cameraActive, setCameraActive] = useState(false);
  const [variants,     setVariants]     = useState(product?.variants || []);
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const fileInputRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const resizeTo300 = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 300; canvas.height = 300;
      const ctx = canvas.getContext("2d");
      const size = Math.min(img.width, img.height);
      const sx   = (img.width  - size) / 2;
      const sy   = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = src;
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setError("No se pudo acceder a la cámara");
      setImgMode("idle");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const raw     = canvas.toDataURL("image/jpeg", 0.9);
    const resized = await resizeTo300(raw);
    set("image_url", resized);
    stopCamera();
    setImgMode("idle");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const resized = await resizeTo300(ev.target.result);
      set("image_url", resized);
      setImgMode("idle");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const switchImgMode = (mode) => {
    if (cameraActive) stopCamera();
    setImgMode(mode);
    if (mode === "camera") startCamera();
    if (mode === "gallery") setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const addVariant    = ()        => setVariants(v => [...v, { talla: "", color: "" }]);
  const removeVariant = (i)       => setVariants(v => v.filter((_, idx) => idx !== i));
  const setVariant    = (i, k, v) => setVariants(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

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
        stock_alert_limit:   form.stock_alert_limit !== "" ? Number(form.stock_alert_limit) : null,
        is_active:           form.is_active,
        is_reservable:       form.is_reservable,
        min_deposit_amount:  form.min_deposit_amount !== "" ? Number(form.min_deposit_amount) : null,
        min_deposit_percent: form.min_deposit_percent !== "" ? Number(form.min_deposit_percent) : null,
        variants:            variants.filter(v => v.talla.trim() || v.color.trim()),
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sectionLabel = (txt) => (
    <p style={{ color: "var(--col-accent)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, marginBottom: 10, marginTop: 6, borderBottom: "1px solid var(--col-accent-soft)", paddingBottom: 6 }}>
      {txt}
    </p>
  );

  return (
    <Modal title={isEdit ? "✏️ Editar producto" : "📦 Nuevo producto"} onClose={onClose}>
      {error && (
        <div style={{ background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, color: "var(--col-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

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

      {sectionLabel("🖼️ Imagen del producto")}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 110, height: 110, flexShrink: 0, borderRadius: 14,
          background: "var(--bg-elevated,var(--bg-base))",
          border: "1px dashed var(--border-strong,var(--border-strong))",
          overflow: "hidden", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {form.image_url
            ? <>
                <img src={form.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <button onClick={() => set("image_url", "")} style={{
                  position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.75)",
                  border: "none", borderRadius: "50%", width: 22, height: 22,
                  cursor: "pointer", color: "#fff", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </>
            : <span style={{ fontSize: 28, opacity: .4 }}>📦</span>
          }
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => switchImgMode("gallery")} style={{
            padding: "10px 14px", border: "1px solid var(--border-strong,var(--border-strong))",
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            background: "var(--bg-elevated,var(--bg-base))", color: "var(--text-primary,#fff)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            🖼️ Elegir de galería
          </button>
          <button onClick={() => switchImgMode(imgMode === "camera" ? "idle" : "camera")} style={{
            padding: "10px 14px", border: "none", borderRadius: 10, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            background: imgMode === "camera" ? "var(--col-danger-soft)" : "linear-gradient(135deg,var(--col-accent),var(--col-accent))",
            color: "#fff", display: "flex", alignItems: "center", gap: 8,
          }}>
            {imgMode === "camera" ? "✕ Cancelar cámara" : "📷 Tomar foto"}
          </button>
          <p style={{ color: "var(--text-secondary)", fontSize: 10, margin: 0 }}>Imagen guardada en 300×300 px</p>
        </div>
      </div>

      {imgMode === "camera" && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ borderRadius: 12, overflow: "hidden", background: "#000", position: "relative", marginBottom: 8, aspectRatio: "1/1" }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {!cameraActive && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>Iniciando cámara…</p>
              </div>
            )}
          </div>
          {cameraActive && (
            <button onClick={capturePhoto} style={{
              width: "100%", padding: "10px", border: "none", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,var(--col-info),var(--col-success))", color: "#fff",
            }}>
              📸 Tomar foto
            </button>
          )}
        </div>
      )}

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

      {form.public_price && form.acquisition_cost && Number(form.public_price) > 0 && (
        <div style={{ background: "rgba(74,222,128,.07)", border: "1px solid var(--col-success-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Margen de ganancia</span>
          <span style={{ color: "var(--col-success)", fontSize: 13, fontWeight: 700 }}>
            {(((Number(form.public_price) - Number(form.acquisition_cost)) / Number(form.public_price)) * 100).toFixed(1)}%
            &nbsp;·&nbsp;
            +${(Number(form.public_price) - Number(form.acquisition_cost)).toFixed(2)}
          </span>
        </div>
      )}

      {sectionLabel("📦 Inventario")}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Límite crítico 🔔" hint="Alerta cuando el stock baje a este nivel">
          <input type="number" value={form.stock_alert_limit} onChange={e => set("stock_alert_limit", e.target.value)}
            style={inputStyle} placeholder="Ej: 5" min="0" />
        </Field>
      </div>

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

      {sectionLabel("🎨 Tallas y colores (variantes)")}

      <div style={{ marginBottom: 12 }}>
        {variants.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 8 }}>Sin variantes. Agrega tallas o colores disponibles.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {variants.map((v, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 8, alignItems: "center" }}>
                <input value={v.talla} placeholder="Talla (Ej: S, M, L, XL, 42)"
                  onChange={e => setVariant(i, "talla", e.target.value)}
                  style={{ ...inputStyle, padding: "8px 10px", fontSize: 12 }} />
                <input value={v.color} placeholder="Color (Ej: Rojo, Negro)"
                  onChange={e => setVariant(i, "color", e.target.value)}
                  style={{ ...inputStyle, padding: "8px 10px", fontSize: 12 }} />
                <button onClick={() => removeVariant(i)} style={{
                  width: 32, height: 32, border: "none", borderRadius: 8,
                  background: "var(--col-danger-soft)", color: "var(--col-danger)",
                  cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addVariant} style={{
          padding: "8px 14px", border: "1px dashed rgba(108,99,255,.4)", borderRadius: 10,
          cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          background: "rgba(108,99,255,.06)", color: "var(--col-accent-text)",
        }}>
          + Agregar variante
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {[["is_active", "Activo"], ["is_reservable", "Reservable"]].map(([k, lbl]) => (
          <div key={k} onClick={() => set(k, !form[k])}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{
              width: 40, height: 22, borderRadius: 11,
              background: form[k] ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "rgba(255,255,255,.1)",
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
        background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff",
        boxShadow: "0 4px 16px var(--col-accent-border)",
      }}>
        {saving ? "Guardando…" : (isEdit ? "💾 Guardar cambios" : "✅ Crear producto")}
      </button>
    </Modal>
  );
}

// ── Sub-modal: Entrada de Stock ───────────────────────────────────
function ModalEntradaStock({ product, onSave, onClose }) {
  const [form, setForm] = useState({
    cantidad:    "",
    costo:       product?.acquisition_cost ?? "",
    proveedor:   "",
    notas:       "",
    fecha:       todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.cantidad || isNaN(Number(form.cantidad)) || Number(form.cantidad) <= 0) {
      setError("Ingresa una cantidad válida"); return;
    }
    setSaving(true);
    try {
      await onSave({
        product_id: product.id,
        tipo:       "entrada",
        cantidad:   Number(form.cantidad),
        costo:      form.costo !== "" ? Number(form.costo) : null,
        proveedor:  form.proveedor.trim() || null,
        notas:      form.notas.trim() || null,
        fecha:      form.fecha || todayISO(),
      });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="📥 Entrada de Stock" onClose={onClose}>
      <div style={{ background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        {product.image_url && (
          <img src={product.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div>
          <p style={{ color: "var(--col-info)", fontSize: 14, fontWeight: 700 }}>{product.name}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            Stock actual: <strong style={{ color: "#fff" }}>{product.stock_current ?? product.stock_initial ?? 0}</strong> unidades
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, color: "var(--col-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      <Field label="Cantidad a ingresar *">
        <input type="number" value={form.cantidad} min="1"
          onChange={e => set("cantidad", e.target.value)}
          style={inputStyle} placeholder="Ej: 10" autoFocus />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Costo unitario" hint="Costo pagado al proveedor">
          <input type="number" value={form.costo} min="0"
            onChange={e => set("costo", e.target.value)}
            style={inputStyle} placeholder="0.00" />
        </Field>
        <Field label="Fecha de entrada">
          <input type="date" value={form.fecha}
            onChange={e => set("fecha", e.target.value)}
            style={inputStyle} />
        </Field>
      </div>

      <Field label="Proveedor">
        <input value={form.proveedor} onChange={e => set("proveedor", e.target.value)}
          style={inputStyle} placeholder="Nombre del proveedor..." />
      </Field>

      <Field label="Notas">
        <input value={form.notas} onChange={e => set("notas", e.target.value)}
          style={inputStyle} placeholder="Factura, lote, observaciones..." />
      </Field>

      {form.cantidad && form.costo && Number(form.cantidad) > 0 && Number(form.costo) > 0 && (
        <div style={{ background: "rgba(74,222,128,.07)", border: "1px solid var(--col-success-border)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Inversión total</span>
          <span style={{ color: "var(--col-success)", fontSize: 13, fontWeight: 700 }}>{fmt(Number(form.cantidad) * Number(form.costo))}</span>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        width: "100%", padding: "12px", border: "none", borderRadius: 12,
        cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
        fontSize: 14, fontWeight: 700,
        background: "linear-gradient(135deg,var(--col-info),var(--col-success))", color: "#fff",
        boxShadow: "0 4px 16px rgba(34,211,238,.25)",
      }}>
        {saving ? "Guardando…" : "📥 Registrar entrada"}
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
    member_id:             "",
    quantity:              1,
    deposit_amount:        String(minDeposit || ""),
    payment_method:        "Efectivo",
    expected_arrival_date: "",
    notes:                 "",
  });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [busqueda, setBusqueda] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const total   = product.public_price * form.quantity;
  const deposit = Number(form.deposit_amount) || 0;
  const balance = Math.max(total - deposit, 0);

  const miembrosFiltrados = miembros.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.tel || "").includes(busqueda)
  );

  const selMiembro = miembros.find(m => m.id === form.member_id);

  const handleSave = async () => {
    if (!form.member_id) { setError("Selecciona un miembro"); return; }
    if (minDeposit > 0 && deposit < minDeposit) {
      setError(`El anticipo mínimo es ${fmt(minDeposit)}`); return;
    }
    setSaving(true);
    try {
      await onSave({
        member_id:             form.member_id,
        product_id:            product.id,
        quantity:              Number(form.quantity),
        unit_price:            product.public_price,
        deposit_amount:        deposit,
        payment_method:        form.payment_method,
        expected_arrival_date: form.expected_arrival_date || null,
        notes:                 form.notes || null,
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
      <div style={{ background: "var(--col-accent-soft)", border: "1px solid var(--col-accent-border)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        {product.image_url && (
          <img src={product.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div>
          <p style={{ color: "var(--col-accent-text)", fontSize: 14, fontWeight: 700 }}>{product.name}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>{fmt(product.public_price)} c/u</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            Stock disponible: <strong style={{ color: (product.stock_current ?? product.stock_initial ?? 0) > 0 ? "var(--col-success)" : "var(--col-danger)" }}>
              {product.stock_current ?? product.stock_initial ?? 0}
            </strong>
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, color: "var(--col-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {!selMiembro ? (
        <Field label="Miembro *">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...inputStyle, marginBottom: 6 }} placeholder="Buscar por nombre o teléfono..." />
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {miembrosFiltrados.slice(0, 8).map(m => (
              <button key={m.id} onClick={() => { set("member_id", m.id); setBusqueda(""); }}
                style={{ background: "var(--bg-elevated,var(--bg-base))", border: "1px solid var(--border,var(--bg-elevated))", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 8, alignItems: "center", textAlign: "left" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                  {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : m.nombre.charAt(0)}
                </div>
                <div>
                  <p style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                  {m.tel && <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>{m.tel}</p>}
                </div>
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <div style={{ background: "var(--col-accent-soft)", border: "1px solid var(--col-accent-border)", borderRadius: 12, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {selMiembro.foto ? <img src={selMiembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : selMiembro.nombre.charAt(0)}
          </div>
          <p style={{ color: "var(--col-accent-text)", fontSize: 13, fontWeight: 700, flex: 1 }}>{selMiembro.nombre}</p>
          <button onClick={() => set("member_id", "")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Cantidad">
          <input type="number" value={form.quantity} min="1"
            onChange={e => set("quantity", Math.max(1, Number(e.target.value)))}
            style={inputStyle} />
        </Field>
        <Field label="Fecha estimada de entrega">
          <input type="date" value={form.expected_arrival_date}
            onChange={e => set("expected_arrival_date", e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div style={{ background: "var(--bg-elevated,var(--bg-base))", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Total ({form.quantity} × {fmt(product.public_price)})</span>
          <span style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 700 }}>{fmt(total)}</span>
        </div>
        {minDeposit > 0 && (
          <p style={{ color: "var(--col-warning)", fontSize: 11, marginBottom: 4 }}>⚠️ Anticipo mínimo: {fmt(minDeposit)}</p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Anticipo registrado</span>
          <span style={{ color: "var(--col-success)", fontSize: 13, fontWeight: 700 }}>{fmt(deposit)}</span>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>Saldo pendiente</span>
          <span style={{ color: balance > 0 ? "var(--col-warning)" : "var(--col-success)", fontSize: 14, fontWeight: 700 }}>{fmt(balance)}</span>
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
        background: form.member_id ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-elevated)",
        color: form.member_id ? "#fff" : "var(--text-secondary)",
        boxShadow: form.member_id ? "0 4px 16px var(--col-accent-border)" : "none",
      }}>
        {saving ? "Guardando…" : "🔖 Crear apartado"}
      </button>
    </Modal>
  );
}

// ── Sub-modal: Detalle/Editar Reserva ─────────────────────────────
function ModalDetalleReserva({ reservation, product, miembro, payments, onAddPayment, onUpdateStatus, onEditReservation, onClose, stockActual }) {
  const [showPago,    setShowPago]    = useState(false);
  const [showEditar,  setShowEditar]  = useState(false);
  const [pago, setPago]               = useState({ amount: "", payment_method: "Efectivo", notes: "" });
  const [editForm, setEditForm]       = useState({
    quantity:              reservation.quantity,
    expected_arrival_date: reservation.expected_arrival_date || "",
    notes:                 reservation.notes || "",
    unit_price:            reservation.unit_price ?? reservation.total_amount / reservation.quantity,
  });
  const [saving,       setSaving]       = useState(false);
  const [savingEdit,   setSavingEdit]   = useState(false);
  const [error,        setError]        = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const totalPagado = payments.reduce((s, p) => s + Number(p.amount), 0);
  const saldo       = Math.max(reservation.total_amount - totalPagado, 0);
  // eslint-disable-next-line no-unused-vars
  const meta        = STATUS_META[reservation.status] || STATUS_META.reserved;

  const handlePago = async () => {
    if (!pago.amount || isNaN(Number(pago.amount)) || Number(pago.amount) <= 0) {
      setError("Ingresa un monto válido"); return;
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

  const handleEdit = async () => {
    setSavingEdit(true);
    try {
      await onEditReservation(reservation.id, {
        quantity:              Number(editForm.quantity),
        unit_price:            Number(editForm.unit_price),
        total_amount:          Number(editForm.quantity) * Number(editForm.unit_price),
        expected_arrival_date: editForm.expected_arrival_date || null,
        notes:                 editForm.notes || null,
      });
      setShowEditar(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeliver = async () => {
    const stockOk = stockActual >= reservation.quantity;
    const pagoOk  = saldo === 0;
    if (!stockOk) { setError(`Stock insuficiente. Disponible: ${stockActual}, requerido: ${reservation.quantity}`); return; }
    if (!pagoOk)  { setError(`Pago pendiente de ${fmt(saldo)}. Debe estar pagado totalmente para entregar.`); return; }
    await onUpdateStatus(reservation.id, "delivered");
    onClose();
  };

  const actions = {
    ordered: { label: "Marcar como listo para entregar", status: "ready_for_pickup", icon: "✅", color: "var(--col-success)" },
  };
  const nextAction = actions[reservation.status];
  const canCancel  = !["delivered", "cancelled", "refunded"].includes(reservation.status);
  const canDeliver = reservation.status === "ready_for_pickup";

  const setE = (k, v) => setEditForm(p => ({ ...p, [k]: v }));

  return (
    <Modal title="📋 Detalle de reserva" onClose={onClose} wide>
      {confirmCancel && (
        <ModalConfirm
          title="¿Cancelar esta reserva?"
          message={`Se cancelará el apartado de ${product?.name} para ${miembro?.nombre}. Esta acción no se puede deshacer.`}
          confirmLabel="Sí, cancelar"
          onConfirm={() => { onUpdateStatus(reservation.id, "cancelled"); setConfirmCancel(false); onClose(); }}
          onCancel={() => setConfirmCancel(false)}
        />
      )}

      {/* Header */}
      <div style={{ background: "var(--bg-elevated,var(--bg-base))", borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {product?.image_url && (
          <img src={product.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <p style={{ color: "var(--text-primary,#fff)", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{product?.name || "Producto"}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 4 }}>
            👤 {miembro?.nombre} · x{reservation.quantity}
          </p>
          <StatusBadge status={reservation.status} />
        </div>
        {canCancel && !showEditar && (
          <button onClick={() => setShowEditar(!showEditar)} style={{
            padding: "6px 10px", border: "1px solid var(--col-accent-border)", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
            background: "var(--col-accent-soft)", color: "var(--col-accent-text)",
          }}>✏️ Editar</button>
        )}
      </div>

      {/* Formulario edición */}
      {showEditar && canCancel && (
        <div style={{ background: "rgba(108,99,255,.06)", border: "1px solid var(--col-accent-border)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <p style={{ color: "var(--col-accent-text)", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>✏️ Editar pedido</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <Field label="Cantidad">
              <input type="number" value={editForm.quantity} min="1"
                onChange={e => setE("quantity", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Precio unitario">
              <input type="number" value={editForm.unit_price} min="0"
                onChange={e => setE("unit_price", e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Field label="Fecha estimada de entrega">
            <input type="date" value={editForm.expected_arrival_date}
              onChange={e => setE("expected_arrival_date", e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Notas">
            <input value={editForm.notes} onChange={e => setE("notes", e.target.value)}
              style={inputStyle} placeholder="Observaciones..." />
          </Field>
          <div style={{ background: "rgba(34,211,238,.06)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Nuevo total: </span>
            <strong style={{ color: "var(--col-info)", fontSize: 13 }}>{fmt(Number(editForm.quantity) * Number(editForm.unit_price))}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowEditar(false)} style={{
              flex: 1, padding: "9px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "transparent", color: "var(--text-secondary)",
            }}>Cancelar</button>
            <button onClick={handleEdit} disabled={savingEdit} style={{
              flex: 2, padding: "9px", border: "none", borderRadius: 10,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff",
            }}>{savingEdit ? "Guardando…" : "💾 Guardar cambios"}</button>
          </div>
        </div>
      )}

      {/* Resumen financiero */}
      <div style={{ background: "var(--bg-elevated,var(--bg-base))", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        {[
          ["Total", fmt(reservation.total_amount), "var(--text-primary,#fff)"],
          ["Pagado", fmt(totalPagado), "var(--col-success)"],
          ["Saldo pendiente", fmt(saldo), saldo > 0 ? "var(--col-warning)" : "var(--col-success)"],
        ].map(([lbl, val, color]) => (
          <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{lbl}</span>
            <span style={{ color, fontSize: 13, fontWeight: 700 }}>{val}</span>
          </div>
        ))}
        {/* Barra progreso */}
        <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, margin: "8px 0 4px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${reservation.total_amount > 0 ? Math.min(100, (totalPagado / reservation.total_amount) * 100) : 0}%`,
            background: saldo === 0 ? "var(--col-success)" : "linear-gradient(90deg,var(--col-accent),var(--col-accent))",
            borderRadius: 2, transition: "width .4s",
          }} />
        </div>
        {reservation.expected_arrival_date && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>📅 Entrega estimada: {fmtDate(reservation.expected_arrival_date)}</p>
          </div>
        )}
        {reservation.notes && <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4 }}>📝 {reservation.notes}</p>}
      </div>

      {/* Historial de pagos */}
      <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>
        Pagos registrados ({payments.length})
      </p>
      {payments.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", padding: "12px 0", marginBottom: 12 }}>Sin pagos aún</p>
      ) : (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {payments.map(p => (
            <div key={p.id} style={{ background: "var(--bg-card,#191928)", border: "1px solid var(--col-success-soft)", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "var(--col-success)", fontSize: 13, fontWeight: 700 }}>{fmt(p.amount)}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.payment_method} · {fmtDate(p.created_at?.slice(0, 10))}</p>
                {p.notes && <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>{p.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 10, color: "var(--col-danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Agregar pago */}
      {!["delivered", "cancelled", "refunded"].includes(reservation.status) && (
        <>
          {saldo <= 0 ? (
            <div style={{ background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <p style={{ color: "var(--col-success)", fontSize: 13, fontWeight: 700 }}>Pago completado — sin saldo pendiente</p>
            </div>
          ) : !showPago ? (
            <button onClick={() => setShowPago(true)} style={{
              width: "100%", padding: "11px", border: "1px solid var(--col-success-border)", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: "rgba(74,222,128,.08)", color: "var(--col-success)", marginBottom: 10,
            }}>
              💵 Agregar pago ({fmt(saldo)} pendiente)
            </button>
          ) : (
            <div style={{ background: "rgba(74,222,128,.05)", border: "1px solid var(--col-success-border)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <p style={{ color: "var(--col-success)", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Nuevo pago — saldo restante: {fmt(saldo)}</p>
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
                  style={{ flex: 1, padding: "10px", border: "1px solid var(--border-strong,var(--border-strong))", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "var(--bg-elevated,var(--bg-base))", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={handlePago} disabled={saving}
                  style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,var(--col-info),var(--col-success))", color: "#fff" }}>
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
            width: "100%", padding: "11px", borderRadius: 12, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: `${nextAction.color}18`, color: nextAction.color,
            border: `1px solid ${nextAction.color}40`, transition: "all .2s",
          }}>
            {nextAction.icon} {nextAction.label}
          </button>
        )}

        {/* Entregar: requiere stock + pago completo */}
        {canDeliver && (
          <>
            <button onClick={handleDeliver} disabled={saldo > 0 || stockActual < reservation.quantity} style={{
              width: "100%", padding: "11px", borderRadius: 12,
              cursor: (saldo > 0 || stockActual < reservation.quantity) ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: (saldo === 0 && stockActual >= reservation.quantity) ? "rgba(110,231,183,.15)" : "rgba(255,255,255,.04)",
              color: (saldo === 0 && stockActual >= reservation.quantity) ? "#6ee7b7" : "var(--text-secondary)",
              border: `1px solid ${(saldo === 0 && stockActual >= reservation.quantity) ? "rgba(110,231,183,.4)" : "rgba(255,255,255,.08)"}`,
              opacity: (saldo === 0 && stockActual >= reservation.quantity) ? 1 : 0.65,
            }}>
              🎉 Marcar como entregado
            </button>
            {(saldo > 0 || stockActual < reservation.quantity) && (
              <div style={{ background: "var(--col-danger-soft)", border: "1px solid rgba(244,63,94,.25)", borderRadius: 10, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
                {saldo > 0 && <p style={{ color: "var(--col-danger)", fontSize: 12 }}>🔒 Saldo pendiente de <strong>{fmt(saldo)}</strong></p>}
                {stockActual < reservation.quantity && <p style={{ color: "var(--col-danger)", fontSize: 12 }}>📦 Stock insuficiente: hay <strong>{stockActual}</strong>, se necesitan <strong>{reservation.quantity}</strong></p>}
              </div>
            )}
          </>
        )}



        {canCancel && (
          <button onClick={() => setConfirmCancel(true)} style={{
            width: "100%", padding: "10px", border: "1px solid var(--col-danger-border)", borderRadius: 12,
            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
            background: "transparent", color: "var(--col-danger)",
          }}>
            ❌ Cancelar reserva
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Tab: Inventario ───────────────────────────────────────────────
function TabInventario({ products, onEntradaStock, getKardexForProduct }) {
  const [busqueda, setBusqueda] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filtrados = products.filter(p =>
    p.name.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}>🔍</span>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto en inventario..."
          style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtrados.map(product => {
          const stockActual = product.stock_current ?? product.stock_initial ?? 0;
          const alerta      = product.stock_alert_limit != null && stockActual <= product.stock_alert_limit;
          const kardex      = getKardexForProduct ? getKardexForProduct(product.id) : [];
          const totalEntradas = kardex.filter(k => k.tipo === "entrada").reduce((s, k) => s + k.cantidad, 0);
          const totalSalidas  = kardex.filter(k => k.tipo === "salida").reduce((s, k) => s + k.cantidad, 0);

          return (
            <div key={product.id} style={{
              background: "var(--bg-card,var(--bg-card))",
              border: `1px solid ${alerta ? "var(--col-danger-border)" : "var(--col-accent-soft)"}`,
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--col-accent-soft)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {product.image_url
                    ? <img src={product.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 20 }}>📦</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text-primary,#fff)", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{product.name}</p>
                  {product.sku && <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>SKU: {product.sku}</p>}
                </div>
                {/* Stock badge */}
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: alerta ? "var(--col-danger)" : "var(--col-success)", fontSize: 22, fontWeight: 800 }}>{stockActual}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>en stock</p>
                  {alerta && (
                    <span style={{ background: "var(--col-danger-soft)", color: "var(--col-danger)", borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>
                      ⚠️ Crítico
                    </span>
                  )}
                </div>
              </div>

              {/* Métricas rápidas */}
              <div style={{ display: "flex", gap: 10, marginTop: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ color: "var(--col-info)", fontSize: 13, fontWeight: 700 }}>+{totalEntradas}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>Entradas</p>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ color: "var(--col-accent)", fontSize: 13, fontWeight: 700 }}>-{totalSalidas}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>Salidas</p>
                </div>
                {product.acquisition_cost && (
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <p style={{ color: "var(--col-warning)", fontSize: 13, fontWeight: 700 }}>{fmt(stockActual * product.acquisition_cost)}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>Valor costo</p>
                  </div>
                )}
                {product.stock_alert_limit != null && (
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 700 }}>{product.stock_alert_limit}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>Mín. alerta</p>
                  </div>
                )}
              </div>

              <button onClick={() => onEntradaStock(product)} style={{
                width: "100%", marginTop: 10, padding: "9px", border: "none", borderRadius: 10,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,var(--col-info),var(--col-success))", color: "#fff",
              }}>
                📥 Registrar entrada de stock
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Kardex ───────────────────────────────────────────────────
function TabKardex({ products, reservations, miembros, getKardexForProduct }) {
  const [filtroProducto, setFiltroProducto] = useState("todos");
  const [filtroTipo,     setFiltroTipo]     = useState("todos");
  const [busqueda,       setBusqueda]       = useState("");

  // Construir movimientos completos: entradas del kardex + salidas de entregas
  const movimientos = useMemo(() => {
    const lista = [];

    // Movimientos de Kardex (entradas de stock)
    products.forEach(p => {
      const kardex = getKardexForProduct ? getKardexForProduct(p.id) : [];
      kardex.forEach(k => {
        lista.push({
          id:          k.id,
          tipo:        k.tipo,         // "entrada"
          producto_id: p.id,
          producto:    p.name,
          imagen:      p.image_url,
          cantidad:    k.cantidad,
          costo:       k.costo,
          notas:       k.notas || k.proveedor ? `${k.proveedor ? "Proveedor: " + k.proveedor : ""}${k.notas ? " · " + k.notas : ""}` : "",
          fecha:       k.fecha || k.created_at,
          miembro:     null,
        });
      });
    });

    // Movimientos de Salida (reservas entregadas)
    reservations
      .filter(r => r.status === "delivered")
      .forEach(r => {
        const product = products.find(p => p.id === r.product_id);
        const miembro = miembros.find(m => m.id === r.member_id);
        lista.push({
          id:          `res-${r.id}`,
          tipo:        "salida",
          producto_id: r.product_id,
          producto:    product?.name || "Producto",
          imagen:      product?.image_url,
          cantidad:    r.quantity,
          costo:       null,
          precio:      r.total_amount,
          notas:       r.notes || "",
          fecha:       r.updated_at || r.created_at,
          miembro:     miembro?.nombre || null,
          miembro_id:  r.member_id,
        });
      });

    // Ordenar por fecha desc
    return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [products, reservations, miembros, getKardexForProduct]);

  const productosFiltro = [{ id: "todos", name: "Todos los productos" }, ...products];

  const movFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroProducto !== "todos" && m.producto_id !== filtroProducto) return false;
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        return m.producto.toLowerCase().includes(q) ||
               (m.miembro || "").toLowerCase().includes(q) ||
               (m.notas || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [movimientos, filtroProducto, filtroTipo, busqueda]);

  const totalEntradas = movFiltrados.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.cantidad, 0);
  const totalSalidas  = movFiltrados.filter(m => m.tipo === "salida").reduce((s, m) => s + m.cantidad, 0);
  const totalVentas   = movFiltrados.filter(m => m.tipo === "salida").reduce((s, m) => s + (m.precio || 0), 0);

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}>🔍</span>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, miembro, notas..."
            style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select value={filtroProducto} onChange={e => setFiltroProducto(e.target.value)}
            style={{ ...inputStyle, flex: 1, cursor: "pointer", padding: "8px 12px" }}>
            {productosFiltro.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            {[["todos", "Todo"], ["entrada", "📥 Entradas"], ["salida", "📤 Ventas"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setFiltroTipo(k)} style={{
                padding: "8px 12px", border: "none", borderRadius: 8, whiteSpace: "nowrap",
                cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                background: filtroTipo === k ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-elevated,var(--bg-base))",
                color: filtroTipo === k ? "#fff" : "var(--text-secondary)",
              }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { icon: "📥", label: "Entradas", value: totalEntradas, color: "var(--col-info)", bg: "rgba(34,211,238,.08)" },
          { icon: "📤", label: "Vendidas", value: totalSalidas,  color: "var(--col-accent)", bg: "rgba(224,64,251,.08)" },
          { icon: "💰", label: "Ventas",   value: fmt(totalVentas), color: "var(--col-success)", bg: "rgba(74,222,128,.08)" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 16, marginBottom: 2 }}>{c.icon}</p>
            <p style={{ color: c.color, fontSize: 16, fontWeight: 800 }}>{c.value}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Listado de movimientos */}
      {movFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Sin movimientos registrados</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {movFiltrados.map(mov => {
            const esEntrada = mov.tipo === "entrada";
            const color     = esEntrada ? "var(--col-info)" : "var(--col-accent)";
            const bgColor   = esEntrada ? "rgba(34,211,238,.07)" : "rgba(224,64,251,.07)";
            const border    = esEntrada ? "rgba(34,211,238,.2)" : "rgba(224,64,251,.2)";

            return (
              <div key={mov.id} style={{
                background: bgColor,
                border: `1px solid ${border}`,
                borderRadius: 12, padding: "12px 14px",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                {/* Imagen */}
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--col-accent-soft)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {mov.imagen
                    ? <img src={mov.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 16 }}>📦</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ background: esEntrada ? "var(--col-info-soft)" : "rgba(224,64,251,.12)", color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                      {esEntrada ? "📥 Entrada" : "📤 Venta"}
                    </span>
                    <span style={{ color: "var(--text-primary,#fff)", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mov.producto}
                    </span>
                  </div>

                  {/* Miembro en ventas */}
                  {mov.miembro && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                        {mov.miembro.charAt(0)}
                      </div>
                      <p style={{ color: "var(--col-accent-text)", fontSize: 11, fontWeight: 600 }}>{mov.miembro}</p>
                    </div>
                  )}

                  {mov.notas && <p style={{ color: "var(--text-secondary)", fontSize: 10, marginBottom: 2 }}>{mov.notas}</p>}
                  <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>{fmtDate(mov.fecha?.slice(0, 10))}</p>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color, fontSize: 16, fontWeight: 800 }}>
                    {esEntrada ? "+" : "-"}{mov.cantidad}
                  </p>
                  {mov.costo && <p style={{ color: "var(--text-secondary)", fontSize: 10 }}>{fmt(mov.costo)} c/u</p>}
                  {mov.precio && <p style={{ color: "var(--col-success)", fontSize: 11, fontWeight: 700 }}>{fmt(mov.precio)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PANTALLA PRINCIPAL ────────────────────────────────────────────
export default function TiendaScreen({ gymId, miembros, txs, onBack, onAddTx }) {
  const {
    products, reservations, loading, error,
  // eslint-disable-next-line no-unused-vars
    saveProduct, deleteProduct, toggleProductActive,
    createReservation, updateReservationStatus, editReservation,
    addPayment, addStockEntry, getPaymentsForReservation,
    getProductById, getKardexForProduct, reload,
  } = useReservations(gymId);

  const [tab,             setTab]             = useState("catalogo"); // catalogo | inventario | reservas | kardex
  const [modalProducto,   setModalProducto]   = useState(null);
  const [modalReserva,    setModalReserva]     = useState(null);
  const [modalDetalle,    setModalDetalle]     = useState(null);
  const [modalStock,      setModalStock]       = useState(null); // product para entrada stock
  const [filtroEstado,    setFiltroEstado]     = useState("activas");
  const [busquedaProd,    setBusquedaProd]     = useState("");
  // eslint-disable-next-line no-unused-vars
  const [saving,          setSaving]           = useState(false);

  // ── Cálculo de stock actual (stock_initial + entradas - salidas) ──
  const getStockActual = (productId) => {
    const product = getProductById(productId);
    const base = product?.stock_current ?? product?.stock_initial ?? 0;
    return base;
  };

  // ── Pago de reserva → Caja ────────────────────────────────────────
  const handleAddPayment = async (data) => {
    const result = await addPayment(data);
    if (onAddTx && result) {
      const reservation = reservations.find(r => r.id === data.reservation_id);
      const product     = reservation ? getProductById(reservation.product_id) : null;
      const miembro     = reservation ? miembros.find(m => m.id === reservation.member_id) : null;
      await onAddTx({
        tipo:        "ingreso",
        categoria:   "Tienda",
        descripcion: `Pago reserva: ${product?.name || "Producto"} — ${miembro?.nombre || ""}`,
        monto:       data.amount,
        fecha:       todayISO(),
        miembroId:   reservation?.member_id || null,
      });
    }
    if (modalDetalle?.id === data.reservation_id) {
      setModalDetalle(prev => ({ ...prev, _refreshPays: Date.now() }));
    }
    return result;
  };

  // ── Crear reserva ─────────────────────────────────────────────────
  const handleCreateReservation = async (data) => {
    setSaving(true);
    try {
      const result = await createReservation(data);
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

  // ── Entrada de stock ──────────────────────────────────────────────
  const handleEntradaStock = async (data) => {
    if (addStockEntry) {
      await addStockEntry(data);
    }
    setModalStock(null);
  };

  // ── Editar reserva ────────────────────────────────────────────────
  const handleEditReservation = async (id, data) => {
    if (editReservation) {
      await editReservation(id, data);
    }
    if (modalDetalle?.id === id) {
      setModalDetalle(prev => ({ ...prev, _refreshEdit: Date.now() }));
    }
  };

  // ── Filtros reservas ──────────────────────────────────────────────
  const reservasFiltradas = useMemo(() => {
    if (filtroEstado === "activas")    return reservations.filter(r => !["delivered", "cancelled", "refunded"].includes(r.status));
    if (filtroEstado === "entregadas") return reservations.filter(r => r.status === "delivered");
    if (filtroEstado === "canceladas") return reservations.filter(r => ["cancelled", "refunded"].includes(r.status));
    return reservations;
  }, [reservations, filtroEstado]);

  const productosFiltrados = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(busquedaProd.toLowerCase())),
    [products, busquedaProd]
  );

  // Contador de reservas activas
  const reservasActivas = useMemo(() =>
    reservations.filter(r => !["delivered", "cancelled", "refunded"].includes(r.status)).length,
    [reservations]
  );

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🛍️</div>
        <p style={{ color: "var(--col-accent-text)", fontSize: 14, fontWeight: 600 }}>Cargando catálogo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, padding: 20 }}>
        <div style={{ background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", borderRadius: 14, padding: 16 }}>
          <p style={{ color: "var(--col-danger)", fontWeight: 700, marginBottom: 4 }}>Error al cargar</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 10 }}>{error}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, marginBottom: 8 }}>¿Las tablas están creadas? Ejecuta en Supabase SQL Editor:</p>
          <code style={{ display: "block", background: "var(--bg-base)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--col-accent-text)" }}>
            -- Ver archivo: sql/catalogo_reservas.sql
          </code>
          <button onClick={reload} style={{ marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff" }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Modales ── */}
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
      {modalStock && (
        <ModalEntradaStock
          product={modalStock}
          onSave={handleEntradaStock}
          onClose={() => setModalStock(null)}
        />
      )}
      {modalDetalle && (() => {
        const res     = reservations.find(r => r.id === modalDetalle.id) || modalDetalle;
        const product = getProductById(res.product_id);
        const miembro = miembros.find(m => m.id === res.member_id);
        const pays    = getPaymentsForReservation(res.id);
        const stockActual = getStockActual(res.product_id);
        return (
          <ModalDetalleReserva
            key={`${modalDetalle._refreshPays}-${modalDetalle._refreshEdit}`}
            reservation={res}
            product={product}
            miembro={miembro}
            payments={pays}
            stockActual={stockActual}
            onAddPayment={handleAddPayment}
            onUpdateStatus={updateReservationStatus}
            onEditReservation={handleEditReservation}
            onClose={() => setModalDetalle(null)}
          />
        );
      })()}

      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary,#fff)", fontSize: 19, fontWeight: 700 }}>🛍️ Tienda & Reservas</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>Catálogo · Inventario · Pedidos · Kardex</p>
            </div>
            {tab === "catalogo" && (
              <button onClick={() => setModalProducto({})} style={{
                padding: "8px 14px", border: "none", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff",
              }}>
                + Producto
              </button>
            )}
            {tab === "inventario" && (
              <button onClick={() => products.length > 0 && setModalStock(products[0])} style={{
                padding: "8px 14px", border: "none", borderRadius: 10, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,var(--col-info),var(--col-success))", color: "#fff",
                display: products.length === 0 ? "none" : "block",
              }}>
                📥 Entrada
              </button>
            )}
          </div>

          {/* Tabs — 4 pestañas */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated,var(--bg-base))", borderRadius: 12, padding: 4, marginBottom: 14, overflowX: "auto" }}>
            {[
              ["catalogo",   "📦 Catálogo",   null],
              ["inventario", "🏭 Inventario",  null],
              ["reservas",   "🔖 Reservas",    reservasActivas > 0 ? reservasActivas : null],
              ["kardex",     "📋 Kardex",      null],
            ].map(([k, lbl, badge]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                flex: 1, padding: "9px 4px", border: "none", borderRadius: 9,
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                background: tab === k ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "transparent",
                color: tab === k ? "#fff" : "var(--text-secondary)",
                fontSize: 12, fontWeight: tab === k ? 700 : 500,
                boxShadow: tab === k ? "0 2px 12px var(--col-accent-border)" : "none",
                transition: "all .2s", position: "relative",
              }}>
                {lbl}
                {badge && tab !== k && (
                  <span style={{ marginLeft: 5, background: "var(--col-danger)", color: "#fff", borderRadius: 6, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>
                    {badge}
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
              {/* Dashboard rápido */}
              {(() => {
                const activos      = products.filter(p => p.is_active).length;
                const stockCritico = products.filter(p =>
                  p.is_active &&
                  p.stock_alert_limit != null &&
                  (p.stock_current ?? p.stock_initial ?? 0) <= p.stock_alert_limit
                ).length;
                const valorizacion = products
                  .filter(p => p.is_active)
                  .reduce((s, p) => s + (Number(p.public_price) * (Number(p.stock_current ?? p.stock_initial) || 0)), 0);

                const cards = [
                  { icon: "📦", label: "Activos",       value: activos,                                       color: "var(--col-accent-text)", bg: "rgba(167,139,250,.10)", border: "rgba(167,139,250,.25)" },
                  { icon: "⚠️", label: "Stock Crítico", value: stockCritico,                                  color: stockCritico > 0 ? "var(--col-danger)" : "var(--col-success)", bg: stockCritico > 0 ? "var(--col-danger-soft)" : "rgba(74,222,128,.08)", border: stockCritico > 0 ? "rgba(244,63,94,.25)" : "rgba(74,222,128,.25)" },
                  { icon: "💰", label: "Valor Inventario", value: valorizacion > 0 ? fmt(valorizacion) : "$0", color: "var(--col-info)", bg: "rgba(34,211,238,.08)", border: "rgba(34,211,238,.25)" },
                  { icon: "🔖", label: "Apartados",      value: reservasActivas,                               color: "var(--col-warning)", bg: "var(--col-warning-soft)",   border: "var(--col-warning-border)" },
                ];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {cards.map(c => (
                      <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18 }}>{c.icon}</span>
                          <span style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, lineHeight: 1.2 }}>{c.label}</span>
                        </div>
                        <p style={{ color: c.color, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{c.value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Buscador */}
              <div style={{ position: "relative", marginBottom: 14 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}>🔍</span>
                <input value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                  placeholder="Buscar producto..."
                  style={{ ...inputStyle, paddingLeft: 36, marginBottom: 0 }} />
              </div>

              {productosFiltrados.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 36, marginBottom: 10 }}>📦</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 8 }}>
                    {busquedaProd ? `Sin resultados para "${busquedaProd}"` : "No hay productos aún"}
                  </p>
                  {!busquedaProd && (
                    <button onClick={() => setModalProducto({})} style={{ padding: "10px 20px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff" }}>
                      + Agregar primer producto
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {productosFiltrados.map(product => {
                  const stockActual = product.stock_current ?? product.stock_initial ?? 0;
                  const resActivas  = reservations.filter(r => r.product_id === product.id && !["delivered", "cancelled", "refunded"].includes(r.status)).length;
                  const sinStock    = stockActual === 0;
                  const alerta      = product.stock_alert_limit != null && stockActual <= product.stock_alert_limit && !sinStock;

                  return (
                    <div key={product.id} style={{
                      background: "var(--bg-card,var(--bg-card))",
                      border: `1px solid ${product.is_active ? "var(--col-accent-border)" : "rgba(255,255,255,.06)"}`,
                      borderRadius: 16, overflow: "hidden",
                      opacity: product.is_active ? 1 : 0.6,
                      transition: "transform .2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                    >
                      {/* Imagen */}
                      <div style={{ width: "100%", height: 140, background: "var(--col-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                        {product.image_url
                          ? <img src={product.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          : <span style={{ fontSize: 40 }}>📦</span>
                        }
                        {!product.is_active && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, background: "var(--bg-base)", borderRadius: 6, padding: "4px 8px" }}>INACTIVO</span>
                          </div>
                        )}
                        {resActivas > 0 && (
                          <span style={{ position: "absolute", top: 8, right: 8, background: "var(--col-danger)", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                            {resActivas} apartado{resActivas > 1 ? "s" : ""}
                          </span>
                        )}
                        {/* Badge stock */}
                        <span style={{ position: "absolute", bottom: 8, left: 8, background: sinStock ? "rgba(244,63,94,.85)" : alerta ? "rgba(245,158,11,.85)" : "rgba(74,222,128,.85)", color: "#fff", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                          {sinStock ? "Sin stock" : alerta ? `⚠️ ${stockActual}` : `${stockActual} disponibles`}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ padding: "12px 14px" }}>
                        <p style={{ color: "var(--text-primary,#fff)", fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{product.name}</p>
                        {product.description && (
                          <p style={{ color: "var(--text-secondary)", fontSize: 11, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.description}</p>
                        )}
                        <p style={{ color: "var(--col-success)", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{fmt(product.public_price)}</p>

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {product.is_reservable && (
                            <span style={{ background: "rgba(167,139,250,.12)", color: "var(--col-accent-text)", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                              🔖 Reservable
                            </span>
                          )}
                          {(product.min_deposit_amount || product.min_deposit_percent) && (
                            <span style={{ background: "var(--col-warning-soft)", color: "var(--col-warning)", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 600 }}>
                              💰 Anticipo {product.min_deposit_amount ? fmt(product.min_deposit_amount) : `${product.min_deposit_percent}%`}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          {product.is_reservable && product.is_active && (
                            <button onClick={() => setModalReserva(product)} style={{
                              flex: 2, padding: "8px", border: "none", borderRadius: 10,
                              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                              background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff",
                            }}>
                              🔖 Apartar
                            </button>
                          )}
                          <button onClick={() => setModalStock(product)} style={{
                            flex: 1, padding: "8px", border: "1px solid rgba(34,211,238,.25)", borderRadius: 10,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                            background: "rgba(34,211,238,.06)", color: "var(--col-info)",
                          }} title="Entrada de stock">
                            📥
                          </button>
                          <button onClick={() => setModalProducto(product)} style={{
                            flex: 1, padding: "8px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                            background: "transparent", color: "var(--text-secondary)",
                          }}>
                            ✏️
                          </button>
                          <button onClick={() => toggleProductActive(product.id, !product.is_active)} style={{
                            padding: "8px 10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                            background: "transparent", color: product.is_active ? "var(--col-danger)" : "var(--col-success)",
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

          {/* ════ TAB: INVENTARIO ════ */}
          {tab === "inventario" && (
            <TabInventario
              products={products.filter(p => p.is_active)}
              onEntradaStock={setModalStock}
              getKardexForProduct={getKardexForProduct}
            />
          )}

          {/* ════ TAB: RESERVAS ════ */}
          {tab === "reservas" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
                {[
                  ["activas",    "Activas"],
                  ["entregadas", "Entregadas"],
                  ["canceladas", "Canceladas"],
                  ["todas",      "Todas"],
                ].map(([k, lbl]) => (
                  <button key={k} onClick={() => setFiltroEstado(k)} style={{
                    padding: "7px 14px", border: "none", borderRadius: 20, whiteSpace: "nowrap",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                    background: filtroEstado === k ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-elevated,var(--bg-base))",
                    color: filtroEstado === k ? "#fff" : "var(--text-secondary)",
                    transition: "all .2s",
                  }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {reservasFiltradas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 36, marginBottom: 10 }}>🔖</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No hay reservas {filtroEstado !== "todas" ? `"${filtroEstado}"` : ""}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reservasFiltradas.map(res => {
                    const product     = getProductById(res.product_id);
                    const miembro     = miembros.find(m => m.id === res.member_id);
                    const pays        = getPaymentsForReservation(res.id);
                    const totalPagado = pays.reduce((s, p) => s + Number(p.amount), 0);
                    const saldo       = Math.max(res.total_amount - totalPagado, 0);
                    const progreso    = res.total_amount > 0 ? Math.min(100, (totalPagado / res.total_amount) * 100) : 0;
                    const meta        = STATUS_META[res.status] || STATUS_META.reserved;

                    return (
                      <div key={res.id} onClick={() => setModalDetalle(res)}
                        style={{
                          background: "var(--bg-card,var(--bg-card))",
                          border: `1px solid ${meta.color}25`,
                          borderRadius: 16, padding: "14px 16px",
                          cursor: "pointer", transition: "all .2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${meta.color}60`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${meta.color}25`; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--col-accent-soft)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                            <p style={{ color: "var(--text-secondary)", fontSize: 11, marginBottom: 6 }}>
                              👤 {miembro?.nombre || "—"} · x{res.quantity}
                              {res.expected_arrival_date && ` · 📅 ${fmtDate(res.expected_arrival_date)}`}
                            </p>

                            <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${progreso}%`, background: progreso === 100 ? "var(--col-success)" : "linear-gradient(90deg,var(--col-accent),var(--col-accent))", borderRadius: 2, transition: "width .4s" }} />
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Total: <strong style={{ color: "var(--text-primary,#fff)" }}>{fmt(res.total_amount)}</strong></span>
                              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Pagado: <strong style={{ color: "var(--col-success)" }}>{fmt(totalPagado)}</strong></span>
                              {saldo > 0 && <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Saldo: <strong style={{ color: "var(--col-warning)" }}>{fmt(saldo)}</strong></span>}
                            </div>
                          </div>

                          <span style={{ color: "var(--text-secondary)", fontSize: 18 }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ════ TAB: KARDEX ════ */}
          {tab === "kardex" && (
            <TabKardex
              products={products}
              reservations={reservations}
              miembros={miembros}
              getKardexForProduct={getKardexForProduct}
            />
          )}

        </div>
      </div>
    </div>
  );
}
