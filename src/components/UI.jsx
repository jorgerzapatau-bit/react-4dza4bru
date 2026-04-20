// ─────────────────────────────────────────────
//  components/UI.jsx
//  Átomos de UI reutilizables en toda la app:
//  Badge, Inp, Modal, Btn
//  Estos componentes NO tienen lógica de negocio.
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ── Badge de porcentaje ──────────────────────
export function Badge({ val }) {
  const up = parseFloat(val) >= 0;
  return (
    <span style={{
      background: up ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)",
      color: up ? "#4ade80" : "#f87171",
      borderRadius: 20,
      padding: "3px 10px",
      fontSize: 12,
      fontWeight: 700,
    }}>
      {up ? "▲" : "▼"} {Math.abs(val)}%
    </span>
  );
}

// ── DateInput: maneja escritura con teclado en móvil ──
//
// El problema: input type="date" controlado con value={isoString}
// en móvil (iOS/Android) bloquea la escritura con teclado porque
// cualquier valor parcial ("2", "20") no es ISO válido y React
// lo descarta, reseteando el campo a dd/mm/aaaa.
//
// Solución: el input es NO controlado (sin value=). Usamos una ref
// para sincronizar el valor externo solo cuando cambia desde afuera,
// y propagamos onChange solo con valores completos válidos.
function DateInput({ value, onChange, style, readOnly }) {
  const inputRef = useRef(null);
  // Sincronizar si el valor externo cambia programáticamente
  // (ej: reset del form), sin pisar lo que el usuario está escribiendo.
  const lastExternal = useRef(value);
  useEffect(() => {
    if (value !== lastExternal.current && inputRef.current) {
      // Solo actualizar el DOM si el valor externo realmente cambió
      // y el campo no está activo (el usuario no lo está editando)
      if (document.activeElement !== inputRef.current) {
        inputRef.current.value = value || "";
        lastExternal.current = value;
      }
    }
  }, [value]);

  // Al montar, poner el valor inicial
  useEffect(() => {
    if (inputRef.current && value) {
      inputRef.current.value = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const v = e.target.value; // siempre YYYY-MM-DD o ""
    lastExternal.current = v;
    onChange(v);
  };

  return (
    <input
      ref={inputRef}
      type="date"
      defaultValue={value || ""}
      onChange={handleChange}
      style={style}
      readOnly={readOnly}
    />
  );
}

// ── Input / Select genérico ──────────────────
export function Inp({ label, value, onChange, type = "text", placeholder, options, readOnly }) {
  const s = {
    width: "100%",
    background: readOnly ? "var(--bg-elevated)" : "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12,
    padding: "12px 14px",
    color: readOnly ? "var(--text-tertiary)" : "var(--text-primary)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    marginBottom: 12,
  };

  return (
    <div>
      {label && (
        <p style={{
          color: "var(--text-secondary)",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: .5,
        }}>
          {label}
        </p>
      )}
      {options
        ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ ...s, cursor: "pointer" }}
            disabled={readOnly}
          >
            {options.map(o => (
              <option key={o} value={o} style={{ background: "var(--bg-card)" }}>{o}</option>
            ))}
          </select>
        )
        : type === "date"
          ? (
            <DateInput
              value={value}
              onChange={onChange}
              style={s}
              readOnly={readOnly}
            />
          )
          : (
            <input
              type={type}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              style={s}
              readOnly={readOnly}
            />
          )
      }
    </div>
  );
}

// ── Modal sheet (bottom en móvil, centrado en desktop) ──
export function Modal({ title, onClose, children }) {
  const isDesktop = useIsDesktop();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.72)",
      backdropFilter: "blur(8px)",
      zIndex: 300,
      display: "flex",
      alignItems: isDesktop ? "center" : "flex-end",
      justifyContent: isDesktop ? "center" : "flex-start",
      padding: isDesktop ? "20px" : 0,
    }}>
      <div style={{
        width: "100%",
        maxWidth: isDesktop ? 500 : "100%",
        background: "var(--bg-card)",
        borderRadius: isDesktop ? "20px" : "28px 28px 0 0",
        padding: "24px 24px 44px",
        maxHeight: isDesktop ? "85vh" : "92%",
        overflowY: "auto",
        animation: isDesktop ? "fadeUp .25s ease" : "slideUp .3s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Botón primario / outline / small ────────
export function Btn({ children, onClick, color = "#6c63ff", full, outline, small, style: extraStyle }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? "100%" : "auto",
        padding: small ? "8px 14px" : "13px 20px",
        border: outline ? `1.5px solid ${color}` : "none",
        borderRadius: 14,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        background: outline ? "transparent" : `linear-gradient(135deg,${color},${color}bb)`,
        color: outline ? color : "#fff",
        boxShadow: outline ? "none" : `0 4px 18px ${color}44`,
        transition: "opacity .15s",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}
