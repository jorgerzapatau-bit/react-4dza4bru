// src/modals/NuevaClaseWizard.jsx
// ══════════════════════════════════════════════════════════════════
//  Wizard 3 pasos:
//  [1 Datos generales] → [2 Horario] → [3 Precio y políticas]
//
//  Mejoras v3:
//  - Sin campo "Color etiqueta"
//  - Confirmación al cerrar con datos sin guardar
//  - Paso 2 con selector "Todos los días"
//  - Paso 3 con política de mora (sin cargo / monto fijo / porcentaje)
//  - Al guardar: crea/actualiza plan en planes_membresia (1:1)
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

const CICLOS = [
  { value: "mensual",    label: "Mensual",    meses: 1  },
  { value: "trimestral", label: "Trimestral", meses: 3  },
  { value: "semestral",  label: "Semestral",  meses: 6  },
  { value: "anual",      label: "Anual",      meses: 12 },
];

const MORA_TIPOS = [
  { value: "ninguna",    label: "Sin penalidad",  desc: "No se cobra nada por atraso" },
  { value: "fijo",       label: "Monto fijo",     desc: "Se suma un cargo fijo al renovar" },
  { value: "porcentaje", label: "Porcentaje",      desc: "% del precio de la membresía" },
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
    position: "relative",
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
  field: { marginBottom: 16 },
  secTitle: {
    color: "var(--text-tertiary, #6b6b8a)", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14,
  },
  btnPrimary: {
    flex: 1, padding: "14px", border: "none", borderRadius: 14,
    background: "linear-gradient(135deg,#6c63ff,#e040fb)",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 18px rgba(108,99,255,.35)", transition: "all .2s",
  },
  btnSecondary: {
    padding: "14px 20px",
    border: "1.5px solid var(--border-strong, #2e2e42)", borderRadius: 14,
    background: "var(--bg-elevated, #1e1e2e)",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s",
    flexShrink: 0,
  },
  errorBox: {
    background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)",
    borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 12, marginBottom: 14,
  },
};

// ── Barra de progreso 3 pasos ──────────────────────────────────────
function ProgressBar({ step }) {
  const labels = ["Datos", "Horario", "Precio"];
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        {labels.map((_, i) => {
          const idx = i + 1;
          const done = step > idx; const active = step === idx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12,
                background: done ? "#4ade80" : active ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated,#1e1e2e)",
                color: done || active ? "#fff" : "var(--text-tertiary,#6b6b8a)",
                border: active || done ? "none" : "1.5px solid var(--border-strong,#2e2e42)",
                boxShadow: active ? "0 0 0 3px rgba(108,99,255,.22)" : "none",
                transition: "all .3s",
              }}>
                {done ? "✓" : idx}
              </div>
              {i < labels.length - 1 && (
                <div style={{ flex: 1, height: 2, margin: "0 3px", background: done ? "#4ade80" : "var(--border-strong,#2e2e42)", transition: "background .3s" }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex" }}>
        {labels.map((l, i) => (
          <p key={i} style={{
            flex: 1,
            textAlign: i === 0 ? "left" : i === 2 ? "right" : "center",
            fontSize: 10, fontWeight: step === i + 1 ? 700 : 400,
            color: step === i + 1 ? "var(--text-primary,#e8e8f0)" : "var(--text-tertiary,#6b6b8a)",
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
      padding: "8px 12px", border: "none", borderRadius: 10,
      cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      transition: "all .15s",
      background: activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated,#1e1e2e)",
      color: activo ? "#fff" : "var(--text-secondary,#9999b3)",
      boxShadow: activo ? "0 2px 8px rgba(108,99,255,.3)" : "none",
    }}>
      {label}
    </button>
  );
}

// ── PASO 1: Datos generales ────────────────────────────────────────
function Step1Datos({ form, set, miembros, instructores, esEdicion }) {
  return (
    <div>
      <p style={S.secTitle}>Información de la clase</p>

      <div style={S.field}>
        <label style={S.label}>Nombre de la clase *</label>
        <input type="text" value={form.nombre} onChange={e => set("nombre", e.target.value)}
          placeholder="Ej. Karate Infantil" style={S.inp} autoFocus />
      </div>

      <div style={S.field}>
        <label style={S.label}>Descripción</label>
        <input type="text" value={form.descripcion} onChange={e => set("descripcion", e.target.value)}
          placeholder="Descripción breve (opcional)" style={S.inp} />
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
          color="#6c63ff"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <label style={S.label}>Edad mínima</label>
          <input type="number" value={form.edad_min} min={0} max={99}
            onChange={e => set("edad_min", e.target.value)} style={S.inp} />
        </div>
        <div>
          <label style={S.label}>Edad máxima</label>
          <input type="number" value={form.edad_max} min={0} max={99}
            onChange={e => set("edad_max", e.target.value)} style={S.inp} />
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Cupo máximo *</label>
        <input type="number" value={form.cupo_max} min={1}
          onChange={e => set("cupo_max", e.target.value)} style={S.inp} />
        <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 5 }}>
          Número máximo de alumnos que pueden inscribirse.
        </p>
      </div>

      {esEdicion && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elevated,#1e1e2e)", borderRadius: 12, border: "1px solid var(--border-strong,#2e2e42)" }}>
          <button onClick={() => set("activo", !form.activo)} style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: form.activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.1)",
            position: "relative", transition: "background .2s", flexShrink: 0,
          }}>
            <span style={{ position: "absolute", top: 3, left: form.activo ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
          </button>
          <div>
            <p style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 13, fontWeight: 600 }}>
              Clase {form.activo ? "activa" : "inactiva"}
            </p>
            <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 1 }}>
              {form.activo ? "Los alumnos pueden inscribirse" : "Oculta para nuevas inscripciones"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PASO 2: Horario ────────────────────────────────────────────────
function Step2Horario({ form, set }) {
  const fmtH = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
  };
  const diasActivos = form.dias_semana || [];
  const todosActivos = DIAS.every(d => diasActivos.includes(d.key));

  return (
    <div>
      <p style={S.secTitle}>Días y horario de entrenamiento</p>

      <div style={S.field}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Días de entrenamiento *</label>
          <button
            onClick={() => set("dias_semana", todosActivos ? [] : DIAS.map(d => d.key))}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#a78bfa", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}
          >
            {todosActivos ? "Quitar todos" : "Seleccionar todos"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIAS.map(d => (
            <DiaChip key={d.key} label={d.label} activo={diasActivos.includes(d.key)}
              onClick={() => set("dias_semana", diasActivos.includes(d.key)
                ? diasActivos.filter(x => x !== d.key)
                : [...diasActivos, d.key]
              )}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <label style={S.label}>Hora de inicio</label>
          <input type="time" value={form.hora_inicio || "09:00"}
            onChange={e => set("hora_inicio", e.target.value)} style={S.inp} />
        </div>
        <div>
          <label style={S.label}>Hora de fin</label>
          <input type="time" value={form.hora_fin || "10:00"}
            onChange={e => set("hora_fin", e.target.value)} style={S.inp} />
        </div>
      </div>

      {diasActivos.length > 0 && form.hora_inicio && form.hora_fin && (
        <div style={{ padding: "14px 16px", marginBottom: 16, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🕐</span>
          <div>
            <p style={{ color: "#c4b5fd", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
              {fmtH(form.hora_inicio)} — {fmtH(form.hora_fin)}
            </p>
            <p style={{ color: "var(--text-secondary,#9999b3)", fontSize: 12, marginTop: 2 }}>
              {diasActivos.map(k => DIAS.find(x => x.key === k)?.label || k).join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div style={{ height: 1, background: "var(--border,#2a2a3e)", margin: "4px 0 16px" }} />
      <p style={S.secTitle}>Vigencia del horario</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={S.label}>Desde *</label>
          <input type="date" value={form.fecha_inicio || todayISO()}
            onChange={e => set("fecha_inicio", e.target.value)} style={S.inp} />
        </div>
        <div>
          <label style={S.label}>Hasta (opcional)</label>
          <input type="date" value={form.fecha_fin || ""}
            onChange={e => set("fecha_fin", e.target.value)} style={S.inp} />
        </div>
      </div>
      <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 8 }}>
        Deja "Hasta" vacío si la clase no tiene fecha de fin definida.
      </p>
    </div>
  );
}

// ── PASO 3: Precio y políticas de cobro ────────────────────────────
function Step3Precio({ form, set, gymConfig }) {
  const precioNum = Number(form.precio_membresia || 0);
  const moraActual = form.mora_tipo || "ninguna";

  // Filtrar ciclos según los planes activos en la Configuración del gym
  const configPlanes = gymConfig?.planes || null;
  const ciclosHabilitados = CICLOS.filter(c => {
    if (!configPlanes) return true; // si no hay config, mostrar todos
    return configPlanes.some(p => p.activo !== false && p.nombre?.toLowerCase() === c.label.toLowerCase());
  });
  // Si ninguno habilitado (config rara), mostrar todos como fallback
  const ciclosVisibles = ciclosHabilitados.length > 0 ? ciclosHabilitados : CICLOS;

  const cicloActual = ciclosVisibles.find(c => c.value === form.ciclo_renovacion) || ciclosVisibles[0];

  // Si el ciclo seleccionado ya no está disponible, seleccionar el primero disponible
  if (form.ciclo_renovacion !== cicloActual?.value && cicloActual) {
    set("ciclo_renovacion", cicloActual.value);
  }

  return (
    <div>
      <p style={S.secTitle}>Precio de la membresía</p>

      <div style={S.field}>
        <label style={S.label}>Monto *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary,#9999b3)", fontSize: 18, fontWeight: 700, pointerEvents: "none" }}>$</span>
          <input type="number" min={0} value={form.precio_membresia || ""}
            onChange={e => set("precio_membresia", e.target.value)}
            placeholder="0"
            style={{ ...S.inp, paddingLeft: 30, fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700 }}
          />
        </div>
        {precioNum === 0 && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 10 }}>
            <p style={{ color: "#4ade80", fontSize: 12 }}>✓ Clase gratuita — los alumnos no pagarán membresía.</p>
          </div>
        )}
      </div>

      <div style={S.field}>
        <label style={S.label}>Ciclo de renovación</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ciclosVisibles.map(c => {
            const sel = form.ciclo_renovacion === c.value;
            return (
              <button key={c.value} onClick={() => set("ciclo_renovacion", c.value)} style={{
                padding: "12px", border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                transition: "all .15s", textAlign: "left",
              }}>
                <p style={{ color: sel ? "#c4b5fd" : "var(--text-primary,#e8e8f0)", fontSize: 13, fontWeight: sel ? 700 : 500 }}>{c.label}</p>
                <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 10, marginTop: 2 }}>Cada {c.meses === 1 ? "mes" : `${c.meses} meses`}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Días de gracia</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="number" min={0} max={30} value={form.dias_gracia ?? 5}
            onChange={e => set("dias_gracia", Number(e.target.value))}
            style={{ ...S.inp, flex: 1 }}
          />
          <span style={{ color: "var(--text-secondary,#9999b3)", fontSize: 13, whiteSpace: "nowrap" }}>días</span>
        </div>
        <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 5 }}>
          Tolerancia después del vencimiento antes de marcar la membresía como vencida.
        </p>
      </div>

      <div style={{ height: 1, background: "var(--border,#2a2a3e)", margin: "4px 0 16px" }} />
      <p style={S.secTitle}>Política de cobro por atraso</p>

      <div style={S.field}>
        <label style={S.label}>Penalidad por mora</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MORA_TIPOS.map(t => {
            const sel = moraActual === t.value;
            return (
              <button key={t.value} onClick={() => set("mora_tipo", t.value)} style={{
                padding: "12px 14px", border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                background: sel ? "rgba(108,99,255,.1)" : "var(--bg-elevated,#1e1e2e)",
                display: "flex", alignItems: "center", gap: 12,
                transition: "all .15s", textAlign: "left",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${sel ? "#6c63ff" : "rgba(255,255,255,.2)"}`,
                  background: sel ? "#6c63ff" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {sel && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div>
                  <p style={{ color: sel ? "#c4b5fd" : "var(--text-primary,#e8e8f0)", fontSize: 13, fontWeight: sel ? 700 : 500 }}>{t.label}</p>
                  <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 1 }}>{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {moraActual !== "ninguna" && (
        <div style={S.field}>
          <label style={S.label}>{moraActual === "fijo" ? "Monto de penalidad ($)" : "Porcentaje de penalidad (%)"}</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary,#9999b3)", fontSize: 15, fontWeight: 700, pointerEvents: "none" }}>
              {moraActual === "fijo" ? "$" : "%"}
            </span>
            <input type="number" min={0} value={form.mora_monto || ""}
              onChange={e => set("mora_monto", e.target.value)}
              placeholder="0"
              style={{ ...S.inp, paddingLeft: 28 }}
            />
          </div>
          {moraActual === "porcentaje" && Number(form.mora_monto) > 0 && precioNum > 0 && (
            <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 5 }}>
              Equivale a ${Math.round(precioNum * Number(form.mora_monto) / 100).toLocaleString("es-MX")} por renovación atrasada.
            </p>
          )}
        </div>
      )}

      {/* Resumen */}
      {precioNum > 0 && (
        <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(108,99,255,.07)", border: "1px solid rgba(108,99,255,.18)", marginTop: 4 }}>
          <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Resumen de cobro</p>
          {[
            ["Membresía " + cicloActual.label.toLowerCase(), `$${precioNum.toLocaleString("es-MX")}`],
            ["Días de gracia", `${form.dias_gracia ?? 5} días`],
            ["Penalidad por mora", moraActual === "ninguna" ? "Sin penalidad" : moraActual === "fijo" ? `$${Number(form.mora_monto || 0).toLocaleString("es-MX")} fijo` : `${form.mora_monto || 0}% del monto`],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: i < 2 ? 6 : 0 }}>
              <span style={{ color: "var(--text-secondary,#9999b3)", fontSize: 13 }}>{k}</span>
              <span style={{ color: i === 0 ? "#c4b5fd" : i === 2 && moraActual !== "ninguna" ? "#f59e0b" : "var(--text-secondary,#9999b3)", fontSize: 13, fontWeight: i === 0 ? 700 : 400, fontFamily: i === 0 ? "'DM Mono',monospace" : "inherit" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confirmación al salir con datos ───────────────────────────────
function ConfirmSalir({ onConfirm, onCancel }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, borderRadius: "22px 22px 0 0" }}>
      <div style={{ background: "var(--bg-card,#12121f)", borderRadius: 20, padding: "24px 20px", maxWidth: 300, width: "100%", textAlign: "center", border: "1px solid var(--border,#2a2a3e)" }}>
        <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
        <p style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>¿Salir sin guardar?</p>
        <p style={{ color: "var(--text-secondary,#9999b3)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>Perderás todos los datos ingresados en este formulario.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", border: "1.5px solid var(--border-strong,#2e2e42)", borderRadius: 12, background: "var(--bg-elevated,#1e1e2e)", color: "var(--text-primary,#e8e8f0)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 }}>
            Seguir editando
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, background: "rgba(244,63,94,.15)", color: "#f87171", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function NuevaClaseWizard({ clase, gymId, miembros, instructores, planes, gymConfig, onSave, onClose }) {
  const esEdicion = !!clase;

  // Bug fix: buscar plan por plan_id explícito primero, luego por clases_vinculadas
  const planVinculado = (() => {
    if (!planes || !clase?.id) return null;
    if (clase?.plan_id) {
      const byId = planes.find(p => String(p.id) === String(clase.plan_id));
      if (byId) return byId;
    }
    return planes.find(p =>
      (p.clases_vinculadas || []).map(String).includes(String(clase.id))
    ) || null;
  })();

  const [form, setForm] = useState(() => ({
    nombre:            clase?.nombre            || "",
    descripcion:       clase?.descripcion       || "",
    instructor_id:     clase?.instructor_id     || "",
    instructor_nombre: clase?.instructor_nombre || "",
    edad_min:          String(clase?.edad_min   ?? 0),
    edad_max:          String(clase?.edad_max   ?? 99),
    cupo_max:          String(clase?.cupo_max   ?? 20),
    activo:            clase?.activo !== false,
    dias_semana:       clase?.dias_semana        || [],
    hora_inicio:       clase?.hora_inicio        || "09:00",
    hora_fin:          clase?.hora_fin           || "10:00",
    fecha_inicio:      clase?.fecha_inicio       || todayISO(),
    fecha_fin:         clase?.fecha_fin          || "",
    precio_membresia:  String(planVinculado?.precio_publico || clase?.precio_membresia || ""),
    ciclo_renovacion:  planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual",
    dias_gracia:       planVinculado?.dias_gracia ?? clase?.dias_gracia ?? 5,
    mora_tipo:         planVinculado?.mora_tipo || clase?.mora_tipo || "ninguna",
    mora_monto:        String(planVinculado?.mora_monto || clase?.mora_monto || ""),
    plan_id:           planVinculado?.id || clase?.plan_id || null,
  }));

  const [step, setStep]         = useState(1);
  const [error, setError]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [confirmSalir, setConfirmSalir] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const hayDatos = !esEdicion && (
    form.nombre.trim() !== "" ||
    (form.dias_semana || []).length > 0 ||
    form.precio_membresia !== ""
  );

  const handleIntentarCerrar = () => {
    if (hayDatos) { setConfirmSalir(true); } else { onClose(); }
  };

  const validar = () => {
    if (step === 1) {
      if (!form.nombre.trim())                         { setError("El nombre de la clase es obligatorio."); return false; }
      if (!form.cupo_max || Number(form.cupo_max) < 1) { setError("El cupo máximo debe ser al menos 1."); return false; }
    }
    if (step === 2) {
      if ((form.dias_semana || []).length === 0) { setError("Selecciona al menos un día de entrenamiento."); return false; }
      if (!form.hora_inicio || !form.hora_fin)   { setError("La hora de inicio y fin son obligatorias."); return false; }
      if (form.hora_fin <= form.hora_inicio)     { setError("La hora de fin debe ser posterior al inicio."); return false; }
    }
    setError(""); return true;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setSaving(true); setError("");
    try {
      const claseId = clase?.id;
      const precioNum = Number(form.precio_membresia || 0);
      const diasGracia = (form.dias_gracia !== undefined && form.dias_gracia !== "")
        ? Number(form.dias_gracia) : 5;

      // ══ 1. GUARDAR CLASE (solo columnas reales de la tabla clases) ══
      // dias_semana/hora_inicio/hora_fin NO existen en clases — van en tabla horarios
      const clasePayload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        instructor_id: form.instructor_id || null,
        instructor_nombre: form.instructor_nombre || null,
        edad_min: Number(form.edad_min) || 0,
        edad_max: Number(form.edad_max) || 99,
        cupo_max: Number(form.cupo_max) || 20,
        activo: form.activo !== false,
      };

      let savedClase;
      const dbC = await supabase.from("clases");

      if (esEdicion) {
        await dbC.update(claseId, clasePayload);
        savedClase = { ...clase, ...clasePayload };
      } else {
        savedClase = await dbC.insert({ gym_id: gymId, ...clasePayload });
        if (!savedClase) { setError("Error al crear la clase."); setSaving(false); return; }
      }

      const finalClaseId = savedClase?.id || claseId;

      // ══ 1b. GUARDAR HORARIO (tabla separada) ════════════════════
      if (form.dias_semana?.length > 0 && form.hora_inicio && form.hora_fin) {
        const horarioPayload = {
          clase_id: finalClaseId,
          hora_inicio: form.hora_inicio,
          hora_fin: form.hora_fin,
          dias_semana: form.dias_semana,
          fecha_inicio: form.fecha_inicio || todayISO(),
          fecha_fin: form.fecha_fin || null,
          activo: true,
        };
        const dbH = await supabase.from("horarios");
        const horarioExistente = clase?.horario_id || null;
        if (horarioExistente) {
          await dbH.update(horarioExistente, horarioPayload);
          savedClase = { ...savedClase, horario_id: horarioExistente, ...horarioPayload };
        } else {
          const savedH = await dbH.insert({ gym_id: gymId, ...horarioPayload });
          if (savedH?.id) {
            savedClase = { ...savedClase, horario_id: savedH.id, ...horarioPayload };
          }
        }
      }

      // ══ 2. GUARDAR PLAN DE MEMBRESÍA ════════════════════════════
      // cupo_clases NO existe en la DB — columna eliminada
      const planPayload = {
        nombre: form.nombre.trim(),
        precio_publico: precioNum,
        ciclo_renovacion: form.ciclo_renovacion || "mensual",
        dias_gracia: diasGracia,
        mora_tipo: form.mora_tipo || "ninguna",
        mora_monto: Number(form.mora_monto) || 0,
        activo: form.activo !== false,
        clases_vinculadas: [String(finalClaseId)],
      };

      // Buscar plan_id con todos los métodos disponibles
      const resolvedPlanId =
        form.plan_id ||
        planVinculado?.id ||
        clase?.plan_id ||
        null;

      console.log("🔍 resolvedPlanId:", resolvedPlanId, "| form.plan_id:", form.plan_id, "| planVinculado?.id:", planVinculado?.id, "| clase?.plan_id:", clase?.plan_id);

      const dbP = await supabase.from("planes_membresia");

      if (resolvedPlanId) {
        // Actualizar plan existente (sin gym_id — RLS lo rechaza en PATCH)
        const okP = await dbP.update(resolvedPlanId, planPayload);
        console.log("✅ Plan actualizado:", resolvedPlanId, "ok:", okP);
        savedClase = { ...savedClase, plan_id: resolvedPlanId };
      } else {
        // No hay plan vinculado — buscar si existe uno por nombre antes de crear
        console.log("⚠️ No se encontró plan vinculado, buscando por nombre...");
        const dbSearch = await supabase.from("planes_membresia");
        const allPlanes = await dbSearch.select(gymId);
        const planByName = (allPlanes || []).find(p =>
          p.nombre?.toLowerCase().trim() === form.nombre.toLowerCase().trim()
        );

        if (planByName?.id) {
          // Existe un plan con ese nombre — actualizarlo y vincularlo
          console.log("🔗 Plan encontrado por nombre, vinculando:", planByName.id);
          await dbP.update(planByName.id, {
            ...planPayload,
            clases_vinculadas: [String(finalClaseId)],
          });
          // Guardar plan_id en la clase para futuras ediciones
          const dbC2 = await supabase.from("clases");
          await dbC2.update(finalClaseId, { plan_id: planByName.id });
          savedClase = { ...savedClase, plan_id: planByName.id };
        } else {
          // Crear plan nuevo
          console.log("🆕 Creando plan nuevo...");
          const savedPlan = await dbP.insert({ gym_id: gymId, ...planPayload });
          if (savedPlan?.id) {
            const dbC2 = await supabase.from("clases");
            await dbC2.update(finalClaseId, { plan_id: savedPlan.id });
            savedClase = { ...savedClase, plan_id: savedPlan.id };
            console.log("✅ Plan creado y vinculado:", savedPlan.id);
          }
        }
      }

      setSaving(false);
      onSave({
        ...savedClase,
        precio_membresia:  precioNum,
        ciclo_renovacion:  form.ciclo_renovacion || "mensual",
        dias_gracia:       diasGracia,
        mora_tipo:         form.mora_tipo || "ninguna",
        mora_monto:        Number(form.mora_monto) || 0,
      }, esEdicion);
    } catch (e) {
      console.error(e);
      setError("Error inesperado al guardar.");
      setSaving(false);
    }
  };

  const TOTAL = 3;
  const nextLabel = step < TOTAL ? "Siguiente →" : saving ? "Guardando..." : esEdicion ? "✓ Guardar cambios" : "✓ Crear clase";

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) handleIntentarCerrar(); }}>
      <div style={S.sheet}>
        {confirmSalir && <ConfirmSalir onConfirm={onClose} onCancel={() => setConfirmSalir(false)} />}

        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📅</span>
              {esEdicion ? "Editar clase" : "Nueva clase"}
            </h2>
            <button onClick={handleIntentarCerrar} style={{ background: "var(--bg-elevated,#1e1e2e)", border: "1px solid var(--border,#2a2a3e)", borderRadius: 10, width: 32, height: 32, cursor: "pointer", color: "var(--text-primary,#e8e8f0)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <ProgressBar step={step} />
        </div>

        <div style={S.body}>
          {error && <div style={S.errorBox}>{error}</div>}
          {step === 1 && <Step1Datos form={form} set={set} miembros={miembros} instructores={instructores} esEdicion={esEdicion} />}
          {step === 2 && <Step2Horario form={form} set={set} />}
          {step === 3 && <Step3Precio form={form} set={set} gymConfig={gymConfig} />}
        </div>

        <div style={S.footer}>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1
              ? <button onClick={() => { setError(""); setStep(s => s - 1); }} style={S.btnSecondary}>← Anterior</button>
              : <button onClick={handleIntentarCerrar} style={S.btnSecondary}>Cancelar</button>
            }
            <button
              onClick={step < TOTAL ? () => { if (validar()) { setError(""); setStep(s => s + 1); } } : handleGuardar}
              disabled={saving}
              style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
