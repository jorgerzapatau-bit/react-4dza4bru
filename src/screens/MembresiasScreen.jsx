// ══════════════════════════════════════════════════════════════════
// src/screens/MembresiasScreen.jsx
// RUTA: src/screens/MembresiasScreen.jsx
//
// Gestor de Membresías — CRUD completo de planes + políticas de cobro
// Se conecta a las tablas: planes_membresia, politicas_membresia
// Usa el mismo patrón de supabase.js que el resto del proyecto
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";

// ── Helpers de color del tema ──────────────────────────────────────
const C = {
  accent:   "#6c63ff",
  accent2:  "#e040fb",
  green:    "#22d3ee",
  red:      "#f43f5e",
  yellow:   "#fbbf24",
  bg:       "var(--bg-main, #0d1117)",
  bgCard:   "var(--bg-card, #161b22)",
  bgCard2:  "var(--bg-nav, #13131f)",
  border:   "var(--border, rgba(255,255,255,.08))",
  text:     "var(--text-primary, #e2e8f0)",
  textSub:  "var(--text-secondary, #8b949e)",
  textMut:  "var(--text-tertiary, #4b4b6a)",
};

// ── Íconos SVG inline ──────────────────────────────────────────────
const IC = {
  plus:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  card:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  shield:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  close:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  infinite:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 12c-2-2.5-4-4-6-4a4 4 0 000 8c2 0 4-1.5 6-4zm0 0c2 2.5 4 4 6 4a4 4 0 000-8c-2 0-4 1.5-6 4z"/></svg>,
  img:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  check:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  warn:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ── Componentes UI reutilizables ───────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: C.textMut, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, min, step, disabled }) {
  return (
    <input
      type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} step={step} disabled={disabled}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
        background: "rgba(255,255,255,.04)", color: C.text, fontSize: 14,
        fontFamily: "inherit", outline: "none", boxSizing: "border-box",
        opacity: disabled ? .5 : 1,
        transition: "border-color .15s",
      }}
      onFocus={e => { e.target.style.borderColor = C.accent; }}
      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,.08)"; }}
    />
  );
}

function Select({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];
  return (
    <div style={{ position: "relative", userSelect: "none", width: "100%" }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
      tabIndex={-1}
    >
      <div onClick={() => setOpen(o => !o)}
        style={{
          padding: "9px 36px 9px 12px", borderRadius: 10,
          border: `1px solid ${open ? C.accent : C.border}`,
          background: C.bgCard2, color: C.text, fontSize: 14,
          fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box",
          display: "flex", alignItems: "center", position: "relative",
          width: "100%", transition: "border-color .15s",
        }}>
        <span>{selected?.label}</span>
        <span style={{
          position: "absolute", right: 12, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: "transform .2s", color: C.textSub, fontSize: 11, pointerEvents: "none",
        }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 700,
          background: C.bgCard2, border: `1px solid ${C.accent}`,
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,.7)",
        }}>
          {options.map(o => (
            <div key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "10px 14px", fontSize: 14, cursor: "pointer",
                color: o.value === value ? "#fff" : C.textSub,
                background: o.value === value ? C.accent : "transparent",
                transition: "background .12s",
              }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = "rgba(108,99,255,.18)"; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = "transparent"; }}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, color = C.accent }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 38, height: 22, borderRadius: 11, position: "relative",
        background: checked ? color : "rgba(255,255,255,.1)",
        transition: "background .2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 19 : 3,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.4)",
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: C.textSub }}>{label}</span>}
    </div>
  );
}

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "#1e1e2e", border: "1px solid rgba(108,99,255,.4)",
          color: "#e2e8f0", fontSize: 12, borderRadius: 8, padding: "8px 12px",
          zIndex: 999, pointerEvents: "none",
          boxShadow: "0 6px 24px rgba(0,0,0,.7)",
          width: 230, lineHeight: 1.6, fontWeight: 400,
        }}>
          {text}
          <div style={{
            position: "absolute", top: "100%", left: 18,
            border: "6px solid transparent", borderTopColor: "#1e1e2e",
          }} />
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, color = C.accent, variant = "fill", size = "md", disabled, full }) {
  const pad = size === "sm" ? "6px 12px" : "10px 20px";
  const fs  = size === "sm" ? 12 : 14;
  const bg  = variant === "fill" ? color : "transparent";
  const bd  = variant === "outline" ? `1px solid ${color}` : "none";
  const cl  = variant === "fill" ? "#fff" : color;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: pad, fontSize: fs, fontWeight: 600, fontFamily: "inherit",
        borderRadius: 10, border: bd, background: bg, color: cl,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1,
        display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
        width: full ? "100%" : "auto",
        boxShadow: variant === "fill" ? `0 4px 14px ${color}40` : "none",
        transition: "opacity .15s, transform .1s",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = ".85"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
    >{children}</button>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.bgCard2, borderRadius: 20, border: `1px solid ${C.border}`,
        width: "100%", maxWidth: width, maxHeight: "92vh", overflowY: "auto",
        padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,.6)",
        animation: "fadeUp .25s ease both",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ color: C.text, fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose}
            style={{ border: "none", background: "rgba(255,255,255,.07)", borderRadius: 8, width: 32, height: 32, color: C.textSub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {IC.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Badge de ciclo ────────────────────────────────────────────────
function CicloBadge({ ciclo }) {
  const map = {
    mensual: { label: "Mensual", color: "#6c63ff" },
    trimestral: { label: "Trimestral", color: "#22d3ee" },
    semestral: { label: "Semestral", color: "#f59e0b" },
    anual: { label: "Anual", color: "#22c55e" },
    ilimitado: { label: "Ilimitado", color: "#e040fb" },
  };
  const cfg = map[ciclo] || { label: ciclo, color: "#6b7280" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em",
      color: cfg.color, background: `${cfg.color}20`,
      padding: "3px 8px", borderRadius: 6,
    }}>{cfg.label}</span>
  );
}

// ── Card de plan ───────────────────────────────────────────────────
function PlanCard({ plan, politica, onEdit, onDelete, gymConfig, clases }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const imgUrl = plan.imagen_url;
  const clasesVinculadas = (plan.clases_vinculadas || []).map(id => clases?.find(c => String(c.id) === String(id))).filter(Boolean);

  return (
    <div style={{
      background: C.bgCard, borderRadius: 18, border: `1px solid ${C.border}`,
      overflow: "hidden", display: "flex", flexDirection: "column",
      animation: "fadeUp .3s ease both",
    }}>
      {/* Imagen / banner */}
      <div style={{
        height: 140, background: `linear-gradient(135deg, ${C.accent}33, ${C.accent2}33)`,
        position: "relative", overflow: "hidden", flexShrink: 0,
      }}>
        {imgUrl
          ? <img src={imgUrl} alt={plan.nombre}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .85 }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.15)", fontSize: 48 }}>🏋️</div>
        }
        {/* overlay con ciclo */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.75) 40%, transparent)" }} />
        <div style={{ position: "absolute", bottom: 10, left: 12 }}>
          <CicloBadge ciclo={plan.ciclo_renovacion} />
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: "4px 0 0", textShadow: "0 2px 8px rgba(0,0,0,.7)" }}>{plan.nombre}</p>
        </div>
        <div style={{ position: "absolute", top: 10, right: 12, textAlign: "right" }}>
          <p style={{ color: "rgba(255,255,255,.6)", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: ".06em" }}>Inversión Plan</p>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 20, margin: 0 }}>$ {Number(plan.precio_publico).toLocaleString()}</p>
        </div>
        {/* estado activo/inactivo */}
        <div style={{
          position: "absolute", top: 10, left: 12,
          width: 8, height: 8, borderRadius: "50%",
          background: plan.activo ? "#22c55e" : "#f43f5e",
          boxShadow: `0 0 6px ${plan.activo ? "#22c55e" : "#f43f5e"}`,
        }} />
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Sucursal */}
        {plan.sucursal && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12 }}>📍</span>
            <span style={{ fontSize: 12, color: C.textSub }}>{plan.sucursal}</span>
          </div>
        )}

        {/* Métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: C.textMut, textTransform: "uppercase", letterSpacing: ".05em", margin: 0 }}>Cupo Clases</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: "2px 0 0" }}>
              {plan.limite_clases === 0 || plan.limite_clases === null ? "Ilimitado" : plan.limite_clases}
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, color: C.textMut, textTransform: "uppercase", letterSpacing: ".05em", margin: 0 }}>Días Gracia</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: politica?.dias_gracia > 0 ? C.green : C.textSub, margin: "2px 0 0" }}>
              {politica?.dias_gracia ?? 0} días
            </p>
          </div>
        </div>

        {/* Política de mora */}
        {politica && (
          <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}20`, borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <span style={{ color: C.red, display: "flex" }}>{IC.warn}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: ".05em" }}>Penalidad Mora</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.red, margin: 0 }}>
              {politica.tipo_penalidad === "porcentaje"
                ? `${politica.penalidad_mora}% del precio`
                : `$${Number(politica.penalidad_mora).toLocaleString()} fijo`}
            </p>
          </div>
        )}

        {/* Costo operativo */}
        {plan.costo_operativo > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textMut }}>Costo operativo</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>
              ${Number(plan.costo_operativo).toLocaleString()}
            </span>
          </div>
        )}

        {/* Clases vinculadas */}
        {clasesVinculadas.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <p style={{ fontSize: 10, color: C.textMut, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 6px", fontWeight: 700 }}>Clases incluidas</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {clasesVinculadas.map(c => (
                <span key={c.id} style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                  background: `${c.color || "#6c63ff"}18`, color: c.color || "#6c63ff",
                  border: `1px solid ${c.color || "#6c63ff"}30`,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color || "#6c63ff", flexShrink: 0 }} />
                  {c.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8 }}>
          <Btn onClick={() => onEdit(plan)} full>
            {IC.edit} Editar
          </Btn>
          {!confirmDel
            ? <button onClick={() => setConfirmDel(true)}
                style={{ border: "none", background: "rgba(244,63,94,.12)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center" }}>
                {IC.trash}
              </button>
            : <button onClick={() => onDelete(plan.id)}
                style={{ border: "none", background: C.red, borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                ¿Borrar?
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ── ImagePicker: cámara + galería + resize 300×300 ─────────────────
function ImagePicker({ value, onChange }) {
  const fileRef  = useState(null);
  const camRef   = useState(null);
  const [prev, setPrev] = useState(value || null);

  // Resize a 300×300 con canvas
  const resizeToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        // Recorte centrado (object-fit: cover)
        const ratio  = Math.max(300 / img.width, 300 / img.height);
        const newW   = img.width  * ratio;
        const newH   = img.height * ratio;
        const offX   = (300 - newW) / 2;
        const offY   = (300 - newH) / 2;
        ctx.drawImage(img, offX, offY, newW, newH);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeToBase64(file);
      setPrev(b64);
      onChange(b64);
    } catch { /* ignorar errores de lectura */ }
    e.target.value = "";
  };

  const handleRemove = () => { setPrev(null); onChange(""); };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Preview */}
      <div style={{ flexShrink: 0 }}>
        {prev ? (
          <div style={{ position: "relative", width: 110, height: 110 }}>
            <img src={prev} alt="portada"
              style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 12, border: `2px solid ${C.border}` }} />
            <button onClick={handleRemove}
              style={{
                position: "absolute", top: -8, right: -8,
                width: 24, height: 24, borderRadius: "50%",
                background: C.red, border: "2px solid #1c1c2e",
                color: "#fff", fontSize: 14, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            <p style={{ fontSize: 10, color: C.textMut, marginTop: 4, textAlign: "center" }}>300×300 px</p>
          </div>
        ) : (
          <div style={{ width: 110, height: 110, borderRadius: 12, border: `2px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMut, fontSize: 32 }}>
            🖼️
          </div>
        )}
      </div>

      {/* Botones al lado */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", paddingTop: 4 }}>
        <p style={{ fontSize: 11, color: C.textMut, margin: "0 0 4px" }}>
          Sube una imagen cuadrada para destacar este plan. Se recortará a 300×300 px automáticamente.
        </p>
        {/* Galería */}
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "9px 14px", borderRadius: 10, cursor: "pointer",
          border: `1px solid ${C.border}`, background: "rgba(255,255,255,.05)",
          color: C.text, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
        }}>
          🖼️ &nbsp;Elegir de galería
          <input ref={e => fileRef[1](e)} type="file" accept="image/*"
            style={{ display: "none" }} onChange={handleFile} />
        </label>

        {/* Cámara */}
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "9px 14px", borderRadius: 10, cursor: "pointer",
          background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
          color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          border: "none", boxShadow: `0 4px 14px ${C.accent}50`,
        }}>
          📷 &nbsp;Tomar foto
          <input type="file" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={handleFile} />
        </label>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FORM DE PLAN (crear / editar)
// ══════════════════════════════════════════════════════════════════
const CICLOS = [
  { value: "mensual",    label: "Mensual"     },
  { value: "trimestral", label: "Trimestral"  },
  { value: "semestral",  label: "Semestral"   },
  { value: "anual",      label: "Anual"       },
  { value: "ilimitado",  label: "Sin vencimiento (ilimitado)" },
];

const TIPOS_PENALIDAD = [
  { value: "fijo",       label: "Monto fijo ($)" },
  { value: "porcentaje", label: "Porcentaje del precio (%)" },
];

const PLAN_VACIO = {
  nombre: "", precio_publico: "", costo_operativo: "",
  ciclo_renovacion: "mensual", limite_clases: "",
  imagen_url: "", sucursal: "", activo: true,
};
const POL_VACIO = {
  dias_gracia: "5", penalidad_mora: "20", tipo_penalidad: "fijo",
  cobro_automatico: false, permitir_congelamiento: true, dias_max_congelamiento: "30",
  requiere_contrato: false, notas: "",
};

function PlanForm({ plan, politica, gymId, sucursales, clases, onSave, onClose }) {
  const [fP, setFP] = useState({ ...PLAN_VACIO, ...plan });
  const [fPol, setFPol] = useState({ ...POL_VACIO, ...politica });
  const [clasesVinculadas, setClasesVinculadas] = useState(() => plan?.clases_vinculadas || []);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isEdit = !!plan?.id;

  const handleSave = async () => {
    if (!fP.nombre.trim()) { setErr("El nombre del plan es obligatorio."); return; }
    if (!fP.precio_publico || isNaN(Number(fP.precio_publico))) { setErr("Ingresa un precio público válido."); return; }
    setErr("");
    setSaving(true);
    try {
      await onSave(
        {
          ...fP,
          precio_publico:   Number(fP.precio_publico),
          costo_operativo:  Number(fP.costo_operativo || 0),
          limite_clases:    fP.limite_clases === "" ? 0 : Number(fP.limite_clases),
          gym_id:           gymId,
          clases_vinculadas: clasesVinculadas,
        },
        {
          ...fPol,
          dias_gracia:           Number(fPol.dias_gracia || 0),
          penalidad_mora:        Number(fPol.penalidad_mora || 0),
          dias_max_congelamiento: Number(fPol.dias_max_congelamiento || 0),
          gym_id:                gymId,
        }
      );
    } catch (e) {
      setErr("Error al guardar. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const upP   = (k, v) => setFP(p => ({ ...p, [k]: v }));
  const upPol = (k, v) => setFPol(p => ({ ...p, [k]: v }));

  const tabStyle = (i) => ({
    flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600,
    border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    background: tab === i ? C.accent : "transparent",
    color: tab === i ? "#fff" : C.textSub,
  });

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        <button style={tabStyle(0)} onClick={() => setTab(0)}>{IC.card} &nbsp;Plan</button>
        <button style={tabStyle(1)} onClick={() => setTab(1)}>{IC.shield} &nbsp;Políticas</button>
        <button style={tabStyle(2)} onClick={() => setTab(2)}>📅 &nbsp;Clases</button>
      </div>

      {/* ─── TAB 0: Datos del plan ─── */}
      {tab === 0 && (
        <>
          <Field label="Nombre del plan *">
            <Input value={fP.nombre} onChange={v => upP("nombre", v)} placeholder="Ej: Mensualidad Karate Infantil" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Precio público (venta) *">
              <Input type="number" value={fP.precio_publico} onChange={v => upP("precio_publico", v)} placeholder="0" min="0" step="0.01" />
            </Field>
            <Field label="Costo operativo (interno)" hint="No visible al alumno">
              <Input type="number" value={fP.costo_operativo} onChange={v => upP("costo_operativo", v)} placeholder="0" min="0" step="0.01" />
            </Field>
          </div>

          <Field label="Ciclo de renovación">
            <Select value={fP.ciclo_renovacion} onChange={v => upP("ciclo_renovacion", v)} options={CICLOS} />
          </Field>


          <Field label="Imagen de portada">
            <ImagePicker value={fP.imagen_url} onChange={v => upP("imagen_url", v)} />
          </Field>

          <Toggle checked={fP.activo} onChange={v => upP("activo", v)} label="Plan activo (visible y asignable)" />
        </>
      )}

      {/* ─── TAB 1: Políticas de cobro ─── */}
      {tab === 1 && (
        <>
          <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}20`, borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
            <p style={{ color: C.textSub, fontSize: 12, margin: 0 }}>⚙️ Las políticas definen las reglas de cobro, morosidad y congelamiento para este plan.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <Field label="Días de gracia" hint="Días después del vencimiento antes de aplicar mora">
              <Input type="number" value={fPol.dias_gracia} onChange={v => upPol("dias_gracia", v)} min="0" placeholder="5" />
            </Field>
            <Field label="Penalidad por mora">
              <Input type="number" value={fPol.penalidad_mora} onChange={v => upPol("penalidad_mora", v)} min="0" placeholder="20" />
            </Field>
          </div>

          <Field label="Tipo de penalidad">
            <Select value={fPol.tipo_penalidad} onChange={v => upPol("tipo_penalidad", v)} options={TIPOS_PENALIDAD} />
          </Field>

          {/* Preview de mora */}
          {fPol.penalidad_mora > 0 && fP.precio_publico > 0 && (
            <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}20`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ color: C.red, fontSize: 12, margin: 0, fontWeight: 600 }}>
                {IC.warn}&nbsp; Mora aplicada:{" "}
                {fPol.tipo_penalidad === "porcentaje"
                  ? `$${(Number(fP.precio_publico) * Number(fPol.penalidad_mora) / 100).toFixed(2)}`
                  : `$${Number(fPol.penalidad_mora).toLocaleString()}`}
                &nbsp;sobre precio de ${Number(fP.precio_publico).toLocaleString()}
              </p>
            </div>
          )}

          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

          <Field label="Días máx. de congelamiento">
            <Input type="number" value={fPol.dias_max_congelamiento} onChange={v => upPol("dias_max_congelamiento", v)} min="0" placeholder="30" />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <Tooltip text="Al vencer el ciclo, se genera automáticamente un cargo al método de pago registrado del alumno.">
              <Toggle checked={fPol.cobro_automatico}       onChange={v => upPol("cobro_automatico", v)}       label="Cobro automático al renovar" />
            </Tooltip>
            <Tooltip text="El alumno podrá pausar su membresía por el número máximo de días definido arriba, sin perder su período.">
              <Toggle checked={fPol.permitir_congelamiento} onChange={v => upPol("permitir_congelamiento", v)} label="Permitir congelar membresía" color={C.green} />
            </Tooltip>
            <Tooltip text="El alumno deberá firmar digitalmente un contrato antes de activar este plan.">
              <Toggle checked={fPol.requiere_contrato}      onChange={v => upPol("requiere_contrato", v)}      label="Requiere firma de contrato" color={C.yellow} />
            </Tooltip>
          </div>

          <Field label="Notas internas de la política">
            <textarea value={fPol.notas} onChange={e => upPol("notas", e.target.value)}
              placeholder="Ej: Solo aplica a alumnos nuevos, etc."
              rows={3}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,.04)", color: C.text, fontSize: 13,
                fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box",
              }} />
          </Field>
        </>
      )}

      {/* ─── TAB 2: Clases incluidas ─── */}
      {tab === 2 && (
        <>
          <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}20`, borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
            <p style={{ color: C.textSub, fontSize: 12, margin: 0 }}>📅 Selecciona las clases a las que da acceso este plan de membresía.</p>
          </div>

          {(!clases || clases.length === 0) ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.textMut }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
              <p style={{ fontSize: 13 }}>No hay clases creadas aún.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Crea clases en la sección <strong>Horarios</strong> para vincularlas aquí.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {clases.map(c => {
                const vinculada = clasesVinculadas.includes(String(c.id));
                return (
                  <div
                    key={c.id}
                    onClick={() => setClasesVinculadas(prev =>
                      vinculada ? prev.filter(id => id !== String(c.id)) : [...prev, String(c.id)]
                    )}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${vinculada ? C.accent : C.border}`,
                      background: vinculada ? `${C.accent}12` : "rgba(255,255,255,.03)",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: c.color || C.accent,
                      boxShadow: `0 0 6px ${c.color || C.accent}`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.text, fontSize: 13, fontWeight: 600, margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {c.nombre}
                      </p>
                      {c.instructor_nombre && (
                        <p style={{ color: C.textMut, fontSize: 11, margin: "2px 0 0" }}>
                          👤 {c.instructor_nombre}
                        </p>
                      )}
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${vinculada ? C.accent : C.border}`,
                      background: vinculada ? C.accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}>
                      {vinculada && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {clasesVinculadas.length > 0 && (
            <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 10, background: `${C.accent}15`, border: `1px solid ${C.accent}30` }}>
              <p style={{ color: C.accent, fontSize: 12, margin: 0, fontWeight: 600 }}>
                ✓ {clasesVinculadas.length} clase{clasesVinculadas.length > 1 ? "s" : ""} vinculada{clasesVinculadas.length > 1 ? "s" : ""}
              </p>
            </div>
          )}
        </>
      )}

      {err && (
        <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{err}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Btn onClick={onClose} variant="outline" color={C.textSub} full>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} full>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}{!saving && " ✓"}
        </Btn>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function MembresiasScreen({ gymId, gymConfig, miembros, txs, isOwner }) {
  const [planes,    setPlanes]    = useState([]);
  const [politicas, setPoliticas] = useState([]);
  const [clases,    setClases]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);  // null | "nuevo" | "editar"
  const [selPlan,   setSelPlan]   = useState(null);
  const [busqueda,  setBusqueda]  = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos"); // "todos" | "activos" | "inactivos"
  const [filtroCiclo,  setFiltroCiclo]  = useState("todos");
  const [toast,    setToast]    = useState(null);

  // ── Cargar datos ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const dbP   = await supabase.from("planes_membresia");
      const rawP  = await dbP.select(gymId);
      setPlanes(rawP || []);

      const dbPol  = await supabase.from("politicas_membresia");
      const rawPol = await dbPol.select(gymId);
      setPoliticas(rawPol || []);

      const dbC   = await supabase.from("clases");
      const rawC  = await dbC.select(gymId);
      setClases(rawC || []);
    } catch(e) {
      console.error("Error cargando membresías:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [gymId]); // eslint-disable-line

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── CRUD ─────────────────────────────────────────────────────
  const handleSave = async (planData, politicaData) => {
    const isEdit = !!selPlan?.id;

    if (isEdit) {
      // UPDATE plan
      const dbP = await supabase.from("planes_membresia");
      await dbP.update(selPlan.id, {
        nombre: planData.nombre, precio_publico: planData.precio_publico,
        costo_operativo: planData.costo_operativo, ciclo_renovacion: planData.ciclo_renovacion,
        limite_clases: planData.limite_clases, imagen_url: planData.imagen_url,
        sucursal: planData.sucursal, activo: planData.activo,
        clases_vinculadas: planData.clases_vinculadas || [],
      });
      setPlanes(prev => prev.map(p => p.id === selPlan.id ? { ...p, ...planData } : p));

      // UPDATE / INSERT política
      const polExistente = politicas.find(p => p.plan_id === selPlan.id);
      const dbPol = await supabase.from("politicas_membresia");
      if (polExistente) {
        await dbPol.update(polExistente.id, { ...politicaData, plan_id: selPlan.id });
        setPoliticas(prev => prev.map(p => p.id === polExistente.id ? { ...p, ...politicaData, plan_id: selPlan.id } : p));
      } else {
        const saved = await dbPol.insert({ ...politicaData, plan_id: selPlan.id });
        if (saved) setPoliticas(prev => [...prev, { ...politicaData, plan_id: selPlan.id, id: saved.id }]);
      }
      showToast("Plan actualizado correctamente");
    } else {
      // INSERT plan
      const dbP  = await supabase.from("planes_membresia");
      const saved = await dbP.insert(planData);
      if (saved) {
        setPlanes(prev => [...prev, { ...planData, id: saved.id }]);
        // INSERT política ligada al nuevo plan
        const dbPol = await supabase.from("politicas_membresia");
        const savedPol = await dbPol.insert({ ...politicaData, plan_id: saved.id });
        if (savedPol) setPoliticas(prev => [...prev, { ...politicaData, plan_id: saved.id, id: savedPol.id }]);
      }
      showToast("Plan creado exitosamente");
    }
    setModal(null);
    setSelPlan(null);
  };

  const handleDelete = async (planId) => {
    // Borrar política primero (si existe)
    const pol = politicas.find(p => p.plan_id === planId);
    if (pol) {
      const dbPol = await supabase.from("politicas_membresia");
      await dbPol.delete(pol.id);
      setPoliticas(prev => prev.filter(p => p.id !== pol.id));
    }
    const dbP = await supabase.from("planes_membresia");
    await dbP.delete(planId);
    setPlanes(prev => prev.filter(p => p.id !== planId));
    showToast("Plan eliminado", "warn");
  };

  // ── Filtros ───────────────────────────────────────────────────
  const planesFiltrados = useMemo(() => {
    let arr = [...planes];
    if (busqueda)             arr = arr.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || p.sucursal?.toLowerCase().includes(busqueda.toLowerCase()));
    if (filtroActivo === "activos")   arr = arr.filter(p => p.activo !== false);
    if (filtroActivo === "inactivos") arr = arr.filter(p => p.activo === false);
    if (filtroCiclo !== "todos")      arr = arr.filter(p => p.ciclo_renovacion === filtroCiclo);
    return arr;
  }, [planes, busqueda, filtroActivo, filtroCiclo]);

  // ── Métricas ──────────────────────────────────────────────────
  const planesActivos = planes.filter(p => p.activo !== false).length;
  const costoPromedio = planes.length > 0
    ? Math.round(planes.reduce((s, p) => s + Number(p.precio_publico || 0), 0) / planes.length)
    : 0;
  const sucursales    = [...new Set(planes.map(p => p.sucursal).filter(Boolean))];
  const planesIlimitados = planes.filter(p => p.ciclo_renovacion === "ilimitado").length;

  // ── Pol de plan seleccionado ───────────────────────────────────
  const polDePlan = (planId) => politicas.find(p => p.plan_id === planId) || null;

  // ── Chips de filtro ───────────────────────────────────────────
  const chipStyle = (active, color = C.accent) => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? color : C.border}`,
    background: active ? `${color}20` : "transparent",
    color: active ? color : C.textSub,
    cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 60px", minHeight: 0, position: "relative" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        textarea{resize:vertical;}
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 30, right: 30, zIndex: 999,
          background: toast.type === "warn" ? C.yellow : "#22c55e",
          color: "#000", padding: "10px 20px", borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)",
          animation: "slideIn .3s ease",
        }}>{toast.type === "warn" ? "⚠️" : "✅"} {toast.msg}</div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💳</div>
            <div>
              <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: 0 }}>
                Gestor de <span style={{ color: C.accent }}>Membresías</span>
              </h1>
              <p style={{ color: C.textMut, fontSize: 12, margin: 0, textTransform: "uppercase", letterSpacing: ".07em" }}>Gestión de Planes &amp; Beneficios</p>
            </div>
          </div>
        </div>
        <Btn onClick={() => { setSelPlan(null); setModal("nuevo"); }}>
          {IC.plus} Nuevo Plan
        </Btn>
      </div>

      {/* ── Métricas ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Planes Activos",    value: planesActivos,   icon: IC.card,    color: C.accent },
          { label: "Costo Promedio",    value: `$${costoPromedio.toLocaleString()}`, icon: "💲", color: "#22d3ee" },
          { label: "Sucursales",        value: sucursales.length || 1,             icon: "📍", color: "#22c55e" },
          { label: "Planes Ilimitados", value: planesIlimitados,                   icon: IC.infinite, color: C.accent2 },
        ].map((m, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: m.color, fontSize: 22, display: "flex" }}>{m.icon}</span>
            <div>
              <p style={{ color: C.textMut, fontSize: 10, textTransform: "uppercase", letterSpacing: ".07em", margin: 0 }}>{m.label}</p>
              <p style={{ color: m.color, fontSize: 20, fontWeight: 800, margin: "2px 0 0" }}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Buscador y filtros ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMut, fontSize: 16 }}>🔍</span>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de plan o sucursal..."
            style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,.04)", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Chips estado */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["todos", "Todos"], ["activos", "Activos"], ["inactivos", "Inactivos"]].map(([v, l]) => (
            <button key={v} style={chipStyle(filtroActivo === v)} onClick={() => setFiltroActivo(v)}>{l}</button>
          ))}
        </div>

        {/* Chips ciclo */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["todos", "Todos ciclos"], ...CICLOS.map(c => [c.value, c.label])].map(([v, l]) => (
            <button key={v} style={chipStyle(filtroCiclo === v, "#22d3ee")} onClick={() => setFiltroCiclo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Grid de planes ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: C.textMut }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${C.accent},${C.accent2})`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💳</div>
          <p style={{ fontSize: 14 }}>Cargando planes...</p>
        </div>
      ) : planesFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: C.textMut, border: `2px dashed ${C.border}`, borderRadius: 20 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.textSub }}>
            {planes.length === 0 ? "Sin planes de membresía" : "No hay planes con esos filtros"}
          </p>
          <p style={{ fontSize: 13, marginBottom: 20 }}>
            {planes.length === 0 ? "Crea tu primer plan para comenzar a gestionar membresías." : "Intenta cambiar los filtros."}
          </p>
          {planes.length === 0 && (
            <Btn onClick={() => { setSelPlan(null); setModal("nuevo"); }}>
              {IC.plus} Crear primer plan
            </Btn>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {planesFiltrados.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              politica={polDePlan(plan.id)}
              gymConfig={gymConfig}
              clases={clases}
              onEdit={p => { setSelPlan(p); setModal("editar"); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Modal Nuevo / Editar ── */}
      {(modal === "nuevo" || modal === "editar") && (
        <Modal
          title={modal === "editar" ? `✏️ Editar plan — ${selPlan?.nombre}` : "✨ Nuevo Plan de Membresía"}
          onClose={() => { setModal(null); setSelPlan(null); }}
          width={540}
        >
          <PlanForm
            plan={selPlan}
            politica={selPlan ? polDePlan(selPlan.id) : null}
            gymId={gymId}
            sucursales={sucursales}
            clases={clases}
            onSave={handleSave}
            onClose={() => { setModal(null); setSelPlan(null); }}
          />
        </Modal>
      )}
    </div>
  );
}
