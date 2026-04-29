// src/modals/NuevaClaseWizard.jsx
// ══════════════════════════════════════════════════════════════════
//  Wizard 3 pasos para crear (o editar) una clase:
//  [1 Datos] → [2 Membresías] → [3 Horarios]
//
//  Props:
//    clase        object | null   — si viene, modo edición
//    gymId        string
//    miembros     array           — para selector de instructor
//    planes       array           — planes_membresia disponibles
//    horarios     array           — horarios existentes de esta clase (edición)
//    onSave       fn(clase, esEdicion, horariosNuevos)
//    onClose      fn()
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { todayISO, fmtDate } from "../utils/dateUtils";
import InstructorSelect from "../components/InstructorSelect";

// ── Constantes ────────────────────────────────────────────────────
const DIAS = [
  { key: "lun", label: "LUN" },
  { key: "mar", label: "MAR" },
  { key: "mie", label: "MIÉ" },
  { key: "jue", label: "JUE" },
  { key: "vie", label: "VIE" },
  { key: "sab", label: "SÁB" },
  { key: "dom", label: "DOM" },
];

const COLORES_PRESET = [
  "#6c63ff", "#e040fb", "#f43f5e", "#f59e0b",
  "#10b981", "#3b82f6", "#ec4899", "#f97316",
];

const FORM_HORARIO_VACIO = {
  hora_inicio: "09:00",
  hora_fin: "10:00",
  dias_semana: [],
  fecha_inicio: todayISO(),
  fecha_fin: "",
};

// ── Estilos base compartidos ──────────────────────────────────────
const S = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,.75)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: 540,
    maxHeight: "95vh",
    background: "var(--bg-card, #12121f)",
    borderRadius: "22px 22px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 -8px 40px rgba(0,0,0,.55)",
  },
  header: { padding: "18px 20px 0", flexShrink: 0 },
  body:   { flex: 1, overflowY: "auto", padding: "16px 20px" },
  footer: {
    padding: "12px 20px 20px", flexShrink: 0,
    borderTop: "1px solid var(--border, #2a2a3e)",
  },
  inp: {
    width: "100%",
    background: "var(--bg-elevated, #1e1e2e)",
    border: "1px solid var(--border-strong, #2e2e42)",
    borderRadius: 12, padding: "12px 14px",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  },
  label: {
    color: "var(--text-tertiary, #6b6b8a)",
    fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 5, display: "block",
  },
  field: { marginBottom: 14 },
  btnPrimary: {
    flex: 1, padding: "14px",
    border: "none", borderRadius: 14,
    background: "linear-gradient(135deg,#6c63ff,#e040fb)",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 18px rgba(108,99,255,.35)",
    transition: "all .2s",
  },
  btnSecondary: {
    flex: 1, padding: "14px",
    border: "1.5px solid var(--border-strong, #2e2e42)",
    borderRadius: 14,
    background: "var(--bg-elevated, #1e1e2e)",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all .2s",
  },
  errorBox: {
    background: "rgba(248,113,113,.12)",
    border: "1px solid rgba(248,113,113,.3)",
    borderRadius: 10, padding: "10px 14px",
    color: "#f87171", fontSize: 12, marginBottom: 14,
  },
};

// ── Barra de Progreso ─────────────────────────────────────────────
function ProgressBar({ step, labels }) {
  const total = labels.length;
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        {labels.map((_, i) => {
          const idx = i + 1;
          const done   = step > idx;
          const active = step === idx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12,
                background: done   ? "#4ade80"
                          : active ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                          :          "var(--bg-elevated, #1e1e2e)",
                color: done || active ? "#fff" : "var(--text-tertiary, #6b6b8a)",
                border: active ? "none"
                       : done  ? "none"
                       :         "1.5px solid var(--border-strong, #2e2e42)",
                boxShadow: active ? "0 0 0 3px rgba(108,99,255,.25)" : "none",
                transition: "all .3s",
              }}>
                {done ? "✓" : idx}
              </div>
              {i < total - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: "0 2px",
                  background: done ? "#4ade80" : "var(--border-strong, #2e2e42)",
                  transition: "background .3s",
                }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {labels.map((l, i) => (
          <p key={i} style={{
            flex: 1,
            textAlign: i === 0 ? "left" : i === labels.length - 1 ? "right" : "center",
            fontSize: 10, fontWeight: step === i + 1 ? 700 : 400,
            color: step === i + 1
              ? "var(--text-primary, #e8e8f0)"
              : "var(--text-tertiary, #6b6b8a)",
            transition: "color .3s",
          }}>{l}</p>
        ))}
      </div>
    </div>
  );
}

// ── Chip de día ───────────────────────────────────────────────────
function DiaChip({ label, activo, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 11px", border: "none", borderRadius: 8,
      cursor: "pointer", fontFamily: "inherit",
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      transition: "all .15s",
      background: activo
        ? "linear-gradient(135deg,#6c63ff,#e040fb)"
        : "var(--bg-elevated, #1e1e2e)",
      color: activo ? "#fff" : "var(--text-secondary, #9999b3)",
      boxShadow: activo ? "0 2px 8px rgba(108,99,255,.35)" : "none",
    }}>
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
//  PASO 1 — Datos de la clase
// ══════════════════════════════════════════════════════════════════
function Step1Datos({ form, set, miembros, instructores, esEdicion }) {
  return (
    <div>
      {/* Nombre */}
      <div style={S.field}>
        <label style={S.label}>Nombre de la clase *</label>
        <input
          type="text" value={form.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej. Karate Infantil"
          style={S.inp}
        />
      </div>

      {/* Descripción */}
      <div style={S.field}>
        <label style={S.label}>Descripción</label>
        <input
          type="text" value={form.descripcion}
          onChange={e => set("descripcion", e.target.value)}
          placeholder="Descripción breve (opcional)"
          style={S.inp}
        />
      </div>

      {/* Instructor */}
      <div style={S.field}>
        <label style={S.label}>Instructor encargado</label>
        <InstructorSelect
          instructores={instructores && instructores.length > 0 ? instructores : miembros.map(m => ({ id: m.id, nombre: m.nombre, foto: m.foto || null, especialidad: null }))}
          value={form.instructor_id}
          onChange={(id, nombre) => {
            set("instructor_id", id);
            set("instructor_nombre", nombre);
          }}
          color={form.color || "#6c63ff"}
        />
      </div>

      {/* Edades */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={S.label}>Edad mínima</label>
          <input
            type="number" value={form.edad_min} min={0} max={99}
            onChange={e => set("edad_min", e.target.value)}
            style={S.inp}
          />
        </div>
        <div>
          <label style={S.label}>Edad máxima</label>
          <input
            type="number" value={form.edad_max} min={0} max={99}
            onChange={e => set("edad_max", e.target.value)}
            style={S.inp}
          />
        </div>
      </div>

      {/* Cupo */}
      <div style={S.field}>
        <label style={S.label}>Cupo máximo *</label>
        <input
          type="number" value={form.cupo_max} min={1}
          onChange={e => set("cupo_max", e.target.value)}
          style={S.inp}
        />
      </div>

      {/* Color */}
      <div style={S.field}>
        <label style={S.label}>Color etiqueta</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {COLORES_PRESET.map(c => (
            <button
              key={c} onClick={() => set("color", c)}
              style={{
                width: 30, height: 30, borderRadius: "50%",
                background: c, border: "none", cursor: "pointer",
                flexShrink: 0,
                boxShadow: form.color === c
                  ? `0 0 0 3px var(--bg-card, #12121f), 0 0 0 5px ${c}`
                  : "none",
                transition: "box-shadow .15s",
              }}
            />
          ))}
          <input
            type="color" value={form.color}
            onChange={e => set("color", e.target.value)}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "none", padding: 0 }}
            title="Color personalizado"
          />
        </div>
        {/* Preview */}
        <div style={{
          marginTop: 10, padding: "10px 14px",
          borderLeft: `4px solid ${form.color}`,
          borderRadius: "0 10px 10px 0",
          background: `${form.color}10`,
        }}>
          <p style={{ color: form.color, fontSize: 13, fontWeight: 700 }}>
            {form.nombre || "Vista previa"}
          </p>
          {form.descripcion && (
            <p style={{ color: "var(--text-secondary, #9999b3)", fontSize: 11, marginTop: 2 }}>
              {form.descripcion}
            </p>
          )}
        </div>
      </div>

      {/* Activo toggle — solo en edición */}
      {esEdicion && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => set("activo", !form.activo)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: form.activo
                ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                : "var(--bg-elevated, #1e1e2e)",
              position: "relative", transition: "background .2s", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 3,
              left: form.activo ? 22 : 3,
              width: 18, height: 18, borderRadius: "50%",
              background: "#fff", transition: "left .2s",
              boxShadow: "0 1px 4px rgba(0,0,0,.25)",
            }} />
          </button>
          <span style={{ color: "var(--text-secondary, #9999b3)", fontSize: 13 }}>
            Clase {form.activo ? "activa" : "inactiva"}
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  PASO 2 — Membresías vinculadas
// ══════════════════════════════════════════════════════════════════
function Step2Membresias({ form, set, planes }) {
  const seleccionados = form.planes_ids || [];

  const toggle = (planId) => {
    const id = String(planId);
    set("planes_ids",
      seleccionados.includes(id)
        ? seleccionados.filter(x => x !== id)
        : [...seleccionados, id]
    );
  };

  if (!planes || planes.length === 0) {
    return (
      <div style={{
        background: "rgba(108,99,255,.07)",
        border: "1px dashed rgba(108,99,255,.3)",
        borderRadius: 14, padding: "28px 20px", textAlign: "center",
      }}>
        <p style={{ fontSize: 32, marginBottom: 10 }}>💳</p>
        <p style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          No hay planes de membresía
        </p>
        <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12 }}>
          Crea planes en la sección <strong>Membresías</strong> y luego vincúlalos aquí.
        </p>
        <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, marginTop: 10 }}>
          Puedes continuar sin vincular — cualquier miembro podrá inscribirse sin restricción.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
        Selecciona los planes que darán acceso a esta clase. Los miembros con un plan vinculado podrán inscribirse automáticamente.
      </p>

      {/* Opción: sin restricción */}
      <button
        onClick={() => set("planes_ids", [])}
        style={{
          width: "100%", padding: "13px 16px", marginBottom: 8,
          border: seleccionados.length === 0
            ? "2px solid rgba(255,255,255,.3)"
            : "1.5px solid var(--border-strong, #2e2e42)",
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
          background: seleccionados.length === 0
            ? "rgba(255,255,255,.05)"
            : "var(--bg-elevated, #1e1e2e)",
          display: "flex", alignItems: "center", gap: 12,
          transition: "all .2s",
        }}
      >
        <span style={{ fontSize: 20 }}>🔓</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{
            color: seleccionados.length === 0
              ? "var(--text-primary, #e8e8f0)"
              : "var(--text-tertiary, #6b6b8a)",
            fontWeight: seleccionados.length === 0 ? 700 : 400, fontSize: 13,
          }}>
            Sin restricción de membresía
          </p>
          <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, marginTop: 2 }}>
            Cualquier miembro puede inscribirse
          </p>
        </div>
        {seleccionados.length === 0 && (
          <span style={{
            background: "rgba(255,255,255,.1)",
            color: "var(--text-primary, #e8e8f0)",
            borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
          }}>✓</span>
        )}
      </button>

      {/* Lista de planes */}
      {planes.map(p => {
        const sel = seleccionados.includes(String(p.id));
        const precio = Number(p.precio_publico || 0);
        return (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            style={{
              width: "100%", padding: "13px 16px", marginBottom: 8,
              border: sel
                ? "2px solid #6c63ff"
                : "1.5px solid var(--border-strong, #2e2e42)",
              borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
              background: sel
                ? "rgba(108,99,255,.12)"
                : "var(--bg-elevated, #1e1e2e)",
              display: "flex", alignItems: "center", gap: 12,
              transition: "all .18s",
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${sel ? "#6c63ff" : "rgba(255,255,255,.2)"}`,
              background: sel ? "#6c63ff" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}>
              {sel && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>

            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{
                color: sel ? "#c4b5fd" : "var(--text-primary, #e8e8f0)",
                fontWeight: sel ? 700 : 500, fontSize: 13,
              }}>
                {p.nombre}
              </p>
              {p.ciclo_renovacion && (
                <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, marginTop: 2 }}>
                  {p.ciclo_renovacion}
                </p>
              )}
            </div>

            <span style={{
              background: sel
                ? "rgba(108,99,255,.25)"
                : "rgba(255,255,255,.07)",
              color: sel ? "#c4b5fd" : "var(--text-secondary, #9999b3)",
              borderRadius: 8, padding: "4px 11px",
              fontSize: 12, fontWeight: 700,
              fontFamily: "'DM Mono', monospace",
            }}>
              ${precio.toLocaleString("es-MX")}
            </span>
          </button>
        );
      })}

      {/* Aviso si sin plan */}
      {seleccionados.length === 0 && planes.length > 0 && (
        <p style={{ color: "#f59e0b", fontSize: 11, marginTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span>⚠️</span>
          Sin plan vinculado — cualquier miembro podrá inscribirse sin restricción de membresía.
        </p>
      )}

      {/* Resumen seleccionados */}
      {seleccionados.length > 0 && (
        <div style={{
          marginTop: 14, padding: "11px 14px",
          background: "rgba(108,99,255,.07)",
          border: "1px solid rgba(108,99,255,.2)",
          borderRadius: 12,
        }}>
          <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            ✅ {seleccionados.length} plan{seleccionados.length !== 1 ? "es" : ""} vinculado{seleccionados.length !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {seleccionados.map(id => {
              const plan = planes.find(p => String(p.id) === id);
              if (!plan) return null;
              return (
                <span key={id} style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 6,
                  background: "rgba(108,99,255,.18)", color: "#c4b5fd",
                  border: "1px solid rgba(108,99,255,.3)",
                }}>
                  💳 {plan.nombre}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  PASO 3 — Horarios
// ══════════════════════════════════════════════════════════════════
function HorarioForm({ horario, onChange, onRemove, color, index }) {
  const toggleDia = (dia) => {
    const dias = horario.dias_semana || [];
    onChange({
      ...horario,
      dias_semana: dias.includes(dia)
        ? dias.filter(d => d !== dia)
        : [...dias, dia],
    });
  };

  return (
    <div style={{
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "0 14px 14px 0",
      padding: "14px 14px 12px",
      marginBottom: 12,
      background: `${color}08`,
      position: "relative",
    }}>
      {/* Header horario */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ color, fontSize: 12, fontWeight: 700 }}>
          🕐 Horario {index + 1}
        </p>
        <button
          onClick={onRemove}
          style={{
            border: "none", background: "rgba(248,113,113,.12)",
            color: "#f87171", borderRadius: 8, padding: "4px 10px",
            cursor: "pointer", fontSize: 11, fontWeight: 700,
          }}
        >
          ✕ Quitar
        </button>
      </div>

      {/* Días */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ ...S.label, marginBottom: 8 }}>Días *</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {DIAS.map(d => (
            <DiaChip
              key={d.key}
              label={d.label}
              activo={(horario.dias_semana || []).includes(d.key)}
              onClick={() => toggleDia(d.key)}
            />
          ))}
        </div>
      </div>

      {/* Horas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={S.label}>Inicio</label>
          <input
            type="time" value={horario.hora_inicio}
            onChange={e => onChange({ ...horario, hora_inicio: e.target.value })}
            style={S.inp}
          />
        </div>
        <div>
          <label style={S.label}>Final</label>
          <input
            type="time" value={horario.hora_fin}
            onChange={e => onChange({ ...horario, hora_fin: e.target.value })}
            style={S.inp}
          />
        </div>
      </div>

      {/* Vigencia */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={S.label}>Desde</label>
          <input
            type="date" value={horario.fecha_inicio}
            onChange={e => onChange({ ...horario, fecha_inicio: e.target.value })}
            style={S.inp}
          />
        </div>
        <div>
          <label style={S.label}>Hasta (opcional)</label>
          <input
            type="date" value={horario.fecha_fin || ""}
            onChange={e => onChange({ ...horario, fecha_fin: e.target.value })}
            placeholder="Sin fecha fin"
            style={S.inp}
          />
        </div>
      </div>
    </div>
  );
}

function Step3Horarios({ horarios, setHorarios, color, horariosExistentes }) {
  const fmtHora = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
  };

  const DIAS_FULL = {
    lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves",
    vie: "Viernes", sab: "Sábado", dom: "Domingo",
  };

  return (
    <div>
      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
        Agrega uno o más horarios semanales. Puedes configurar días, hora de inicio/fin y vigencia.
      </p>

      {/* Horarios existentes (edición) */}
      {horariosExistentes && horariosExistentes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ ...S.label, marginBottom: 8 }}>Horarios ya guardados</p>
          {horariosExistentes.map(h => (
            <div key={h.id} style={{
              padding: "10px 13px", borderRadius: 12, marginBottom: 7,
              background: "var(--bg-elevated, #1e1e2e)",
              border: `1px solid ${color}25`,
              borderLeft: `3px solid ${color}`,
              opacity: h.activo !== false ? 1 : .5,
            }}>
              <p style={{ color, fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
                {fmtHora(h.hora_inicio)} — {fmtHora(h.hora_fin)}
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(h.dias_semana || []).map(d => (
                  <span key={d} style={{
                    background: `${color}18`, color,
                    borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700,
                  }}>
                    {DIAS_FULL[d] || d}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, marginTop: 4, marginBottom: 14 }}>
            Para editar horarios existentes, usa el botón "⚙️ Editar datos de la clase" en el detalle de la clase.
          </p>
        </div>
      )}

      {/* Formularios de nuevos horarios */}
      {horarios.map((h, i) => (
        <HorarioForm
          key={i}
          horario={h}
          index={i}
          color={color}
          onChange={updated => setHorarios(p => p.map((x, j) => j === i ? updated : x))}
          onRemove={() => setHorarios(p => p.filter((_, j) => j !== i))}
        />
      ))}

      {/* Botón agregar horario */}
      <button
        onClick={() => setHorarios(p => [...p, { ...FORM_HORARIO_VACIO, fecha_inicio: todayISO() }])}
        style={{
          width: "100%", padding: "13px",
          border: `1.5px dashed ${color}50`,
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
          background: `${color}08`,
          color, fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all .2s",
        }}
      >
        <span style={{ fontSize: 18 }}>+</span>
        Agregar horario
      </button>

      {horarios.length === 0 && (!horariosExistentes || horariosExistentes.length === 0) && (
        <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, textAlign: "center", marginTop: 12 }}>
          Puedes guardar la clase sin horarios y agregarlos después.
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL — NuevaClaseWizard
// ══════════════════════════════════════════════════════════════════
export default function NuevaClaseWizard({
  clase,
  gymId,
  miembros,
  instructores,         // lista de instructores de tabla instructores
  planes,
  horariosExistentes,   // horarios ya guardados en BD (modo edición)
  onSave,
  onClose,
}) {
  const esEdicion = !!clase;

  // ── Estado del formulario ──────────────────────────────────────
  const [form, setForm] = useState(() => {
    if (clase) {
      return {
        nombre:             clase.nombre         || "",
        descripcion:        clase.descripcion    || "",
        instructor_id:      clase.instructor_id  || "",
        instructor_nombre:  clase.instructor_nombre || "",
        edad_min:           String(clase.edad_min  ?? 0),
        edad_max:           String(clase.edad_max  ?? 99),
        cupo_max:           String(clase.cupo_max  ?? 20),
        color:              clase.color           || "#6c63ff",
        activo:             clase.activo !== false,
        planes_ids: (planes || [])
          .filter(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)))
          .map(p => String(p.id)),
      };
    }
    return {
      nombre: "", descripcion: "",
      instructor_id: "", instructor_nombre: "",
      edad_min: "0", edad_max: "99", cupo_max: "20",
      color: "#6c63ff", activo: true,
      planes_ids: [],
    };
  });

  const [horariosNuevos, setHorariosNuevos] = useState([]);
  const [step, setStep]   = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Validación por paso ────────────────────────────────────────
  const validarPaso = () => {
    if (step === 1) {
      if (!form.nombre.trim()) { setError("El nombre de la clase es obligatorio."); return false; }
      if (!form.cupo_max || Number(form.cupo_max) < 1) { setError("El cupo máximo debe ser al menos 1."); return false; }
    }
    if (step === 3) {
      for (const [i, h] of horariosNuevos.entries()) {
        if (h.dias_semana.length === 0) { setError(`Horario ${i + 1}: selecciona al menos un día.`); return false; }
        if (!h.hora_inicio || !h.hora_fin) { setError(`Horario ${i + 1}: hora inicio y fin son obligatorias.`); return false; }
        if (h.hora_fin <= h.hora_inicio) { setError(`Horario ${i + 1}: la hora de fin debe ser posterior al inicio.`); return false; }
      }
    }
    setError("");
    return true;
  };

  // ── Guardar ───────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!validarPaso()) return;
    setSaving(true);
    setError("");

    try {
      const payload = {
        gym_id:             gymId,
        nombre:             form.nombre.trim(),
        descripcion:        form.descripcion.trim() || null,
        instructor_id:      form.instructor_id || null,
        instructor_nombre:  form.instructor_nombre || null,
        edad_min:           Number(form.edad_min) || 0,
        edad_max:           Number(form.edad_max) || 99,
        cupo_max:           Number(form.cupo_max) || 20,
        color:              form.color,
        activo:             form.activo,
      };

      const db = await supabase.from("clases");
      let saved;
      if (esEdicion) {
        await db.update(clase.id, payload);
        saved = { ...clase, ...payload };
      } else {
        saved = await db.insert(payload);
      }

      // Sincronizar planes vinculados
      if (saved && planes && planes.length > 0) {
        const claseId = String(saved.id || clase?.id);
        for (const plan of planes) {
          const vinculados    = (plan.clases_vinculadas || []).map(String);
          const estaVinculado = vinculados.includes(claseId);
          const debeVincular  = form.planes_ids.includes(String(plan.id));
          if (debeVincular && !estaVinculado) {
            const dbP = await supabase.from("planes_membresia");
            await dbP.update(plan.id, { clases_vinculadas: [...vinculados, claseId] });
          } else if (!debeVincular && estaVinculado) {
            const dbP = await supabase.from("planes_membresia");
            await dbP.update(plan.id, { clases_vinculadas: vinculados.filter(id => id !== claseId) });
          }
        }
      }

      // Guardar nuevos horarios
      const savedHorarios = [];
      if (saved && horariosNuevos.length > 0) {
        const dbH = await supabase.from("horarios");
        const claseId = saved.id || clase?.id;
        for (const h of horariosNuevos) {
          const savedH = await dbH.insert({
            clase_id:    claseId,
            gym_id:      gymId,
            hora_inicio: h.hora_inicio,
            hora_fin:    h.hora_fin,
            dias_semana: h.dias_semana,
            fecha_inicio: h.fecha_inicio || todayISO(),
            fecha_fin:   h.fecha_fin || null,
            activo:      true,
          });
          if (savedH) savedHorarios.push(savedH);
        }
      }

      setSaving(false);
      if (saved) onSave(saved, esEdicion, savedHorarios);
      else setError("Error al guardar. Intenta de nuevo.");
    } catch (e) {
      console.error(e);
      setError("Error inesperado al guardar.");
      setSaving(false);
    }
  };

  // ── Navegación ────────────────────────────────────────────────
  const goNext = () => {
    if (!validarPaso()) return;
    setStep(s => Math.min(s + 1, 3));
  };

  const goPrev = () => {
    setError("");
    setStep(s => Math.max(s - 1, 1));
  };

  const LABELS = ["Datos", "Membresías", "Horarios"];

  // ── Texto del botón principal ─────────────────────────────────
  const nextLabel = step < 3
    ? "Siguiente →"
    : saving
      ? "Guardando..."
      : esEdicion ? "✓ Actualizar clase" : "✓ Crear clase";

  return (
    <div
      style={S.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={S.sheet}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{
              color: "var(--text-primary, #e8e8f0)",
              fontSize: 17, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: form.color || "#6c63ff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>📅</span>
              {esEdicion ? "Editar clase" : "Nueva clase"}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-elevated, #1e1e2e)",
                border: "1px solid var(--border, #2a2a3e)",
                borderRadius: 10, width: 32, height: 32,
                cursor: "pointer", color: "var(--text-primary, #e8e8f0)",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>

          <ProgressBar step={step} labels={LABELS} />
        </div>

        {/* ── Body ── */}
        <div style={S.body}>
          {error && (
            <div style={S.errorBox}>{error}</div>
          )}

          {step === 1 && (
            <Step1Datos
              form={form} set={set}
              miembros={miembros}
              instructores={instructores}
              esEdicion={esEdicion}
            />
          )}
          {step === 2 && (
            <Step2Membresias
              form={form} set={set}
              planes={planes}
            />
          )}
          {step === 3 && (
            <Step3Horarios
              horarios={horariosNuevos}
              setHorarios={setHorariosNuevos}
              color={form.color || "#6c63ff"}
              horariosExistentes={horariosExistentes}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 ? (
              <button onClick={goPrev} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 20px" }}>
                ← Anterior
              </button>
            ) : (
              <button onClick={onClose} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 16px" }}>
                Cancelar
              </button>
            )}
            <button
              onClick={step < 3 ? goNext : handleGuardar}
              disabled={saving}
              style={{
                ...S.btnPrimary,
                opacity: saving ? 0.5 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {nextLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
