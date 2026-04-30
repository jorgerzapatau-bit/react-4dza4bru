// src/screens/ClasesScreen.jsx
// ══════════════════════════════════════════════════════════════════
//  Gestión de Clases — Pantalla unificada (antes: Horarios + parte de Membresías)
//
//  Cambios respecto a HorariosScreen:
//  - El horario (dias_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin)
//    vive directamente en la tabla clases, sin tabla horarios separada.
//  - Eliminados: ModalHorario, confirmEliminarHorario, pestaña Horarios en detalle.
//  - ModalDetalle ahora tiene solo 2 pestañas: Alumnos y Membresías.
//  - ClaseCard muestra el horario desde los campos de la propia clase.
//
//  Props recibidos desde GymApp:
//    gymId        string
//    miembros     array
//    txs          array
//    gymConfig    object
//    onAddTx      fn
//    isOwner      bool
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import { todayISO, fmtDate, calcEdad } from "../utils/dateUtils";
import { getMembershipInfo } from "../utils/membershipUtils";
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

const DIAS_SHORT = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom",
  lunes: "Lun", martes: "Mar", miercoles: "Mié", miércoles: "Mié",
  jueves: "Jue", viernes: "Vie", sábado: "Sáb", sabado: "Sáb", domingo: "Dom",
};

// ── Helpers ───────────────────────────────────────────────────────
const fmtHora = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
};

function avatarIniciales(nombre) {
  if (!nombre) return "?";
  const parts = nombre.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

// ── Sub-componente: Tarjeta de clase ─────────────────────────────
function ClaseCard({ clase, inscripciones, miembros, txs, planes, onSelect }) {
  // Planes que incluyen esta clase
  const planesVinculados = (planes || []).filter(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id))
  );
  const planesIds = new Set(planesVinculados.map(p => String(p.id)));

  const inscritos = planesIds.size > 0
    ? (miembros || []).filter(m => {
        const info = getMembershipInfo(m.id, txs || [], m);
        if (info.estado !== "Activo") return false;
        const planNombre = (info.plan || "").toLowerCase().trim();
        return planesVinculados.some(p => {
          const pNombre = (p.nombre || "").toLowerCase().trim();
          return pNombre === planNombre || pNombre.includes(planNombre) || planNombre.includes(pNombre);
        });
      }).length
    : inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa").length;

  const pct = clase.cupo_max > 0 ? Math.round((inscritos / clase.cupo_max) * 100) : 0;
  const cupoColor = pct >= 90 ? "#f87171" : pct >= 70 ? "#f59e0b" : "#4ade80";

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

      {/* Horario embebido */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
        {(!clase.hora_inicio && (!clase.dias_semana || clase.dias_semana.length === 0)) ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Sin horario asignado</p>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>🕐</span>
              <span style={{ color: clase.color || "#6c63ff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                {fmtHora(clase.hora_inicio)} - {fmtHora(clase.hora_fin)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(clase.dias_semana || []).map(d => (
                <span key={d} style={{
                  background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 700, letterSpacing: .4,
                }}>
                  {DIAS_SHORT[d?.toLowerCase()] || d}
                </span>
              ))}
            </div>
          </div>
        )}
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
//  MODAL: Inscribir miembro a clase
// ══════════════════════════════════════════════════════════════════
function ModalInscribir({ clase, gymId, miembros, txs, inscripciones, planes, onSave, onClose }) {
  const [busqueda, setBusqueda] = useState("");
  const [selMiembro, setSelMiembro] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [advertenciaEdad, setAdvertenciaEdad] = useState("");

  const inscritos = inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa");
  const cupoDisponible = clase.cupo_max - inscritos.length;
  const yaInscritos = new Set(inscritos.map(i => String(i.miembro_id)));

  const planesVinculados = (planes || []).filter(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id)) && p.activo
  );
  const planesIds = new Set(planesVinculados.map(p => String(p.id)));

  const miembroTienePlan = (m) => {
    if (planesIds.size === 0) return true;
    const info = getMembershipInfo(m.id, txs || [], m);
    if (info.estado !== "Activo") return false;
    return planesVinculados.some(p => {
      const nombrePlan = (p.nombre || "").toLowerCase();
      const planInfo   = (info.plan  || "").toLowerCase();
      return nombrePlan === planInfo || nombrePlan.includes(planInfo) || planInfo.includes(nombrePlan);
    });
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
    if (insSaved) onSave(insSaved);
    else setError("Error al inscribir. Intenta de nuevo.");
  };

  return (
    <Modal title={`Inscribir a ${clase.nombre}`} onClose={onClose}>
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

      {error && <div style={{ background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12 }}>{error}</div>}
      {advertenciaEdad && <div style={{ background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f59e0b", fontSize: 12 }}>{advertenciaEdad}</div>}

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
              const tienePlan = miembroTienePlan(m);
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
      </div>

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
//  MODAL: Detalle de clase — 2 pestañas: Alumnos y Membresías
// ══════════════════════════════════════════════════════════════════
function ModalDetalle({ clase, inscripciones, miembros, txs, gymId, isOwner, canManage, planes, onEditClase, onDarBaja, onClose }) {
  const planesVinculados = (planes || []).filter(p => (p.clases_vinculadas || []).map(String).includes(String(clase.id)));
  const planesIds = new Set(planesVinculados.map(p => String(p.id)));

  const [tabActiva, setTabActiva] = useState("alumnos");
  const [busqueda, setBusqueda] = useState("");

  const alumnosConMembresia = useMemo(() => {
    if (planesIds.size === 0) {
      return inscripciones
        .filter(i => i.clase_id === clase.id && i.estado === "activa")
        .map(ins => {
          const m = miembros.find(m => String(m.id) === String(ins.miembro_id));
          if (!m) return null;
          const info = getMembershipInfo(m.id, txs || [], m);
          return { miembro: m, info, fuente: "inscripcion", ins };
        })
        .filter(Boolean);
    }
    return miembros
      .map(m => {
        const info = getMembershipInfo(m.id, txs || [], m);
        if (info.estado !== "Activo") return null;
        const planNombre = (info.plan || "").toLowerCase().trim();
        const planMatch = planesVinculados.some(p => {
          const pNombre = (p.nombre || "").toLowerCase().trim();
          return pNombre === planNombre || pNombre.includes(planNombre) || planNombre.includes(pNombre);
        });
        if (!planMatch) return null;
        return { miembro: m, info, fuente: "membresia" };
      })
      .filter(Boolean);
  }, [miembros, txs, inscripciones, clase.id, planesIds]); // eslint-disable-line

  const alumnosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return alumnosConMembresia;
    const q = busqueda.toLowerCase();
    return alumnosConMembresia.filter(a =>
      a.miembro.nombre.toLowerCase().includes(q) ||
      (a.miembro.tel || "").includes(q)
    );
  }, [alumnosConMembresia, busqueda]);

  return (
    <Modal title={clase.nombre} onClose={onClose}>
      {/* Header info */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{
          background: `${clase.color || "#6c63ff"}20`,
          color: clase.color || "#6c63ff",
          borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700,
        }}>
          {alumnosConMembresia.length} / {clase.cupo_max} alumnos
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

      {/* Horario resumen */}
      {clase.hora_inicio && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: `${clase.color || "#6c63ff"}10`,
          border: `1px solid ${clase.color || "#6c63ff"}25`,
          borderRadius: 10, padding: "8px 12px", marginBottom: 14,
        }}>
          <span style={{ fontSize: 14 }}>🕐</span>
          <span style={{ color: clase.color || "#6c63ff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {fmtHora(clase.hora_inicio)} — {fmtHora(clase.hora_fin)}
          </span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(clase.dias_semana || []).map(d => (
              <span key={d} style={{
                background: `${clase.color || "#6c63ff"}18`, color: clase.color || "#6c63ff",
                borderRadius: 5, padding: "2px 6px", fontSize: 10, fontWeight: 700,
              }}>
                {DIAS_SHORT[d?.toLowerCase()] || d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs — solo Alumnos y Membresías */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { k: "alumnos",    l: `Alumnos (${alumnosConMembresia.length})` },
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
          {planesIds.size > 0 && (
            <div style={{
              background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)",
              borderRadius: 12, padding: "9px 13px", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>💳</span>
              <p style={{ color: "#a78bfa", fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                Se muestran los miembros con membresía activa vinculada a esta clase.
              </p>
            </div>
          )}

          {alumnosConMembresia.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text" value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar alumno..."
                style={{
                  width: "100%", background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)", borderRadius: 10,
                  padding: "9px 13px", color: "var(--text-primary)",
                  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {alumnosFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎓</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                {busqueda ? "Sin resultados para esa búsqueda." :
                  planesIds.size > 0
                    ? "Ningún miembro con membresía activa de esta clase."
                    : "Sin alumnos inscritos"
                }
              </p>
            </div>
          ) : alumnosFiltrados.map(({ miembro: m, info }) => {
            const edad = m.fecha_nacimiento ? calcEdad(m.fecha_nacimiento) : null;
            const diasRestantes = info.vence ? (() => {
              const hoy = new Date();
              const v = new Date(info.vence + "T00:00:00");
              return Math.ceil((v - hoy) / 86400000);
            })() : null;
            const venceTexto = info.vence ? fmtDate(info.vence) : "—";
            const urgente = diasRestantes !== null && diasRestantes <= 7;

            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 14, marginBottom: 8,
                background: "var(--bg-elevated)",
                border: urgente ? "1px solid rgba(245,158,11,.35)" : "1px solid var(--border)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                  background: `${clase.color || "#6c63ff"}22`,
                  color: clase.color || "#6c63ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {m.foto
                    ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : avatarIniciales(m.nombre)
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {m.nombre}
                  </p>
                  <p style={{ color: urgente ? "#f59e0b" : "var(--text-tertiary)", fontSize: 11 }}>
                    {edad !== null ? `${edad} años · ` : ""}
                    {urgente ? `⚠️ Vence en ${diasRestantes}d (${venceTexto})` : `Vence: ${venceTexto}`}
                  </p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: "rgba(74,222,128,.12)", color: "#4ade80", flexShrink: 0,
                }}>
                  ✓ Activo
                </span>
              </div>
            );
          })}
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
              <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 4 }}>Usa <strong>⚙️ Editar clase</strong> para vincular planes.</p>
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
export default function ClasesScreen({ gymId, miembros, txs, gymConfig, onAddTx, isOwner, canManage = isOwner, planes: planesProp }) {

  const [clases, setClases]               = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [planes, setPlanes]               = useState(planesProp || []);
  const [instructores, setInstructores]   = useState([]);
  const [loading, setLoading]             = useState(true);

  const [busqueda, setBusqueda]   = useState("");
  const [filtroDia, setFiltroDia] = useState("todos");

  const [modalClase, setModalClase]       = useState(null); // null | "nueva" | clase
  const [modalDetalle, setModalDetalle]   = useState(null); // null | clase
  const [modalInscribir, setModalInscribir] = useState(null); // null | clase
  const [confirmDarBaja, setConfirmDarBaja] = useState(null);

  const loadDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [dbC, dbI, dbP, dbInst] = await Promise.all([
        supabase.from("clases"),
        supabase.from("inscripciones"),
        supabase.from("planes_membresia"),
        supabase.from("instructores"),
      ]);
      const [cData, iData, pData, instData] = await Promise.all([
        dbC.select(gymId),
        dbI.select(gymId),
        dbP.select(gymId),
        dbInst.select(gymId),
      ]);
      setClases(cData || []);
      setInscripciones(iData || []);
      setPlanes(pData || []);
      setInstructores((instData || []).filter(i => i.activo !== false));
    } catch (e) {
      console.error("Error cargando clases:", e);
    }
    setLoading(false);
  }, [gymId]);

  useEffect(() => { loadDatos(); }, [loadDatos]);

  // Métricas
  const stats = useMemo(() => {
    const clasesActivas = clases.filter(c => c.activo);
    const totalInscritos = inscripciones.filter(i => i.estado === "activa").length;
    const conteoPorClase = {};
    inscripciones.filter(i => i.estado === "activa").forEach(i => {
      conteoPorClase[i.clase_id] = (conteoPorClase[i.clase_id] || 0) + 1;
    });
    const masPopularId = Object.entries(conteoPorClase).sort((a, b) => b[1] - a[1])[0]?.[0];
    const masPopular = clases.find(c => c.id === masPopularId);
    return { clasesActivas: clasesActivas.length, totalInscritos, masPopular };
  }, [clases, inscripciones]);

  // Filtrado — ahora usa dias_semana directamente en la clase
  const clasesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return clases.filter(c => {
      if (!c.activo && !canManage) return false;
      const matchQ = !q || c.nombre.toLowerCase().includes(q) || (c.instructor_nombre || "").toLowerCase().includes(q);
      if (!matchQ) return false;
      if (filtroDia === "todos") return true;
      return (c.dias_semana || []).includes(filtroDia);
    });
  }, [clases, busqueda, filtroDia, canManage]);

  const handleGuardarClase = (saved, esEdicion) => {
    if (esEdicion) {
      setClases(p => p.map(c => c.id === saved.id ? saved : c));
      if (modalDetalle?.id === saved.id) setModalDetalle(saved);
    } else {
      setClases(p => [...p, saved]);
    }
    setModalClase(null);
  };

  const handleInscribir = (inscripcion) => {
    setInscripciones(p => [...p, inscripcion]);
    setModalInscribir(null);
  };

  const handleDarBaja = async (inscripcion) => {
    const db = await supabase.from("inscripciones");
    await db.update(inscripcion.id, { estado: "baja" });
    setInscripciones(p => p.map(i => i.id === inscripcion.id ? { ...i, estado: "baja" } : i));
    setConfirmDarBaja(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>📅</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                Gestión de <span style={{ background: "linear-gradient(90deg,#6c63ff,#e040fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Clases</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>Clases, horarios y membresías en un solo lugar</p>
            </div>
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

          {/* Métricas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Clases activas",    val: stats.clasesActivas,          icon: "📚", color: "var(--text-primary)" },
              { label: "Instructores",      val: instructores.length,           icon: "👤", color: "#4ade80" },
              { label: "Alumnos inscritos", val: stats.totalInscritos,          icon: "👥", color: "#f59e0b" },
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

          {/* Búsqueda */}
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
                  inscripciones={inscripciones}
                  miembros={miembros}
                  txs={txs}
                  planes={planes}
                  onSelect={setModalDetalle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALES ═══ */}

      {modalClase && (
        <NuevaClaseWizard
          clase={modalClase === "nueva" ? null : modalClase}
          gymId={gymId}
          miembros={miembros}
          instructores={instructores}
          planes={planes}
          onSave={handleGuardarClase}
          onClose={() => setModalClase(null)}
        />
      )}

      {modalDetalle && (
        <ModalDetalle
          clase={modalDetalle}
          inscripciones={inscripciones}
          miembros={miembros}
          txs={txs}
          gymId={gymId}
          isOwner={isOwner}
          canManage={canManage}
          planes={planes}
          onEditClase={() => { setModalClase(modalDetalle); setModalDetalle(null); }}
          onDarBaja={setConfirmDarBaja}
          onClose={() => setModalDetalle(null)}
        />
      )}

      {modalInscribir && (
        <ModalInscribir
          clase={modalInscribir}
          gymId={gymId}
          miembros={miembros}
          txs={txs}
          inscripciones={inscripciones}
          planes={planes}
          onSave={handleInscribir}
          onClose={() => setModalInscribir(null)}
        />
      )}

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
                {m?.nombre || "Este miembro"} será dado de baja de la clase.
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
