// src/screens/ClasesScreen.jsx
// ══════════════════════════════════════════════════════════════════
//  Gestión de Clases — tarjeta simplificada con precio visible.
//  Sin "planes con acceso" — cada clase tiene su propio precio.
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import { todayISO, fmtDate, calcEdad } from "../utils/dateUtils";
import { getMembershipInfo } from "../utils/membershipUtils";
import { Modal, Btn } from "../components/UI";
import NuevaClaseWizard from "../modals/NuevaClaseWizard";

const DIAS = [
  { key: "lun", label: "LUN" }, { key: "mar", label: "MAR" },
  { key: "mie", label: "MIÉ" }, { key: "jue", label: "JUE" },
  { key: "vie", label: "VIE" }, { key: "sab", label: "SÁB" },
  { key: "dom", label: "DOM" },
];

const DIAS_SHORT = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom",
};

const CICLO_LABEL = { mensual: "mes", trimestral: "trimestre", semestral: "semestre", anual: "año" };

const fmtHora = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
};

function avatarIniciales(nombre) {
  if (!nombre) return "?";
  const parts = nombre.trim().split(" ");
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

// ── Tarjeta de clase — precio visible, sin "planes con acceso" ──
function ClaseCard({ clase, inscripciones, miembros, txs, planes, onSelect }) {
  const planVinculado = (planes || []).find(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id))
  );
  const precio = planVinculado?.precio_publico ?? clase?.precio_membresia ?? null;
  const ciclo  = planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";

  // Contar alumnos con membresía activa de esta clase
  const inscritos = planVinculado
    ? (miembros || []).filter(m => {
        const info = getMembershipInfo(m.id, txs || [], m);
        if (info.estado !== "Activo") return false;
        const planNombre = (info.plan || "").toLowerCase().trim();
        const pNombre    = (planVinculado.nombre || "").toLowerCase().trim();
        return pNombre === planNombre || pNombre.includes(planNombre) || planNombre.includes(pNombre);
      }).length
    : inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa").length;

  const pct = clase.cupo_max > 0 ? Math.round((inscritos / clase.cupo_max) * 100) : 0;
  const cupoColor = pct >= 90 ? "#f87171" : pct >= 70 ? "#f59e0b" : "#4ade80";

  return (
    <div
      onClick={() => onSelect(clase)}
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderLeft: `4px solid ${clase.color || "#6c63ff"}`,
        borderRadius: "0 18px 18px 0",
        padding: "16px 16px 14px", cursor: "pointer",
        transition: "transform .15s, box-shadow .15s",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: clase.color || "#6c63ff", opacity: .06, pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>General</p>
        <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>{clase.nombre}</h3>
        {clase.descripcion && <p style={{ color: "var(--text-secondary)", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{clase.descripcion}</p>}
      </div>

      {/* Horario */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
        {!clase.hora_inicio ? (
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
                <span key={d} style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 700, letterSpacing: .4 }}>
                  {DIAS_SHORT[d?.toLowerCase()] || d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructor + Cupo */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${clase.color || "#6c63ff"}22`, color: clase.color || "#6c63ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
            {avatarIniciales(clase.instructor_nombre || "?")}
          </div>
          <div>
            <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Titular</p>
            <p style={{ color: "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>{clase.instructor_nombre || "Sin asignar"}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Cupo</p>
          <p style={{ color: cupoColor, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{inscritos} / {clase.cupo_max}</p>
        </div>
      </div>

      {/* Barra cupo */}
      <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: cupoColor, borderRadius: 2, transition: "width .4s ease" }} />
      </div>

      {/* Precio de membresía — visible y claro */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Membresía</p>
        {precio !== null && precio > 0 ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ color: clase.color || "#6c63ff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
              ${Number(precio).toLocaleString("es-MX")}
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>/ {CICLO_LABEL[ciclo] || ciclo}</span>
          </div>
        ) : (
          <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 700 }}>Gratuita</span>
        )}
      </div>
    </div>
  );
}

// ── Modal Detalle — solo pestaña Alumnos ─────────────────────────
function ModalDetalle({ clase, inscripciones, miembros, txs, gymId, isOwner, canManage, planes, onEditClase, onClose }) {
  const planVinculado = (planes || []).find(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id))
  );
  const precio = planVinculado?.precio_publico ?? clase?.precio_membresia ?? null;
  const ciclo  = planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";

  const [busqueda, setBusqueda] = useState("");

  const alumnos = useMemo(() => {
    if (!planVinculado) {
      return inscripciones
        .filter(i => i.clase_id === clase.id && i.estado === "activa")
        .map(ins => {
          const m = miembros.find(m => String(m.id) === String(ins.miembro_id));
          if (!m) return null;
          return { miembro: m, info: getMembershipInfo(m.id, txs || [], m) };
        }).filter(Boolean);
    }
    return miembros.map(m => {
      const info = getMembershipInfo(m.id, txs || [], m);
      if (info.estado !== "Activo") return null;
      const planNombre = (info.plan || "").toLowerCase().trim();
      const pNombre    = (planVinculado.nombre || "").toLowerCase().trim();
      if (!(pNombre === planNombre || pNombre.includes(planNombre) || planNombre.includes(pNombre))) return null;
      return { miembro: m, info };
    }).filter(Boolean);
  }, [miembros, txs, inscripciones, clase.id, planVinculado]); // eslint-disable-line

  const alumnosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return alumnos;
    const q = busqueda.toLowerCase();
    return alumnos.filter(a => a.miembro.nombre.toLowerCase().includes(q) || (a.miembro.tel || "").includes(q));
  }, [alumnos, busqueda]);

  return (
    <Modal title={clase.nombre} onClose={onClose}>
      {/* Resumen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ background: `${clase.color || "#6c63ff"}20`, color: clase.color || "#6c63ff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
          {alumnos.length} / {clase.cupo_max} alumnos
        </span>
        {precio !== null && (
          <span style={{ background: "rgba(74,222,128,.12)", color: "#4ade80", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            {precio > 0 ? `$${Number(precio).toLocaleString("es-MX")} / ${CICLO_LABEL[ciclo] || ciclo}` : "Gratuita"}
          </span>
        )}
        {(clase.edad_min > 0 || clase.edad_max < 99) && (
          <span style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", borderRadius: 8, padding: "4px 10px", fontSize: 11 }}>
            {clase.edad_min}–{clase.edad_max} años
          </span>
        )}
      </div>

      {/* Horario */}
      {clase.hora_inicio && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${clase.color || "#6c63ff"}10`, border: `1px solid ${clase.color || "#6c63ff"}25`, borderRadius: 10, padding: "8px 12px", marginBottom: 16 }}>
          <span style={{ fontSize: 14 }}>🕐</span>
          <span style={{ color: clase.color || "#6c63ff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {fmtHora(clase.hora_inicio)} — {fmtHora(clase.hora_fin)}
          </span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(clase.dias_semana || []).map(d => (
              <span key={d} style={{ background: `${clase.color || "#6c63ff"}18`, color: clase.color || "#6c63ff", borderRadius: 5, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>
                {DIAS_SHORT[d?.toLowerCase()] || d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Título alumnos */}
      <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>
        Alumnos ({alumnos.length})
      </p>

      {alumnos.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar alumno..."
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      {alumnosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>🎓</p>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            {busqueda ? "Sin resultados." : "Ningún alumno inscrito aún."}
          </p>
        </div>
      ) : alumnosFiltrados.map(({ miembro: m, info }) => {
        const edad = m.fecha_nacimiento ? calcEdad(m.fecha_nacimiento) : null;
        const diasRestantes = info.vence ? Math.ceil((new Date(info.vence + "T00:00:00") - new Date()) / 86400000) : null;
        const urgente = diasRestantes !== null && diasRestantes <= 7;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, marginBottom: 8, background: "var(--bg-elevated)", border: urgente ? "1px solid rgba(245,158,11,.35)" : "1px solid var(--border)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `${clase.color || "#6c63ff"}22`, color: clase.color || "#6c63ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
              {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatarIniciales(m.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.nombre}</p>
              <p style={{ color: urgente ? "#f59e0b" : "var(--text-tertiary)", fontSize: 11 }}>
                {edad !== null ? `${edad} años · ` : ""}
                {urgente ? `⚠️ Vence en ${diasRestantes}d` : info.vence ? `Vence: ${fmtDate(info.vence)}` : "Sin vencimiento"}
              </p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(74,222,128,.12)", color: "#4ade80", flexShrink: 0 }}>✓ Activo</span>
          </div>
        );
      })}

      {isOwner && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button onClick={onEditClase} style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: 12, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
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
  const [clases, setClases]             = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [planes, setPlanes]             = useState(planesProp || []);
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState("");
  const [filtroDia, setFiltroDia]       = useState("todos");
  const [modalClase, setModalClase]     = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [confirmDarBaja, setConfirmDarBaja] = useState(null);

  const loadDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [dbC, dbI, dbP, dbInst] = await Promise.all([
        supabase.from("clases"), supabase.from("inscripciones"),
        supabase.from("planes_membresia"), supabase.from("instructores"),
      ]);
      const [cData, iData, pData, instData] = await Promise.all([
        dbC.select(gymId), dbI.select(gymId), dbP.select(gymId), dbInst.select(gymId),
      ]);
      setClases(cData || []);
      setInscripciones(iData || []);
      setPlanes(pData || []);
      setInstructores((instData || []).filter(i => i.activo !== false));
    } catch (e) { console.error("Error cargando clases:", e); }
    setLoading(false);
  }, [gymId]);

  useEffect(() => { loadDatos(); }, [loadDatos]);

  const stats = useMemo(() => {
    const clasesActivas = clases.filter(c => c.activo);
    const totalInscritos = inscripciones.filter(i => i.estado === "activa").length;
    const conteoPorClase = {};
    inscripciones.filter(i => i.estado === "activa").forEach(i => {
      conteoPorClase[i.clase_id] = (conteoPorClase[i.clase_id] || 0) + 1;
    });
    const masPopularId = Object.entries(conteoPorClase).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { clasesActivas: clasesActivas.length, totalInscritos, masPopular: clases.find(c => c.id === masPopularId) };
  }, [clases, inscripciones]);

  const clasesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return clases.filter(c => {
      if (!c.activo && !canManage) return false;
      if (q && !c.nombre.toLowerCase().includes(q) && !(c.instructor_nombre || "").toLowerCase().includes(q)) return false;
      if (filtroDia !== "todos" && !(c.dias_semana || []).includes(filtroDia)) return false;
      return true;
    });
  }, [clases, busqueda, filtroDia, canManage]);

  const handleGuardarClase = (saved, esEdicion) => {
    if (esEdicion) {
      setClases(p => p.map(c => c.id === saved.id ? saved : c));
      if (modalDetalle?.id === saved.id) setModalDetalle(saved);
    } else {
      setClases(p => [...p, saved]);
    }
    // Recargar planes para que la tarjeta muestre el precio actualizado
    supabase.from("planes_membresia").then(db => db.select(gymId)).then(pData => {
      if (pData) setPlanes(pData);
    }).catch(() => {});
    setModalClase(null);
  };

  const handleDarBaja = async (inscripcion) => {
    const db = await supabase.from("inscripciones");
    await db.update(inscripcion.id, { estado: "baja" });
    setInscripciones(p => p.map(i => i.id === inscripcion.id ? { ...i, estado: "baja" } : i));
    setConfirmDarBaja(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* HEADER */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📅</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                Gestión de <span style={{ background: "linear-gradient(90deg,#6c63ff,#e040fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Clases</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>Clases, horarios y membresías en un solo lugar</p>
            </div>
            {isOwner && (
              <button onClick={() => setModalClase("nueva")} style={{ border: "none", borderRadius: 12, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff", boxShadow: "0 3px 14px rgba(108,99,255,.35)" }}>
                + Nueva clase
              </button>
            )}
          </div>

          {/* Métricas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Clases activas",    val: stats.clasesActivas,               color: "var(--text-primary)", icon: "📚" },
              { label: "Instructores",      val: instructores.length,               color: "#4ade80",             icon: "👤" },
              { label: "Alumnos inscritos", val: stats.totalInscritos,              color: "#f59e0b",             icon: "👥" },
              { label: "Clase más popular", val: stats.masPopular?.nombre || "N/A", color: "#f87171",             icon: "🏆", small: true },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: s.small ? 13 : 22, fontWeight: 700, fontFamily: s.small ? "inherit" : "'DM Mono',monospace", lineHeight: 1 }}>{s.val}</p>
                </div>
                <span style={{ fontSize: 22, opacity: .5 }}>{s.icon}</span>
              </div>
            ))}
          </div>

          {/* Búsqueda */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-tertiary)", pointerEvents: "none" }}>🔍</span>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por clase, instructor..."
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px 10px 34px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14 }}>✕</button>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
              📍 <span>{gymConfig?.nombre || "Sede principal"}</span>
            </div>
          </div>

          {/* Filtros por día */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginTop: 10 }}>
            {[{ key: "todos", label: "Todos" }, ...DIAS].map(d => (
              <button key={d.key} onClick={() => setFiltroDia(d.key)} style={{ flexShrink: 0, padding: "5px 14px", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: filtroDia === d.key ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)", color: filtroDia === d.key ? "#fff" : "var(--text-secondary)" }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
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
                <button onClick={() => setModalClase("nueva")} style={{ marginTop: 12, border: "none", borderRadius: 12, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff" }}>
                  + Crear primera clase
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, paddingBottom: 24 }}>
              {clasesFiltradas.map(c => (
                <ClaseCard key={c.id} clase={c} inscripciones={inscripciones} miembros={miembros} txs={txs} planes={planes} onSelect={setModalDetalle} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALES */}
      {modalClase && (
        <NuevaClaseWizard
          clase={modalClase === "nueva" ? null : modalClase}
          gymId={gymId} miembros={miembros} instructores={instructores} planes={planes}
          onSave={handleGuardarClase} onClose={() => setModalClase(null)}
        />
      )}

      {modalDetalle && (
        <ModalDetalle
          clase={modalDetalle} inscripciones={inscripciones} miembros={miembros} txs={txs}
          gymId={gymId} isOwner={isOwner} canManage={canManage} planes={planes}
          onEditClase={() => { setModalClase(modalDetalle); setModalDetalle(null); }}
          onDarBaja={setConfirmDarBaja} onClose={() => setModalDetalle(null)}
        />
      )}

      {confirmDarBaja && (() => {
        const m = miembros.find(mb => String(mb.id) === String(confirmDarBaja.miembro_id));
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "28px 24px", maxWidth: 340, width: "100%", textAlign: "center" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>⚠️</p>
              <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>¿Dar de baja?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>{m?.nombre || "Este miembro"} será dado de baja de la clase.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDarBaja(null)} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 12, background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => handleDarBaja(confirmDarBaja)} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Dar de baja</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
