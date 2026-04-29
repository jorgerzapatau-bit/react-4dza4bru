// ══════════════════════════════════════════════════════════════════
//  src/screens/HorariosScreen.jsx
//  Gestión de Clases y Horarios — GymFit Pro
//
//  Props recibidos desde GymApp:
//    gymId        string   — ID del gimnasio
//    miembros     array    — lista de miembros (para instructor y alumnos)
//    txs          array    — transacciones (para calcular cupo real pagado)
//    gymConfig    object   — config del gym (nombre, planes, etc.)
//    onAddTx      fn       — callback para guardar una TX de pago al inscribir
//    isOwner      bool     — habilita edición / eliminación
//
//  Tablas Supabase requeridas: clases, horarios, inscripciones
//  (ver gymfit_clases_horarios.sql)
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import { todayISO, fmtDate, calcEdad } from "../utils/dateUtils";
import { Modal, Btn, Inp } from "../components/UI";
import NuevaClaseWizard from "../modals/NuevaClaseWizard";

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

const DIAS_FULL = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };

const COLORES_PRESET = [
  "#6c63ff", "#e040fb", "#f43f5e", "#f59e0b",
  "#10b981", "#3b82f6", "#ec4899", "#f97316",
];

const DURACIONES = [
  { meses: 1,  label: "Mensual"    },
  { meses: 3,  label: "Trimestral" },
  { meses: 6,  label: "Semestral"  },
  { meses: 12, label: "Anual"      },
];

const FORM_CLASE_INICIAL = {
  nombre: "", descripcion: "", instructor_id: "",
  instructor_nombre: "", edad_min: "0", edad_max: "99",
  cupo_max: "20", color: "#6c63ff", activo: true,
  planes_ids: [], // IDs de planes_membresia vinculados
};

const FORM_HORARIO_INICIAL = {
  hora_inicio: "09:00", hora_fin: "10:00",
  dias_semana: [], fecha_inicio: todayISO(), fecha_fin: "",
};

// ── Helpers ───────────────────────────────────────────────────────
const fmt$ = (n) => "$" + Number(n || 0).toLocaleString("es-MX");
const fmtHora = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "p.m." : "a.m.";
  return `${hr % 12 || 12}:${m} ${ampm}`;
};

function avatarIniciales(nombre) {
  if (!nombre) return "?";
  const parts = nombre.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function calcVenceInscripcion(fechaISO, meses) {
  if (!fechaISO) return null;
  const [y, m, d] = fechaISO.split("-").map(Number);
  const v = new Date(y, m - 1 + Number(meses), d);
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
}

// ── Sub-componente: Chip de día ───────────────────────────────────
function DiaChip({ label, activo, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px", border: "none", borderRadius: 8, cursor: "pointer",
        fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: .5,
        transition: "all .15s",
        background: activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
        color: activo ? "#fff" : "var(--text-secondary)",
        boxShadow: activo ? "0 2px 8px rgba(108,99,255,.35)" : "none",
      }}
    >
      {label}
    </button>
  );
}

// ── Sub-componente: Tarjeta de clase ─────────────────────────────
function ClaseCard({ clase, horarios, inscripciones, planes, onSelect }) {
  const horariosClase = horarios.filter(h => h.clase_id === clase.id && h.activo);
  const inscritos = inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa").length;
  const pct = clase.cupo_max > 0 ? Math.round((inscritos / clase.cupo_max) * 100) : 0;
  const cupoColor = pct >= 90 ? "#f87171" : pct >= 70 ? "#f59e0b" : "#4ade80";
  // Planes que incluyen esta clase
  const planesVinculados = (planes || []).filter(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)));

  return (
    <div
      onClick={() => onSelect(clase)}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${clase.color || "#6c63ff"}`,
        borderRadius: "0 18px 18px 0",
        padding: "16px 16px 14px",
        cursor: "pointer",
        transition: "transform .15s, box-shadow .15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Fondo decorativo */}
      <div style={{
        position: "absolute", top: -20, right: -20, width: 80, height: 80,
        borderRadius: "50%", background: clase.color || "#6c63ff", opacity: .06, pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>General</p>
        <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>
          {clase.nombre}
        </h3>
        {clase.descripcion && (
          <p style={{ color: "var(--text-secondary)", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {clase.descripcion}
          </p>
        )}
      </div>

      {/* Horarios */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
        {horariosClase.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Sin horario asignado</p>
        ) : horariosClase.map(h => (
          <div key={h.id} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>🕐</span>
              <span style={{ color: clase.color || "#6c63ff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                {fmtHora(h.hora_inicio)} - {fmtHora(h.hora_fin)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(h.dias_semana || []).map(d => (
                <span key={d} style={{
                  background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 700, letterSpacing: .4,
                }}>
                  {d.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: instructor + cupo */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: `${clase.color || "#6c63ff"}22`,
            color: clase.color || "#6c63ff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700,
          }}>
            {avatarIniciales(clase.instructor_nombre || "?")}
          </div>
          <div>
            <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Titular</p>
            <p style={{ color: "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>
              {clase.instructor_nombre || "Sin asignar"}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Cupo</p>
          <p style={{ color: cupoColor, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {inscritos} / {clase.cupo_max}
          </p>
        </div>
      </div>

      {/* Barra de cupo */}
      <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 2, marginTop: 8 }}>
        <div style={{
          height: "100%", width: `${Math.min(pct, 100)}%`,
          background: cupoColor, borderRadius: 2, transition: "width .4s ease",
        }} />
      </div>

      {/* Planes vinculados */}
      {planesVinculados.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 }}>Planes con acceso</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {planesVinculados.map(p => (
              <span key={p.id} style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                background: "rgba(108,99,255,.12)", color: "#a78bfa",
                border: "1px solid rgba(108,99,255,.2)",
              }}>
                💳 {p.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODAL: Crear / Editar Clase
// ══════════════════════════════════════════════════════════════════
function ModalClase({ clase, gymId, miembros, planes, onSave, onClose }) {
  const esEdicion = !!clase;
  const [form, setForm] = useState(() =>
    clase
      ? {
          nombre: clase.nombre || "", descripcion: clase.descripcion || "",
          instructor_id: clase.instructor_id || "",
          instructor_nombre: clase.instructor_nombre || "",
          edad_min: String(clase.edad_min ?? 0), edad_max: String(clase.edad_max ?? 99),
          cupo_max: String(clase.cupo_max ?? 20),
          color: clase.color || "#6c63ff", activo: clase.activo !== false,
          // Inferir planes vinculados desde planes.clases_vinculadas
          planes_ids: (planes || [])
            .filter(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)))
            .map(p => String(p.id)),
        }
      : { ...FORM_CLASE_INICIAL }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleInstructor = (id) => {
    const m = miembros.find(mb => String(mb.id) === id);
    set("instructor_id", id);
    set("instructor_nombre", m ? m.nombre : "");
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    const payload = {
      gym_id: gymId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      instructor_id: form.instructor_id || null,
      instructor_nombre: form.instructor_nombre || null,
      edad_min: Number(form.edad_min) || 0,
      edad_max: Number(form.edad_max) || 99,
      cupo_max: Number(form.cupo_max) || 20,
      color: form.color,
      activo: form.activo,
    };
    const db = await supabase.from("clases");
    let saved;
    if (esEdicion) {
      await db.update(clase.id, payload);
      saved = { ...clase, ...payload };
    } else {
      saved = await db.insert(payload);
    }
    // Sincronizar planes vinculados: actualizar clases_vinculadas en cada plan
    if (saved && planes && planes.length > 0) {
      const claseId = String(saved.id || clase?.id);
      for (const plan of planes) {
        const vinculados = (plan.clases_vinculadas || []).map(String);
        const estaVinculado = vinculados.includes(claseId);
        const debeVincular = form.planes_ids.includes(String(plan.id));
        if (debeVincular && !estaVinculado) {
          const dbP = await supabase.from("planes_membresia");
          await dbP.update(plan.id, { clases_vinculadas: [...vinculados, claseId] });
        } else if (!debeVincular && estaVinculado) {
          const dbP = await supabase.from("planes_membresia");
          await dbP.update(plan.id, { clases_vinculadas: vinculados.filter(id => id !== claseId) });
        }
      }
    }
    setSaving(false);
    if (saved) onSave(saved, esEdicion);
    else setError("Error al guardar. Intenta de nuevo.");
  };

  return (
    <Modal title={esEdicion ? "Editar clase" : "Nueva clase"} onClose={onClose}>
      {error && (
        <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      <Inp label="Nombre de la clase *" value={form.nombre} onChange={v => set("nombre", v)} placeholder="Ej. Karate Infantil" />
      <Inp label="Descripción" value={form.descripcion} onChange={v => set("descripcion", v)} placeholder="Descripción breve (opcional)" />

      {/* Instructor */}
      <div>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Instructor encargado</p>
        <select
          value={form.instructor_id}
          onChange={e => handleInstructor(e.target.value)}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12 }}
        >
          <option value="">— Sin instructor —</option>
          {miembros.map(m => (
            <option key={m.id} value={String(m.id)}>{m.nombre}</option>
          ))}
        </select>
      </div>

      {/* Edades */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Inp label="Edad mínima" value={form.edad_min} onChange={v => set("edad_min", v)} type="number" placeholder="0" />
        <Inp label="Edad máxima" value={form.edad_max} onChange={v => set("edad_max", v)} type="number" placeholder="99" />
      </div>

      {/* Cupo */}
      <Inp label="Cupo máximo *" value={form.cupo_max} onChange={v => set("cupo_max", v)} type="number" placeholder="20" />

      {/* Selector de planes de membresía */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>
          Planes con acceso
        </p>
        {(!planes || planes.length === 0) ? (
          <div style={{ background: "rgba(108,99,255,.08)", border: "1px dashed rgba(108,99,255,.3)", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ color: "#a78bfa", fontSize: 12, textAlign: "center" }}>
              💳 Primero crea planes en <strong>Membresías</strong> y luego vincúlalos aquí.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {planes.map(p => {
              const seleccionado = form.planes_ids.includes(String(p.id));
              return (
                <button
                  key={p.id}
                  onClick={() => set("planes_ids", seleccionado
                    ? form.planes_ids.filter(id => id !== String(p.id))
                    : [...form.planes_ids, String(p.id)]
                  )}
                  style={{
                    width: "100%", padding: "11px 14px",
                    border: seleccionado ? "2px solid #6c63ff" : "1.5px solid rgba(255,255,255,.08)",
                    borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                    background: seleccionado ? "rgba(108,99,255,.12)" : "var(--bg-elevated)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all .18s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${seleccionado ? "#6c63ff" : "rgba(255,255,255,.2)"}`,
                      background: seleccionado ? "#6c63ff" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {seleccionado && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ color: seleccionado ? "#c4b5fd" : "var(--text-primary)", fontSize: 13, fontWeight: seleccionado ? 700 : 500 }}>
                      {p.nombre}
                    </span>
                  </div>
                  <span style={{
                    background: seleccionado ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.06)",
                    color: seleccionado ? "#c4b5fd" : "var(--text-secondary)",
                    borderRadius: 7, padding: "3px 9px", fontSize: 11, fontWeight: 700,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    ${Number(p.precio_publico || 0).toLocaleString("es-MX")}
                  </span>
                </button>
              );
            })}
            {form.planes_ids.length === 0 && (
              <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
                ⚠️ Sin plan vinculado — cualquier miembro podrá inscribirse sin restricción de membresía.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Color etiqueta */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Color etiqueta</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {COLORES_PRESET.map(c => (
            <button
              key={c} onClick={() => set("color", c)}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                boxShadow: form.color === c ? `0 0 0 3px var(--bg-card), 0 0 0 5px ${c}` : "none",
                transition: "box-shadow .15s",
              }}
            />
          ))}
          <input
            type="color" value={form.color}
            onChange={e => set("color", e.target.value)}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", background: "none", padding: 0 }}
            title="Color personalizado"
          />
        </div>
      </div>

      {/* Activo toggle */}
      {esEdicion && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => set("activo", !form.activo)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: form.activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
              position: "relative", transition: "background .2s", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: form.activo ? 22 : 3, width: 18, height: 18,
              borderRadius: "50%", background: "#fff", transition: "left .2s",
              boxShadow: "0 1px 4px rgba(0,0,0,.25)",
            }} />
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Clase {form.activo ? "activa" : "inactiva"}
          </span>
        </div>
      )}

      <Btn full onClick={handleGuardar} style={{ opacity: saving ? .6 : 1 }}>
        {saving ? "Guardando..." : esEdicion ? "Actualizar clase" : "Crear clase"}
      </Btn>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODAL: Agregar / Editar Horario
// ══════════════════════════════════════════════════════════════════
function ModalHorario({ horario, claseId, gymId, onSave, onClose }) {
  const esEdicion = !!horario;
  const [form, setForm] = useState(() =>
    horario
      ? {
          hora_inicio: horario.hora_inicio || "09:00",
          hora_fin: horario.hora_fin || "10:00",
          dias_semana: horario.dias_semana || [],
          fecha_inicio: horario.fecha_inicio || todayISO(),
          fecha_fin: horario.fecha_fin || "",
        }
      : { ...FORM_HORARIO_INICIAL }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleDia = (dia) => {
    setForm(p => ({
      ...p,
      dias_semana: p.dias_semana.includes(dia)
        ? p.dias_semana.filter(d => d !== dia)
        : [...p.dias_semana, dia],
    }));
  };

  const handleGuardar = async () => {
    if (form.dias_semana.length === 0) { setError("Selecciona al menos un día."); return; }
    if (!form.hora_inicio || !form.hora_fin) { setError("Hora de inicio y fin son obligatorias."); return; }
    if (form.hora_fin <= form.hora_inicio) { setError("La hora de fin debe ser posterior al inicio."); return; }
    setSaving(true);
    setError("");
    const payload = {
      clase_id: claseId, gym_id: gymId,
      hora_inicio: form.hora_inicio, hora_fin: form.hora_fin,
      dias_semana: form.dias_semana,
      fecha_inicio: form.fecha_inicio || todayISO(),
      fecha_fin: form.fecha_fin || null,
      activo: true,
    };
    const db = await supabase.from("horarios");
    let saved;
    if (esEdicion) {
      await db.update(horario.id, payload);
      saved = { ...horario, ...payload };
    } else {
      saved = await db.insert(payload);
    }
    setSaving(false);
    if (saved) onSave(saved, esEdicion);
    else setError("Error al guardar. Intenta de nuevo.");
  };

  return (
    <Modal title={esEdicion ? "Editar horario" : "Nuevo horario"} onClose={onClose}>
      {error && (
        <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Días de la semana */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Días de entrenamiento *</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIAS.map(d => (
            <DiaChip key={d.key} label={d.label} activo={form.dias_semana.includes(d.key)} onClick={() => toggleDia(d.key)} />
          ))}
        </div>
      </div>

      {/* Horario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Inicio</p>
          <input
            type="time" value={form.hora_inicio}
            onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12 }}
          />
        </div>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Final</p>
          <input
            type="time" value={form.hora_fin}
            onChange={e => setForm(p => ({ ...p, hora_fin: e.target.value }))}
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12 }}
          />
        </div>
      </div>

      {/* Vigencia */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Inp label="Desde" value={form.fecha_inicio} onChange={v => setForm(p => ({ ...p, fecha_inicio: v }))} type="date" />
        <Inp label="Hasta (opcional)" value={form.fecha_fin} onChange={v => setForm(p => ({ ...p, fecha_fin: v }))} type="date" placeholder="Sin fecha fin" />
      </div>

      <Btn full onClick={handleGuardar} style={{ marginTop: 4, opacity: saving ? .6 : 1 }}>
        {saving ? "Guardando..." : esEdicion ? "Actualizar horario" : "Agregar horario"}
      </Btn>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODAL: Inscribir miembro a clase
// ══════════════════════════════════════════════════════════════════
function ModalInscribir({ clase, gymId, miembros, inscripciones, planes, onSave, onClose }) {
  const [busqueda, setBusqueda] = useState("");
  const [selMiembro, setSelMiembro] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [advertenciaEdad, setAdvertenciaEdad] = useState("");
  const [showTodos, setShowTodos] = useState(false);

  const inscritos = inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa");
  const cupoDisponible = clase.cupo_max - inscritos.length;
  const yaInscritos = new Set(inscritos.map(i => String(i.miembro_id)));

  // Planes vinculados a esta clase
  const planesVinculados = (planes || []).filter(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id)) && p.activo
  );
  const planesIds = new Set(planesVinculados.map(p => String(p.id)));

  // Clasifica cada miembro
  const clasificarMiembro = (m) => {
    if (yaInscritos.has(String(m.id))) return "inscrito";
    // Verificar edad
    let bloqueadoEdad = false;
    if (m.fecha_nacimiento) {
      const edad = calcEdad(m.fecha_nacimiento);
      if (edad !== null && (edad < clase.edad_min || edad > clase.edad_max)) bloqueadoEdad = true;
    }
    // Verificar membresía activa vinculada: el miembro tiene un plan activo que cubre esta clase
    // Se infiere desde txs/inscripciones — simplificado: si el miembro tiene plan_id en su perfil
    const tienePlan = planesIds.size === 0 || (m.plan_id && planesIds.has(String(m.plan_id)));
    return { bloqueadoEdad, tienePlan };
  };

  const miembrosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return miembros
      .filter(m => !yaInscritos.has(String(m.id)))
      .filter(m => !q || m.nombre.toLowerCase().includes(q) || (m.tel || "").includes(q))
      .slice(0, 10);
  }, [miembros, busqueda, yaInscritos]); // eslint-disable-line

  const handleSeleccionar = (m) => {
    setSelMiembro(m);
    setBusqueda(m.nombre);
    if (m.fecha_nacimiento) {
      const edad = calcEdad(m.fecha_nacimiento);
      if (edad !== null) {
        if (edad < clase.edad_min) setAdvertenciaEdad(`⚠️ ${m.nombre.split(" ")[0]} tiene ${edad} años — mínimo requerido: ${clase.edad_min}.`);
        else if (edad > clase.edad_max) setAdvertenciaEdad(`⚠️ ${m.nombre.split(" ")[0]} tiene ${edad} años — máximo permitido: ${clase.edad_max}.`);
        else setAdvertenciaEdad("");
      } else setAdvertenciaEdad("");
    } else setAdvertenciaEdad("");
  };

  const handleInscribir = async () => {
    if (!selMiembro) { setError("Selecciona un miembro."); return; }
    if (cupoDisponible <= 0) { setError("La clase está llena."); return; }
    setSaving(true);
    setError("");

    const insDb = await supabase.from("inscripciones");
    const insSaved = await insDb.insert({
      gym_id: gymId,
      miembro_id: selMiembro.id,
      clase_id: clase.id,
      fecha_inscripcion: todayISO(),
      estado: "activa",
    });

    setSaving(false);
    if (insSaved) onSave(insSaved, null);
    else setError("Error al inscribir. Intenta de nuevo.");
  };

  return (
    <Modal title={`Inscribir a ${clase.nombre}`} onClose={onClose}>
      {/* Info cupo */}
      <div style={{
        background: `${clase.color || "#6c63ff"}14`,
        border: `1px solid ${clase.color || "#6c63ff"}30`,
        borderRadius: 12, padding: "10px 16px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Cupo disponible</p>
          <p style={{ color: cupoDisponible > 0 ? "#4ade80" : "#f87171", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {cupoDisponible} / {clase.cupo_max}
          </p>
        </div>
        {(clase.edad_min > 0 || clase.edad_max < 99) && (
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Rango de edad</p>
            <p style={{ color: clase.color || "#6c63ff", fontSize: 16, fontWeight: 700 }}>
              {clase.edad_min}–{clase.edad_max} años
            </p>
          </div>
        )}
      </div>

      {/* Info membresía requerida */}
      {planesVinculados.length > 0 && (
        <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 600, margin: "0 0 4px" }}>💳 Requiere membresía activa:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {planesVinculados.map(p => (
              <span key={p.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "rgba(108,99,255,.15)", color: "#c4b5fd" }}>{p.nombre}</span>
            ))}
          </div>
        </div>
      )}

      {cupoDisponible <= 0 && (
        <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12, textAlign: "center" }}>
          🚫 Esta clase está llena.
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {advertenciaEdad && (
        <div style={{ background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f59e0b", fontSize: 12 }}>
          {advertenciaEdad}
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: 16, position: "relative" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Buscar miembro</p>
        <input
          type="text" value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setSelMiembro(null); setAdvertenciaEdad(""); }}
          placeholder="Nombre o teléfono..."
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
        {busqueda && !selMiembro && miembrosFiltrados.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.25)", overflow: "hidden", marginTop: 4,
          }}>
            {miembrosFiltrados.map(m => {
              const edad = m.fecha_nacimiento ? calcEdad(m.fecha_nacimiento) : null;
              const edadOk = edad === null || (edad >= clase.edad_min && edad <= clase.edad_max);
              const tienePlan = planesIds.size === 0 || (m.plan_id && planesIds.has(String(m.plan_id)));
              return (
                <button key={m.id} onClick={() => handleSeleccionar(m)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", border: "none", background: "transparent",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    borderBottom: "1px solid var(--border)",
                    opacity: (!edadOk || !tienePlan) ? .5 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#6c63ff33,#e040fb33)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#a78bfa", fontWeight: 700, fontSize: 12, overflow: "hidden",
                  }}>
                    {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatarIniciales(m.nombre)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                      {edad !== null ? `${edad} años` : "Sin edad"}
                      {!edadOk && <span style={{ color: "#f87171" }}> · Edad fuera de rango</span>}
                      {edadOk && !tienePlan && planesIds.size > 0 && <span style={{ color: "#f59e0b" }}> · Sin membresía</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {busqueda && !selMiembro && miembrosFiltrados.length === 0 && (
          <p style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 6 }}>Sin resultados.</p>
        )}
      </div>

      {/* Resumen */}
      {selMiembro && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Resumen de inscripción</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Miembro</span>
            <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>{selMiembro.nombre}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Clase</span>
            <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>{clase.nombre}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Fecha</span>
            <span style={{ color: "var(--text-primary)", fontSize: 12 }}>{fmtDate(todayISO())}</span>
          </div>
        </div>
      )}

      <Btn full onClick={handleInscribir} style={{ opacity: (saving || cupoDisponible <= 0) ? .5 : 1 }}>
        {saving ? "Inscribiendo..." : "Inscribir alumno"}
      </Btn>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODAL: Detalle de clase — lista de alumnos + horarios
// ══════════════════════════════════════════════════════════════════
function ModalDetalle({ clase, horarios, inscripciones, miembros, gymId, isOwner, planes, onEditClase, onAgregarHorario, onEditHorario, onEliminarHorario, onInscribir, onDarBaja, onClose }) {
  const horariosClase = horarios.filter(h => h.clase_id === clase.id);
  const inscritosClase = inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa");
  const inscritos = inscritosClase.map(ins => ({
    ...ins,
    miembro: miembros.find(m => String(m.id) === String(ins.miembro_id)),
  })).filter(i => i.miembro);
  const planesVinculados = (planes || []).filter(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)));

  const [tabActiva, setTabActiva] = useState("alumnos");

  return (
    <Modal title={clase.nombre} onClose={onClose}>
      {/* Header info */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{
          background: `${clase.color || "#6c63ff"}20`,
          color: clase.color || "#6c63ff",
          borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700,
        }}>
          {inscritosClase.length} / {clase.cupo_max} alumnos
        </span>
        <span style={{ background: "rgba(74,222,128,.12)", color: "#4ade80", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
          {planesVinculados.length > 0
            ? `💳 ${planesVinculados.length} plan${planesVinculados.length !== 1 ? "es" : ""}`
            : "Sin plan vinculado"
          }
        </span>
        {clase.edad_min > 0 || clase.edad_max < 99 ? (
          <span style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", borderRadius: 8, padding: "4px 10px", fontSize: 11 }}>
            {clase.edad_min}–{clase.edad_max} años
          </span>
        ) : null}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { k: "alumnos", l: `Alumnos (${inscritos.length})` },
          { k: "horarios", l: `Horarios (${horariosClase.length})` },
          { k: "membresias", l: `Membresías (${planesVinculados.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTabActiva(t.k)}
            style={{
              flex: 1, padding: "8px", border: "none", borderRadius: 10, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: tabActiva === t.k ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
              color: tabActiva === t.k ? "#fff" : "var(--text-secondary)",
            }}
          >{t.l}</button>
        ))}
      </div>

      {/* Tab: Alumnos */}
      {tabActiva === "alumnos" && (
        <>
          {isOwner && (
            <button
              onClick={onInscribir}
              style={{
                width: "100%", marginBottom: 12, padding: "11px", border: "none", borderRadius: 12,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                boxShadow: "0 3px 14px rgba(108,99,255,.35)",
              }}
            >
              + Inscribir miembro
            </button>
          )}
          {inscritos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎓</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Sin alumnos inscritos</p>
            </div>
          ) : inscritos.map(ins => {
            const m = ins.miembro;
            const edad = m.fecha_nacimiento ? calcEdad(m.fecha_nacimiento) : null;
            const venceProx = ins.fecha_vencimiento ? fmtDate(ins.fecha_vencimiento) : "—";
            return (
              <div key={ins.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 14, marginBottom: 8,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                  background: `${clase.color || "#6c63ff"}22`,
                  color: clase.color || "#6c63ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatarIniciales(m.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.nombre}</p>
                  <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    {edad !== null ? `${edad} años · ` : ""}Vence: {venceProx}
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => onDarBaja(ins)}
                    style={{ border: "none", background: "rgba(248,113,113,.12)", color: "#f87171", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                  >
                    Dar baja
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Tab: Horarios */}
      {tabActiva === "horarios" && (
        <>
          {isOwner && (
            <button
              onClick={onAgregarHorario}
              style={{
                width: "100%", marginBottom: 12, padding: "11px", border: "1.5px dashed var(--border-strong)", borderRadius: 12,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                background: "transparent", color: "var(--text-secondary)",
              }}
            >
              + Agregar horario
            </button>
          )}
          {horariosClase.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📅</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Sin horarios configurados</p>
            </div>
          ) : horariosClase.map(h => (
            <div key={h.id} style={{
              padding: "12px 14px", borderRadius: 14, marginBottom: 8,
              background: "var(--bg-elevated)", border: `1px solid ${h.activo ? "var(--border)" : "rgba(248,113,113,.2)"}`,
              opacity: h.activo ? 1 : .6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: clase.color || "#6c63ff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
                    {fmtHora(h.hora_inicio)} — {fmtHora(h.hora_fin)}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {(h.dias_semana || []).map(d => (
                      <span key={d} style={{ background: `${clase.color || "#6c63ff"}18`, color: clase.color || "#6c63ff", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                        {DIAS_FULL[d] || d}
                      </span>
                    ))}
                  </div>
                  {h.fecha_fin && (
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      Hasta {fmtDate(h.fecha_fin)}
                    </p>
                  )}
                </div>
                {isOwner && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onEditHorario(h)}
                      style={{ border: "none", background: "var(--bg-elevated)", color: "var(--text-secondary)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                      ✏️
                    </button>
                    <button onClick={() => onEliminarHorario(h)}
                      style={{ border: "none", background: "rgba(248,113,113,.12)", color: "#f87171", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Tab: Membresías */}
      {tabActiva === "membresias" && (
        <>
          <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ color: "#a78bfa", fontSize: 12, margin: 0 }}>💳 Planes de membresía que incluyen acceso a esta clase.</p>
          </div>
          {planesVinculados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Ningún plan vinculado aún.</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 4 }}>Usa el botón <strong>✏️ Editar clase</strong> para vincular planes de membresía.</p>
            </div>
          ) : planesVinculados.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 13px", borderRadius: 12, marginBottom: 8,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "linear-gradient(135deg,rgba(108,99,255,.25),rgba(224,64,251,.2))",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>💳</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.nombre}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: "2px 0 0" }}>
                  ${Number(p.precio_publico).toLocaleString()} · {p.ciclo_renovacion}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: p.activo ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.1)",
                color: p.activo ? "#4ade80" : "#f87171",
              }}>{p.activo ? "Activo" : "Inactivo"}</span>
            </div>
          ))}
        </>
      )}

      {/* Botón editar clase */}
      {isOwner && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button
            onClick={onEditClase}
            style={{
              width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: 12,
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            }}
          >
            ⚙️ Editar datos de la clase
          </button>
        </div>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function HorariosScreen({ gymId, miembros, txs, gymConfig, onAddTx, isOwner, planes: planesProp }) {

  // ── Estado de datos ──────────────────────────────────────────────
  const [clases, setClases]               = useState([]);
  const [horarios, setHorarios]           = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [planes, setPlanes]               = useState(planesProp || []);
  const [instructores, setInstructores]   = useState([]);
  const [loading, setLoading]             = useState(true);

  // ── Estado de UI ─────────────────────────────────────────────────
  const [busqueda, setBusqueda]           = useState("");
  const [filtroDia, setFiltroDia]         = useState("todos");
  const [viewMode, setViewMode]           = useState("lista"); // "lista" | "calendario"

  // ── Modales ──────────────────────────────────────────────────────
  const [modalClase, setModalClase]                 = useState(null);  // null | "nueva" | clase (edición)
  const [modalHorario, setModalHorario]             = useState(null);  // null | { clase, horario? }
  const [modalDetalle, setModalDetalle]             = useState(null);  // null | clase
  const [modalInscribir, setModalInscribir]         = useState(null);  // null | clase
  const [confirmDarBaja, setConfirmDarBaja]         = useState(null);  // null | inscripcion

  // ── Cargar datos ─────────────────────────────────────────────────
  const loadDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [dbC, dbH, dbI, dbP, dbInst] = await Promise.all([
        supabase.from("clases"),
        supabase.from("horarios"),
        supabase.from("inscripciones"),
        supabase.from("planes_membresia"),
        supabase.from("instructores"),
      ]);
      const [cData, hData, iData, pData, instData] = await Promise.all([
        dbC.select(gymId),
        dbH.select(gymId),
        dbI.select(gymId),
        dbP.select(gymId),
        dbInst.select(gymId),
      ]);
      setClases(cData || []);
      setHorarios(hData || []);
      setInscripciones(iData || []);
      setPlanes(pData || []);
      setInstructores((instData || []).filter(i => i.activo !== false));
    } catch (e) {
      console.error("Error cargando horarios:", e);
    }
    setLoading(false);
  }, [gymId]);

  useEffect(() => { loadDatos(); }, [loadDatos]);

  // ── Métricas de resumen ──────────────────────────────────────────
  const stats = useMemo(() => {
    const clasesActivas = clases.filter(c => c.activo);
    const totalInscritos = inscripciones.filter(i => i.estado === "activa").length;
    const totalCupo = clasesActivas.reduce((s, c) => s + (c.cupo_max || 0), 0);

    // Clase con más alumnos (para "día de mayor flujo" o clase más popular)
    const conteoPorClase = {};
    inscripciones.filter(i => i.estado === "activa").forEach(i => {
      conteoPorClase[i.clase_id] = (conteoPorClase[i.clase_id] || 0) + 1;
    });
    const masPopularId = Object.entries(conteoPorClase).sort((a, b) => b[1] - a[1])[0]?.[0];
    const masPopular = clases.find(c => c.id === masPopularId);

    return { clasesActivas: clasesActivas.length, totalInscritos, totalCupo, masPopular };
  }, [clases, inscripciones]);

  // ── Filtrado de clases ───────────────────────────────────────────
  const clasesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return clases.filter(c => {
      if (!c.activo && !isOwner) return false;
      const matchQ = !q || c.nombre.toLowerCase().includes(q) || (c.instructor_nombre || "").toLowerCase().includes(q);
      if (!matchQ) return false;
      if (filtroDia === "todos") return true;
      // Tiene algún horario en ese día
      return horarios.some(h => h.clase_id === c.id && h.activo && (h.dias_semana || []).includes(filtroDia));
    });
  }, [clases, horarios, busqueda, filtroDia, isOwner]);

  // ── Handlers de guardado ─────────────────────────────────────────

  const handleGuardarClase = (saved, esEdicion) => {
    if (esEdicion) {
      setClases(p => p.map(c => c.id === saved.id ? saved : c));
      if (modalDetalle?.id === saved.id) setModalDetalle(saved);
    } else {
      setClases(p => [...p, saved]);
    }
    setModalClase(null);
  };

  const handleGuardarHorario = (saved, esEdicion) => {
    if (esEdicion) {
      setHorarios(p => p.map(h => h.id === saved.id ? saved : h));
    } else {
      setHorarios(p => [...p, saved]);
    }
    setModalHorario(null);
  };

  const handleEliminarHorario = async (horario) => {
    if (!window.confirm("¿Eliminar este horario? Esta acción no se puede deshacer.")) return;
    const db = await supabase.from("horarios");
    await db.delete(horario.id);
    setHorarios(p => p.filter(h => h.id !== horario.id));
  };

  const handleInscribir = async (inscripcion, tx) => {
    setInscripciones(p => [...p, inscripcion]);
    // Notificar a GymApp para que actualice el estado global de txs
    if (onAddTx && tx) {
      onAddTx({
        id: tx.id, tipo: "ingreso", categoria: "Membresías",
        desc: tx.descripcion, descripcion: tx.descripcion,
        monto: tx.monto, fecha: tx.fecha, miembroId: tx.miembro_id,
      });
    }
    setModalInscribir(null);
  };

  const handleDarBaja = async (inscripcion) => {
    const db = await supabase.from("inscripciones");
    await db.update(inscripcion.id, { estado: "baja" });
    setInscripciones(p => p.map(i => i.id === inscripcion.id ? { ...i, estado: "baja" } : i));
    setConfirmDarBaja(null);
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {/* Título + acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>📅</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                Gestión de <span style={{ background: "linear-gradient(90deg,#6c63ff,#e040fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Horarios</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>Sincronización de clases y grupos operativos</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Vista calendario/lista */}
              <button
                onClick={() => setViewMode(v => v === "lista" ? "calendario" : "lista")}
                style={{
                  border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)",
                  color: "var(--text-secondary)", cursor: "pointer", padding: "8px 12px", fontSize: 11, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {viewMode === "lista" ? "📅 Calendario" : "☰ Lista"}
              </button>
              {isOwner && (
                <button
                  onClick={() => setModalClase("nueva")}
                  style={{
                    border: "none", borderRadius: 12, padding: "8px 16px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                    background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                    boxShadow: "0 3px 14px rgba(108,99,255,.35)",
                  }}
                >
                  + Nueva clase
                </button>
              )}
            </div>
          </div>

          {/* ── Métricas ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Clases activas",    val: stats.clasesActivas, icon: "📚", color: "var(--text-primary)" },
              { label: "Instructores",      val: instructores.length, icon: "👤", color: "#4ade80" },
              { label: "Alumnos inscritos", val: stats.totalInscritos, icon: "👥", color: "#f59e0b" },
              { label: "Clase más popular", val: stats.masPopular?.nombre || "N/A", icon: "🏆", color: "#f87171", small: true },
            ].map((s, i) => (
              <div key={i} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 16, padding: "12px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: s.small ? 13 : 22, fontWeight: 700, fontFamily: s.small ? "inherit" : "'DM Mono',monospace", lineHeight: 1 }}>
                    {s.val}
                  </p>
                </div>
                <span style={{ fontSize: 22, opacity: .5 }}>{s.icon}</span>
              </div>
            ))}
          </div>

          {/* ── Búsqueda + filtros ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-tertiary)", pointerEvents: "none" }}>🔍</span>
              <input
                type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por clase, instructor..."
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px 10px 34px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              {busqueda && (
                <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>✕</button>
              )}
            </div>
            {/* Filtro por sede (futuro) — por ahora muestra gym */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px",
              color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
            }}>
              📍 <span>{gymConfig?.nombre || "Sede principal"}</span>
            </div>
          </div>

          {/* Filtros por día */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginTop: 10 }}>
            <button
              onClick={() => setFiltroDia("todos")}
              style={{
                flexShrink: 0, padding: "5px 14px", border: "none", borderRadius: 20, cursor: "pointer",
                fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                background: filtroDia === "todos" ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
                color: filtroDia === "todos" ? "#fff" : "var(--text-secondary)",
              }}
            >
              Todos
            </button>
            {DIAS.map(d => (
              <button key={d.key} onClick={() => setFiltroDia(d.key)}
                style={{
                  flexShrink: 0, padding: "5px 14px", border: "none", borderRadius: 20, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  background: filtroDia === d.key ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
                  color: filtroDia === d.key ? "#fff" : "var(--text-secondary)",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "14px 20px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(108,99,255,.2)", borderTopColor: "#6c63ff", margin: "0 auto 14px", animation: "spin .8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Cargando clases...</p>
            </div>
          ) : clasesFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>📭</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {busqueda || filtroDia !== "todos" ? "Sin resultados para este filtro" : "Aún no hay clases creadas"}
              </p>
              {isOwner && !busqueda && filtroDia === "todos" && (
                <button
                  onClick={() => setModalClase("nueva")}
                  style={{
                    marginTop: 12, border: "none", borderRadius: 12, padding: "10px 22px",
                    cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                  }}
                >
                  + Crear primera clase
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14, paddingBottom: 24,
            }}>
              {clasesFiltradas.map(c => (
                <ClaseCard
                  key={c.id}
                  clase={c}
                  horarios={horarios}
                  inscripciones={inscripciones}
                  planes={planes}
                  onSelect={setModalDetalle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALES ═══ */}

      {/* Nueva / Editar clase — Wizard 3 pasos */}
      {modalClase && (
        <NuevaClaseWizard
          clase={modalClase === "nueva" ? null : modalClase}
          gymId={gymId}
          miembros={miembros}
          instructores={instructores}
          planes={planes}
          horariosExistentes={
            modalClase !== "nueva"
              ? horarios.filter(h => h.clase_id === modalClase.id)
              : []
          }
          onSave={(saved, esEdicion, horariosGuardados) => {
            if (esEdicion) {
              setClases(p => p.map(c => c.id === saved.id ? saved : c));
              if (modalDetalle?.id === saved.id) setModalDetalle(saved);
            } else {
              setClases(p => [...p, saved]);
            }
            // Agregar horarios nuevos al estado local
            if (horariosGuardados && horariosGuardados.length > 0) {
              setHorarios(p => [...p, ...horariosGuardados]);
            }
            setModalClase(null);
          }}
          onClose={() => setModalClase(null)}
        />
      )}

      {/* Detalle de clase */}
      {modalDetalle && (
        <ModalDetalle
          clase={modalDetalle}
          horarios={horarios}
          inscripciones={inscripciones}
          miembros={miembros}
          gymId={gymId}
          isOwner={isOwner}
          planes={planes}
          onEditClase={() => { setModalClase(modalDetalle); setModalDetalle(null); }}
          onAgregarHorario={() => setModalHorario({ clase: modalDetalle, horario: null })}
          onEditHorario={h => setModalHorario({ clase: modalDetalle, horario: h })}
          onEliminarHorario={handleEliminarHorario}
          onInscribir={() => setModalInscribir(modalDetalle)}
          onDarBaja={ins => setConfirmDarBaja(ins)}
          onClose={() => setModalDetalle(null)}
        />
      )}

      {/* Agregar / editar horario */}
      {modalHorario && (
        <ModalHorario
          horario={modalHorario.horario}
          claseId={modalHorario.clase.id}
          gymId={gymId}
          onSave={handleGuardarHorario}
          onClose={() => setModalHorario(null)}
        />
      )}

      {/* Inscribir miembro */}
      {modalInscribir && (
        <ModalInscribir
          clase={modalInscribir}
          gymId={gymId}
          miembros={miembros}
          inscripciones={inscripciones}
          planes={planes}
          onSave={handleInscribir}
          onClose={() => setModalInscribir(null)}
        />
      )}

      {/* Confirmación dar de baja */}
      {confirmDarBaja && (() => {
        const m = miembros.find(mb => String(mb.id) === String(confirmDarBaja.miembro_id));
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
            zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "28px 24px", maxWidth: 340, width: "100%", textAlign: "center" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>⚠️</p>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>¿Dar de baja?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
                {m?.nombre || "Este miembro"} será dado de baja de la clase. Puedes reinscribirlo en cualquier momento.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDarBaja(null)}
                  style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 12, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={() => handleDarBaja(confirmDarBaja)}
                  style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  Dar de baja
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
