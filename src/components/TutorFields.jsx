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

import React from "react";

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
        <label style={LABEL_STYLE}>
          Nombre del tutor *
        </label>
        <input
          type="text"
          value={tutor.tutor_nombre}
          onChange={(e) => onChange("tutor_nombre", e.target.value)}
          placeholder="Ej: Ana Ramírez López"
          style={INPUT_STYLE(errores.tutor_nombre)}
          autoComplete="off"
        />
        {errores.tutor_nombre && (
          <p style={ERROR_STYLE}>{errores.tutor_nombre}</p>
        )}
      </div>

      {/* Teléfono del tutor */}
      <div style={{ marginBottom: 10 }}>
        <label style={LABEL_STYLE}>
          Teléfono del tutor *
        </label>
        <input
          type="tel"
          value={tutor.tutor_telefono}
          onChange={(e) => onChange("tutor_telefono", e.target.value)}
          placeholder="999 000 0000"
          style={INPUT_STYLE(errores.tutor_telefono)}
          autoComplete="off"
          inputMode="numeric"
        />
        {errores.tutor_telefono && (
          <p style={ERROR_STYLE}>{errores.tutor_telefono}</p>
        )}
      </div>

      {/* Parentesco — opcional */}
      <div>
        <label style={LABEL_STYLE}>
          Parentesco <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(opcional)</span>
        </label>
        <select
          value={tutor.tutor_parentesco}
          onChange={(e) => onChange("tutor_parentesco", e.target.value)}
          style={{
            ...INPUT_STYLE(false),
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            cursor: "pointer",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: 36,
            colorScheme: "dark",
          }}
        >
          <option value="">Seleccionar...</option>
          <option value="Madre">Madre</option>
          <option value="Padre">Padre</option>
          <option value="Abuela">Abuela</option>
          <option value="Abuelo">Abuelo</option>
          <option value="Hermano/a">Hermano/a</option>
          <option value="Tío/a">Tío/a</option>
          <option value="Tutor legal">Tutor legal</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
  );
}
