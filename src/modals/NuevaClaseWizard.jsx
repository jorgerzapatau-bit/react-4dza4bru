// src/modals/NuevaClaseWizard.jsx
// ══════════════════════════════════════════════════════════════════
//  Wizard 2 pasos para crear (o editar) una clase:
//  [1 Datos + Horario] → [2 Precio de membresía]
//
//  Al guardar: crea/actualiza automáticamente un plan en
//  planes_membresia vinculado 1:1 con esta clase.
//  El usuario nunca ve "planes" — solo define el precio de su clase.
// ══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { supabase } from "../supabase";
import { todayISO } from "../utils/dateUtils";
import InstructorSelect from "../components/InstructorSelect";

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

const CICLOS = [
  { value: "mensual",     label: "Mensual",     meses: 1  },
  { value: "trimestral",  label: "Trimestral",  meses: 3  },
  { value: "semestral",   label: "Semestral",   meses: 6  },
  { value: "anual",       label: "Anual",       meses: 12 },
];

const S = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,.75)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: 540, maxHeight: "95vh",
    background: "var(--bg-card, #12121f)",
    borderRadius: "22px 22px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,.55)",
  },
  header: { padding: "18px 20px 0", flexShrink: 0 },
  body:   { flex: 1, overflowY: "auto", padding: "16px 20px" },
  footer: { padding: "12px 20px 20px", flexShrink: 0, borderTop: "1px solid var(--border, #2a2a3e)" },
  inp: {
    width: "100%", background: "var(--bg-elevated, #1e1e2e)",
    border: "1px solid var(--border-strong, #2e2e42)",
    borderRadius: 12, padding: "12px 14px",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  },
  label: {
    color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5, display: "block",
  },
  field: { marginBottom: 14 },
  btnPrimary: {
    flex: 1, padding: "14px", border: "none", borderRadius: 14,
    background: "linear-gradient(135deg,#6c63ff,#e040fb)",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 18px rgba(108,99,255,.35)", transition: "all .2s",
  },
  btnSecondary: {
    flex: 1, padding: "14px",
    border: "1.5px solid var(--border-strong, #2e2e42)", borderRadius: 14,
    background: "var(--bg-elevated, #1e1e2e)",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s",
  },
  errorBox: {
    background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 12, marginBottom: 14,
  },
};

function ProgressBar({ step }) {
  const labels = ["Datos y horario", "Precio"];
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        {labels.map((_, i) => {
          const idx = i + 1;
          const done = step > idx; const active = step === idx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12,
                background: done ? "#4ade80" : active ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated, #1e1e2e)",
                color: done || active ? "#fff" : "var(--text-tertiary, #6b6b8a)",
                border: active || done ? "none" : "1.5px solid var(--border-strong, #2e2e42)",
                boxShadow: active ? "0 0 0 3px rgba(108,99,255,.25)" : "none",
                transition: "all .3s",
              }}>{done ? "✓" : idx}</div>
              {i < labels.length - 1 && (
                <div style={{ flex: 1, height: 2, margin: "0 2px", background: done ? "#4ade80" : "var(--border-strong, #2e2e42)", transition: "background .3s" }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {labels.map((l, i) => (
          <p key={i} style={{
            flex: 1, textAlign: i === 0 ? "left" : "right",
            fontSize: 10, fontWeight: step === i + 1 ? 700 : 400,
            color: step === i + 1 ? "var(--text-primary, #e8e8f0)" : "var(--text-tertiary, #6b6b8a)",
            transition: "color .3s",
          }}>{l}</p>
        ))}
      </div>
    </div>
  );
}

function DiaChip({ label, activo, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 11px", border: "none", borderRadius: 8,
      cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      transition: "all .15s",
      background: activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated, #1e1e2e)",
      color: activo ? "#fff" : "var(--text-secondary, #9999b3)",
      boxShadow: activo ? "0 2px 8px rgba(108,99,255,.35)" : "none",
    }}>{label}</button>
  );
}

// ── PASO 1: Datos generales + Horario ─────────────────────────────
function Step1DatosHorario({ form, set, miembros, instructores, esEdicion }) {
  const fmtHoraPreview = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
  };

  return (
    <div>
      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
        Información general
      </p>

      <div style={S.field}>
        <label style={S.label}>Nombre de la clase *</label>
        <input type="text" value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. Karate Infantil" style={S.inp} />
      </div>

      <div style={S.field}>
        <label style={S.label}>Descripción</label>
        <input type="text" value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Descripción breve (opcional)" style={S.inp} />
      </div>

      <div style={S.field}>
        <label style={S.label}>Instructor encargado</label>
        <InstructorSelect
          instructores={instructores && instructores.length > 0
            ? instructores
            : miembros.map(m => ({ id: m.id, nombre: m.nombre, foto: m.foto || null, especialidad: null }))
          }
          value={form.instructor_id}
          onChange={(id, nombre) => { set("instructor_id", id); set("instructor_nombre", nombre); }}
          color={form.color || "#6c63ff"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div><label style={S.label}>Edad mínima</label><input type="number" value={form.edad_min} min={0} max={99} onChange={e => set("edad_min", e.target.value)} style={S.inp} /></div>
        <div><label style={S.label}>Edad máxima</label><input type="number" value={form.edad_max} min={0} max={99} onChange={e => set("edad_max", e.target.value)} style={S.inp} /></div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Cupo máximo *</label>
        <input type="number" value={form.cupo_max} min={1} onChange={e => set("cupo_max", e.target.value)} style={S.inp} />
      </div>

      <div style={S.field}>
        <label style={S.label}>Color etiqueta</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {COLORES_PRESET.map(c => (
            <button key={c} onClick={() => set("color", c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: "none", cursor: "pointer", flexShrink: 0, boxShadow: form.color === c ? `0 0 0 3px var(--bg-card, #12121f), 0 0 0 5px ${c}` : "none", transition: "box-shadow .15s" }} />
          ))}
          <input type="color" value={form.color} onChange={e => set("color", e.target.value)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer", background: "none", padding: 0 }} />
        </div>
        <div style={{ marginTop: 10, padding: "10px 14px", borderLeft: `4px solid ${form.color}`, borderRadius: "0 10px 10px 0", background: `${form.color}10` }}>
          <p style={{ color: form.color, fontSize: 13, fontWeight: 700 }}>{form.nombre || "Vista previa"}</p>
          {form.descripcion && <p style={{ color: "var(--text-secondary, #9999b3)", fontSize: 11, marginTop: 2 }}>{form.descripcion}</p>}
        </div>
      </div>

      {esEdicion && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={() => set("activo", !form.activo)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: form.activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated, #1e1e2e)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 3, left: form.activo ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
          </button>
          <span style={{ color: "var(--text-secondary, #9999b3)", fontSize: 13 }}>Clase {form.activo ? "activa" : "inactiva"}</span>
        </div>
      )}

      <div style={{ height: 1, background: "var(--border, #2a2a3e)", margin: "4px 0 18px" }} />

      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
        Horario de la clase
      </p>

      <div style={S.field}>
        <label style={S.label}>Días de entrenamiento *</label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {DIAS.map(d => (
            <DiaChip key={d.key} label={d.label} activo={(form.dias_semana || []).includes(d.key)} onClick={() => {
              const dias = form.dias_semana || [];
              set("dias_semana", dias.includes(d.key) ? dias.filter(x => x !== d.key) : [...dias, d.key]);
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div><label style={S.label}>Hora inicio</label><input type="time" value={form.hora_inicio || "09:00"} onChange={e => set("hora_inicio", e.target.value)} style={S.inp} /></div>
        <div><label style={S.label}>Hora fin</label><input type="time" value={form.hora_fin || "10:00"} onChange={e => set("hora_fin", e.target.value)} style={S.inp} /></div>
      </div>

      {(form.dias_semana || []).length > 0 && form.hora_inicio && form.hora_fin && (
        <div style={{ padding: "10px 14px", background: `${form.color || "#6c63ff"}10`, border: `1px solid ${form.color || "#6c63ff"}30`, borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🕐</span>
          <span style={{ color: form.color || "#6c63ff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {fmtHoraPreview(form.hora_inicio)} — {fmtHoraPreview(form.hora_fin)}
          </span>
          <span style={{ color: "var(--text-secondary, #9999b3)", fontSize: 12 }}>· {(form.dias_semana || []).length} día{(form.dias_semana || []).length !== 1 ? "s" : ""}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={S.label}>Vigencia desde</label><input type="date" value={form.fecha_inicio || todayISO()} onChange={e => set("fecha_inicio", e.target.value)} style={S.inp} /></div>
        <div><label style={S.label}>Hasta (opcional)</label><input type="date" value={form.fecha_fin || ""} onChange={e => set("fecha_fin", e.target.value)} style={S.inp} /></div>
      </div>
    </div>
  );
}

// ── PASO 2: Precio de la membresía de esta clase ──────────────────
function Step2Precio({ form, set }) {
  const cicloActual = CICLOS.find(c => c.value === form.ciclo_renovacion) || CICLOS[0];
  const precioNum = Number(form.precio_membresia || 0);
  const tieneGracia = form.dias_gracia > 0;

  return (
    <div>
      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
        Define cuánto paga un alumno por inscribirse a esta clase. Se creará automáticamente la membresía correspondiente.
      </p>

      {/* Precio */}
      <div style={S.field}>
        <label style={S.label}>Precio de la membresía *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary, #9999b3)", fontSize: 16, fontWeight: 700, pointerEvents: "none" }}>$</span>
          <input
            type="number" min={0} value={form.precio_membresia || ""}
            onChange={e => set("precio_membresia", e.target.value)}
            placeholder="0"
            style={{ ...S.inp, paddingLeft: 28, fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700 }}
          />
        </div>
      </div>

      {/* Ciclo */}
      <div style={S.field}>
        <label style={S.label}>Ciclo de renovación</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CICLOS.map(c => {
            const sel = form.ciclo_renovacion === c.value;
            return (
              <button key={c.value} onClick={() => set("ciclo_renovacion", c.value)} style={{
                flex: 1, minWidth: 80, padding: "10px 8px",
                border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong, #2e2e42)",
                borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated, #1e1e2e)",
                color: sel ? "#c4b5fd" : "var(--text-secondary, #9999b3)",
                fontSize: 12, fontWeight: sel ? 700 : 500, transition: "all .15s",
              }}>{c.label}</button>
            );
          })}
        </div>
      </div>

      {/* Días de gracia */}
      <div style={S.field}>
        <label style={S.label}>Días de gracia (tolerancia al vencimiento)</label>
        <input type="number" min={0} max={30} value={form.dias_gracia || 0} onChange={e => set("dias_gracia", Number(e.target.value))} style={S.inp} />
        {tieneGracia && (
          <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, marginTop: 4 }}>
            El alumno tendrá {form.dias_gracia} día{form.dias_gracia !== 1 ? "s" : ""} extra después del vencimiento antes de bloquearse.
          </p>
        )}
      </div>

      {/* Resumen tarjeta */}
      {precioNum > 0 && (
        <div style={{
          marginTop: 8, padding: "16px", borderRadius: 16,
          background: `${form.color || "#6c63ff"}10`,
          border: `1.5px solid ${form.color || "#6c63ff"}30`,
        }}>
          <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Así se verá en la tarjeta de clase
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: form.color || "#6c63ff", fontSize: 16, fontWeight: 700 }}>{form.nombre || "Nombre de la clase"}</p>
              <p style={{ color: "var(--text-secondary, #9999b3)", fontSize: 12, marginTop: 2 }}>
                {(form.dias_semana || []).length > 0 ? `${(form.dias_semana || []).length} días` : "Sin días"} · {form.hora_inicio || "—"} - {form.hora_fin || "—"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: form.color || "#6c63ff", fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                ${precioNum.toLocaleString("es-MX")}
              </p>
              <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11 }}>{cicloActual.label}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clase gratuita */}
      {precioNum === 0 && (
        <div style={{ padding: "10px 14px", background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 12, marginTop: 8 }}>
          <p style={{ color: "#4ade80", fontSize: 12 }}>✓ Clase gratuita — los alumnos no pagarán membresía.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function NuevaClaseWizard({ clase, gymId, miembros, instructores, planes, onSave, onClose }) {
  const esEdicion = !!clase;

  // Al editar, inferir precio/ciclo desde el plan vinculado a esta clase
  const planVinculado = esEdicion && planes
    ? (planes || []).find(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)))
    : null;

  const [form, setForm] = useState(() => ({
    nombre:            clase?.nombre            || "",
    descripcion:       clase?.descripcion       || "",
    instructor_id:     clase?.instructor_id     || "",
    instructor_nombre: clase?.instructor_nombre || "",
    edad_min:          String(clase?.edad_min   ?? 0),
    edad_max:          String(clase?.edad_max   ?? 99),
    cupo_max:          String(clase?.cupo_max   ?? 20),
    color:             clase?.color             || "#6c63ff",
    activo:            clase?.activo !== false,
    dias_semana:       clase?.dias_semana        || [],
    hora_inicio:       clase?.hora_inicio        || "09:00",
    hora_fin:          clase?.hora_fin           || "10:00",
    fecha_inicio:      clase?.fecha_inicio       || todayISO(),
    fecha_fin:         clase?.fecha_fin          || "",
    // Precio y ciclo — vienen del plan vinculado si existe
    precio_membresia:  String(planVinculado?.precio_publico || clase?.precio_membresia || ""),
    ciclo_renovacion:  planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual",
    dias_gracia:       planVinculado?.dias_gracia ?? clase?.dias_gracia ?? 5,
    plan_id:           planVinculado?.id || clase?.plan_id || null,
  }));

  const [step, setStep]     = useState(1);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validarPaso = () => {
    if (step === 1) {
      if (!form.nombre.trim())                        { setError("El nombre de la clase es obligatorio."); return false; }
      if (!form.cupo_max || Number(form.cupo_max) < 1){ setError("El cupo máximo debe ser al menos 1."); return false; }
      if ((form.dias_semana || []).length === 0)       { setError("Selecciona al menos un día de entrenamiento."); return false; }
      if (!form.hora_inicio || !form.hora_fin)         { setError("La hora de inicio y fin son obligatorias."); return false; }
      if (form.hora_fin <= form.hora_inicio)           { setError("La hora de fin debe ser posterior al inicio."); return false; }
    }
    setError(""); return true;
  };

  const handleGuardar = async () => {
    if (!validarPaso()) return;
    setSaving(true); setError("");
    try {
      // 1. Guardar la clase
      const payload = {
        gym_id:            gymId,
        nombre:            form.nombre.trim(),
        descripcion:       form.descripcion.trim() || null,
        instructor_id:     form.instructor_id || null,
        instructor_nombre: form.instructor_nombre || null,
        edad_min:          Number(form.edad_min) || 0,
        edad_max:          Number(form.edad_max) || 99,
        cupo_max:          Number(form.cupo_max) || 20,
        color:             form.color,
        activo:            form.activo,
        dias_semana:       form.dias_semana,
        hora_inicio:       form.hora_inicio,
        hora_fin:          form.hora_fin,
        fecha_inicio:      form.fecha_inicio || todayISO(),
        fecha_fin:         form.fecha_fin || null,
      };

      const dbC = await supabase.from("clases");
      let savedClase;
      if (esEdicion) {
        await dbC.update(clase.id, payload);
        savedClase = { ...clase, ...payload };
      } else {
        savedClase = await dbC.insert(payload);
      }
      if (!savedClase) { setError("Error al guardar la clase."); setSaving(false); return; }

      const claseId = savedClase.id || clase?.id;

      // 2. Crear o actualizar el plan de membresía vinculado 1:1 con esta clase
      const precioNum = Number(form.precio_membresia || 0);
      const dbP = await supabase.from("planes_membresia");
      const planPayload = {
        gym_id:            gymId,
        nombre:            form.nombre.trim(),   // mismo nombre que la clase
        precio_publico:    precioNum,
        ciclo_renovacion:  form.ciclo_renovacion,
        dias_gracia:       Number(form.dias_gracia) || 0,
        activo:            form.activo,
        clases_vinculadas: [String(claseId)],
        cupo_clases:       null,                 // ilimitado
      };

      if (form.plan_id) {
        // Actualizar plan existente
        await dbP.update(form.plan_id, planPayload);
      } else {
        // Crear nuevo plan
        const savedPlan = await dbP.insert(planPayload);
        if (savedPlan?.id) {
          // Guardar referencia del plan en la clase
          const dbC2 = await supabase.from("clases");
          await dbC2.update(claseId, { plan_id: savedPlan.id });
          savedClase = { ...savedClase, plan_id: savedPlan.id };
        }
      }

      setSaving(false);
      onSave({ ...savedClase, precio_membresia: precioNum, ciclo_renovacion: form.ciclo_renovacion }, esEdicion);
    } catch (e) {
      console.error(e);
      setError("Error inesperado al guardar.");
      setSaving(false);
    }
  };

  const goNext = () => { if (!validarPaso()) return; setStep(2); };
  const goPrev = () => { setError(""); setStep(1); };

  const nextLabel = step < 2 ? "Siguiente →" : saving ? "Guardando..." : esEdicion ? "✓ Actualizar clase" : "✓ Crear clase";

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ color: "var(--text-primary, #e8e8f0)", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: form.color || "#6c63ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📅</span>
              {esEdicion ? "Editar clase" : "Nueva clase"}
            </h2>
            <button onClick={onClose} style={{ background: "var(--bg-elevated, #1e1e2e)", border: "1px solid var(--border, #2a2a3e)", borderRadius: 10, width: 32, height: 32, cursor: "pointer", color: "var(--text-primary, #e8e8f0)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <ProgressBar step={step} />
        </div>

        <div style={S.body}>
          {error && <div style={S.errorBox}>{error}</div>}
          {step === 1 && <Step1DatosHorario form={form} set={set} miembros={miembros} instructores={instructores} esEdicion={esEdicion} />}
          {step === 2 && <Step2Precio form={form} set={set} />}
        </div>

        <div style={S.footer}>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1
              ? <button onClick={goPrev} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 20px" }}>← Anterior</button>
              : <button onClick={onClose} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 16px" }}>Cancelar</button>
            }
            <button onClick={step < 2 ? goNext : handleGuardar} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
