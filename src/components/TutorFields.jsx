// src/components/TutorFields.jsx
// ─── Bloque de campos de tutor para menores de edad ──────────────────────
// Se muestra únicamente cuando esMenor === true.
// Es un componente puro (presentacional) — sin lógica de edad propia.
//
// Props:
//   tutor       { tutor_nombre, tutor_telefono, tutor_parentesco }
//   onChange    (campo, valor) => void
//   errores     { tutor_nombre?, tutor_telefono? }   (opcional)
//   compact     boolean  — versión compacta para el modal de alta (default: false)

import React, { useState, useEffect, useRef } from "react";

const PARENTESCO_OPCIONES = [
  { value: "", label: "Seleccionar..." },
  { value: "Madre", label: "Madre" },
  { value: "Padre", label: "Padre" },
  { value: "Abuela", label: "Abuela" },
  { value: "Abuelo", label: "Abuelo" },
  { value: "Hermano/a", label: "Hermano/a" },
  { value: "Tío/a", label: "Tío/a" },
  { value: "Tutor legal", label: "Tutor legal" },
  { value: "Otro", label: "Otro" },
];

const SECTION_STYLE = {
  marginTop: 4,
  marginBottom: 12,
  padding: "14px 14px 10px",
  background: "rgba(251,191,36,.07)",
  border: "1px solid rgba(251,191,36,.25)",
  borderRadius: 14,
};

const LABEL_STYLE = {
  color: "var(--text-tertiary)",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
  display: "block",
};

const INPUT_STYLE = (error) => ({
  width: "100%",
  background: "var(--bg-elevated, #1e1e2e)",
  border: `1px solid ${error ? "#f87171" : "var(--border)"}`,
  borderRadius: 10,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
});

const ERROR_STYLE = {
  color: "#f87171",
  fontSize: 11,
  marginTop: 3,
};

const HEADER_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  marginBottom: 12,
};

// ── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = PARENTESCO_OPCIONES.find((o) => o.value === value) || PARENTESCO_OPCIONES[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const triggerStyle = {
    ...INPUT_STYLE(false),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const dropdownStyle = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "var(--bg-elevated, #1e1e2e)",
    border: "1px solid var(--border, #333)",
    borderRadius: 10,
    zIndex: 9999,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  };

  const optionBaseStyle = {
    padding: "10px 14px",
    fontSize: 13,
    cursor: "pointer",
    color: "var(--text-primary, #e0e0e0)",
    background: "transparent",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        style={triggerStyle}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <span style={{ color: value ? "var(--text-primary, #e0e0e0)" : "var(--text-tertiary, #888)" }}>
          {selected.label}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          style={{ flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path fill="var(--text-tertiary, #888)" d="M6 8L1 3h10z" />
        </svg>
      </div>

      {open && (
        <div style={dropdownStyle} role="listbox">
          {PARENTESCO_OPCIONES.map((op) => {
            const isActive = op.value === value;
            return (
              <div
                key={op.value}
                role="option"
                aria-selected={isActive}
                style={{
                  ...optionBaseStyle,
                  background: isActive ? "rgba(251,191,36,.15)" : "transparent",
                  color: isActive ? "#fbbf24" : op.value === "" ? "var(--text-tertiary, #888)" : "var(--text-primary, #e0e0e0)",
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(op.value);
                  setOpen(false);
                }}
              >
                {op.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TutorFields({ tutor, onChange, errores = {}, compact = false }) {
  return (
    <div style={SECTION_STYLE} role="group" aria-label="Datos del tutor responsable">
      <div style={HEADER_STYLE}>
        <span style={{ fontSize: 16 }}>👨‍👧</span>
        <div>
          <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: 0 }}>
            Tutor responsable
          </p>
          {!compact && (
            <p style={{ color: "var(--text-tertiary)", fontSize: 11, margin: "2px 0 0" }}>
              El miembro es menor de edad — se requiere un tutor legal.
            </p>
          )}
        </div>
      </div>

      {/* Nombre del tutor */}
      <div style={{ marginBottom: 10 }}>
        <label style={LABEL_STYLE}>Nombre del tutor *</label>
        <input
          type="text"
          value={tutor.tutor_nombre}
          onChange={(e) => onChange("tutor_nombre", e.target.value)}
          placeholder="Ej: Ana Ramírez López"
          style={INPUT_STYLE(errores.tutor_nombre)}
          autoComplete="off"
        />
        {errores.tutor_nombre && <p style={ERROR_STYLE}>{errores.tutor_nombre}</p>}
      </div>

      {/* Teléfono del tutor */}
      <div style={{ marginBottom: 10 }}>
        <label style={LABEL_STYLE}>Teléfono del tutor *</label>
        <input
          type="tel"
          value={tutor.tutor_telefono}
          onChange={(e) => onChange("tutor_telefono", e.target.value)}
          placeholder="999 000 0000"
          style={INPUT_STYLE(errores.tutor_telefono)}
          autoComplete="off"
          inputMode="numeric"
        />
        {errores.tutor_telefono && <p style={ERROR_STYLE}>{errores.tutor_telefono}</p>}
      </div>

      {/* Parentesco — opcional (custom select para evitar estilos nativos del OS) */}
      <div>
        <label style={LABEL_STYLE}>
          Parentesco{" "}
          <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(opcional)</span>
        </label>
        <CustomSelect
          value={tutor.tutor_parentesco}
          onChange={(val) => onChange("tutor_parentesco", val)}
        />
      </div>
    </div>
  );
}
