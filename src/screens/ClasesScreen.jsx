// src/screens/ClasesScreen.jsx
// ══════════════════════════════════════════════════════════════════
//  Mejoras v3:
//  1. Botón ⚙️ editar directo en la tarjeta (visible para canManage)
//  2. Badge de cupo con estado semántico: Llena / Casi llena / Con espacio
//  3. Alumnos ordenados: "Por vencer" arriba con alerta roja
//  4. Botón "Cobrar renovación" por alumno en el detalle
//  5. Chip de alerta "Sin horario" con enlace directo a editar
//  6. Filtro Activas / Inactivas en la barra de filtros
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
const DIAS_SHORT = { lun:"Lun", mar:"Mar", mie:"Mié", jue:"Jue", vie:"Vie", sab:"Sáb", dom:"Dom" };
const CICLO_LABEL = { mensual:"mes", trimestral:"trimestre", semestral:"semestre", anual:"año" };

const fmtHora = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
};

function avatarIniciales(nombre) {
  if (!nombre) return "?";
  const p = nombre.trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
}

// ── Helpers de cupo ───────────────────────────────────────────────
function getCupoEstado(inscritos, cupoMax) {
  if (cupoMax === 0) return { label: "Sin límite", color: "#4ade80", bg: "rgba(74,222,128,.12)" };
  const pct = inscritos / cupoMax;
  if (pct >= 1)    return { label: "Llena",       color: "#f87171", bg: "rgba(248,113,113,.12)" };
  if (pct >= 0.8)  return { label: "Casi llena",  color: "#f59e0b", bg: "rgba(245,158,11,.12)"  };
  return              { label: "Con espacio",  color: "#4ade80", bg: "rgba(74,222,128,.12)"  };
}

// ── Tarjeta de clase ──────────────────────────────────────────────
function ClaseCard({ clase, inscripciones, miembros, txs, planes, canManage, onSelect, onEdit }) {
  const planVinculado = (planes || []).find(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id))
  );
  const precio = planVinculado?.precio_publico ?? clase?.precio_membresia ?? null;
  const ciclo  = planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";

  const inscritos = planVinculado
    ? (miembros || []).filter(m => {
        const info = getMembershipInfo(m.id, txs || [], m);
        if (info.estado !== "Activo") return false;
        const pn = (planVinculado.nombre || "").toLowerCase().trim();
        const ip = (info.plan || "").toLowerCase().trim();
        return pn === ip || pn.includes(ip) || ip.includes(pn);
      }).length
    : inscripciones.filter(i => i.clase_id === clase.id && i.estado === "activa").length;

  const cupoEstado = getCupoEstado(inscritos, clase.cupo_max);
  const sinHorario = !clase.hora_inicio || (clase.dias_semana || []).length === 0;

  return (
    <div
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderLeft: `4px solid ${clase.color || "#6c63ff"}`,
        borderRadius: "0 18px 18px 0",
        padding: "16px 16px 14px", cursor: "pointer",
        transition: "transform .15s, box-shadow .15s",
        position: "relative", overflow: "hidden",
        opacity: clase.activo === false ? 0.55 : 1,
      }}
      onClick={() => onSelect(clase)}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: clase.color || "#6c63ff", opacity: .06, pointerEvents: "none" }} />

      {/* Header: nombre + botón editar */}
      <div style={{ marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--text-tertiary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>General</p>
          <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, lineHeight: 1.2, marginBottom: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{clase.nombre}</h3>
          {clase.descripcion && <p style={{ color: "var(--text-secondary)", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{clase.descripcion}</p>}
        </div>
        {/* Botón editar — visible para canManage, directo sin abrir detalle */}
        {canManage && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(clase); }}
            title="Editar clase"
            style={{
              flexShrink: 0, width: 30, height: 30,
              border: "1px solid var(--border-strong)", borderRadius: 8,
              background: "var(--bg-elevated)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: "var(--text-secondary)",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(108,99,255,.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-elevated)"}
          >⚙️</button>
        )}
      </div>

      {/* Horario — con alerta si falta */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 10 }}>
        {sinHorario ? (
          <div
            onClick={e => { if (canManage) { e.stopPropagation(); onEdit(clase); } }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 8,
              background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)",
              cursor: canManage ? "pointer" : "default",
            }}
          >
            <span style={{ fontSize: 13 }}>⚠️</span>
            <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>Sin horario asignado</span>
            {canManage && <span style={{ color: "#f59e0b", fontSize: 10, marginLeft: "auto" }}>Configurar →</span>}
          </div>
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

      {/* Instructor + cupo con badge semántico */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{inscritos}/{clase.cupo_max}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: cupoEstado.bg, color: cupoEstado.color }}>
              {cupoEstado.label}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de cupo */}
      <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: "100%", width: `${Math.min((inscritos / Math.max(clase.cupo_max, 1)) * 100, 100)}%`, background: cupoEstado.color, borderRadius: 2, transition: "width .4s ease" }} />
      </div>

      {/* Precio */}
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

// ── Modal Detalle ─────────────────────────────────────────────────
function ModalDetalle({ clase, inscripciones, miembros, txs, gymId, canManage, planes, onEditClase, onClose, onAddTx }) {
  const planVinculado = (planes || []).find(p =>
    (p.clases_vinculadas || []).map(String).includes(String(clase.id))
  );
  const precio = planVinculado?.precio_publico ?? clase?.precio_membresia ?? null;
  const ciclo  = planVinculado?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";

  const [busqueda, setBusqueda] = useState("");
  const [cobrandoId, setCobrandoId] = useState(null);

  // Calcular días restantes
  const diasRestantes = (vence) => {
    if (!vence) return null;
    return Math.ceil((new Date(vence + "T00:00:00") - new Date()) / 86400000);
  };

  const alumnos = useMemo(() => {
    let lista;
    if (!planVinculado) {
      lista = inscripciones
        .filter(i => i.clase_id === clase.id && i.estado === "activa")
        .map(ins => {
          const m = miembros.find(m => String(m.id) === String(ins.miembro_id));
          if (!m) return null;
          return { miembro: m, info: getMembershipInfo(m.id, txs || [], m) };
        }).filter(Boolean);
    } else {
      lista = miembros.map(m => {
        const info = getMembershipInfo(m.id, txs || [], m);
        if (info.estado !== "Activo") return null;
        const pn = (planVinculado.nombre || "").toLowerCase().trim();
        const ip = (info.plan || "").toLowerCase().trim();
        if (!(pn === ip || pn.includes(ip) || ip.includes(pn))) return null;
        return { miembro: m, info };
      }).filter(Boolean);
    }

    // Ordenar: por vencer (≤7 días) primero, luego por días restantes asc
    return lista.sort((a, b) => {
      const da = diasRestantes(a.info.vence) ?? 9999;
      const db = diasRestantes(b.info.vence) ?? 9999;
      return da - db;
    });
  }, [miembros, txs, inscripciones, clase.id, planVinculado]); // eslint-disable-line

  const alumnosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return alumnos;
    const q = busqueda.toLowerCase();
    return alumnos.filter(a => a.miembro.nombre.toLowerCase().includes(q) || (a.miembro.tel || "").includes(q));
  }, [alumnos, busqueda]);

  const porVencer = alumnos.filter(a => { const d = diasRestantes(a.info.vence); return d !== null && d <= 7; });
  const cupoEstado = getCupoEstado(alumnos.length, clase.cupo_max);

  const handleCobrar = async (miembro, info) => {
    setCobrandoId(miembro.id);
    try {
      if (onAddTx && precio > 0) {
        await onAddTx({
          tipo: "ingreso",
          monto: precio,
          desc: `Renovación ${clase.nombre} — ${miembro.nombre}`,
          miembro_id: miembro.id,
          plan: planVinculado?.nombre || clase.nombre,
          forma_pago: "Efectivo",
        });
      }
    } catch (e) { console.error(e); }
    setCobrandoId(null);
  };

  return (
    <Modal title={clase.nombre} onClose={onClose}>
      {/* Chips de resumen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ background: cupoEstado.bg, color: cupoEstado.color, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
          {alumnos.length} / {clase.cupo_max} · {cupoEstado.label}
        </span>
        {precio !== null && (
          <span style={{ background: "rgba(74,222,128,.12)", color: "#4ade80", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            {precio > 0 ? `$${Number(precio).toLocaleString("es-MX")} / ${CICLO_LABEL[ciclo] || ciclo}` : "Gratuita"}
          </span>
        )}
        {porVencer.length > 0 && (
          <span style={{ background: "rgba(248,113,113,.12)", color: "#f87171", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            ⚠️ {porVencer.length} por vencer
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

      {/* Alumnos */}
      <p style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>
        Alumnos ({alumnos.length})
      </p>

      {alumnos.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar alumno..."
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "9px 13px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      )}

      {/* Banner "Por vencer" cuando hay alumnos urgentes y no hay búsqueda activa */}
      {porVencer.length > 0 && !busqueda && (
        <div style={{ padding: "8px 12px", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          <p style={{ color: "#f87171", fontSize: 12 }}>
            <strong>{porVencer.length} alumno{porVencer.length !== 1 ? "s" : ""}</strong> con membresía por vencer en 7 días o menos. Se muestran primero.
          </p>
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
        const dias = diasRestantes(info.vence);
        const urgente = dias !== null && dias <= 7;
        const vencido = dias !== null && dias < 0;
        const cobrando = cobrandoId === m.id;

        return (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 14, marginBottom: 8,
            background: "var(--bg-elevated)",
            border: vencido ? "1px solid rgba(248,113,113,.4)" : urgente ? "1px solid rgba(245,158,11,.35)" : "1px solid var(--border)",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `${clase.color || "#6c63ff"}22`, color: clase.color || "#6c63ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : avatarIniciales(m.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.nombre}</p>
              <p style={{ color: vencido ? "#f87171" : urgente ? "#f59e0b" : "var(--text-tertiary)", fontSize: 11 }}>
                {edad !== null ? `${edad} años · ` : ""}
                {vencido ? `Venció hace ${Math.abs(dias)}d`
                  : urgente ? `⚠️ Vence en ${dias}d (${fmtDate(info.vence)})`
                  : info.vence ? `Vence: ${fmtDate(info.vence)}` : "Sin vencimiento"}
              </p>
            </div>
            {/* Botón cobrar renovación */}
            {canManage && precio > 0 && (
              <button
                onClick={() => handleCobrar(m, info)}
                disabled={cobrando}
                style={{
                  flexShrink: 0, padding: "5px 11px",
                  border: urgente || vencido ? "none" : "1px solid var(--border-strong)",
                  borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, fontWeight: 700,
                  background: urgente || vencido ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-card)",
                  color: urgente || vencido ? "#fff" : "var(--text-secondary)",
                  opacity: cobrando ? 0.5 : 1,
                  transition: "all .15s",
                }}
              >
                {cobrando ? "..." : "Cobrar"}
              </button>
            )}
          </div>
        );
      })}

      {canManage && (
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
  const [clases, setClases]               = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [planes, setPlanes]               = useState(planesProp || []);
  const [instructores, setInstructores]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [busqueda, setBusqueda]           = useState("");
  const [filtroDia, setFiltroDia]         = useState("todos");
  const [filtroEstado, setFiltroEstado]   = useState("activas"); // "activas" | "inactivas"
  const [modalClase, setModalClase]       = useState(null);
  const [modalDetalle, setModalDetalle]   = useState(null);

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

  const recargarPlanes = () => {
    supabase.from("planes_membresia").then(db => db.select(gymId)).then(pData => {
      if (pData) setPlanes(pData);
    }).catch(() => {});
  };

  const stats = useMemo(() => {
    const clasesActivas = clases.filter(c => c.activo !== false);
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
      const esActiva = c.activo !== false;
      if (filtroEstado === "activas" && !esActiva) return false;
      if (filtroEstado === "inactivas" && esActiva) return false;
      if (q && !c.nombre.toLowerCase().includes(q) && !(c.instructor_nombre || "").toLowerCase().includes(q)) return false;
      if (filtroDia !== "todos" && !(c.dias_semana || []).includes(filtroDia)) return false;
      return true;
    });
  }, [clases, busqueda, filtroDia, filtroEstado]);

  const handleGuardarClase = (saved, esEdicion) => {
    if (esEdicion) {
      setClases(p => p.map(c => c.id === saved.id ? saved : c));
      if (modalDetalle?.id === saved.id) setModalDetalle(saved);
    } else {
      setClases(p => [...p, saved]);
    }
    recargarPlanes();
    setModalClase(null);
  };

  const chipFiltro = (k, label, activo) => (
    <button
      key={k}
      onClick={() => k.startsWith("dia:") ? setFiltroDia(k.replace("dia:", "")) : setFiltroEstado(k)}
      style={{
        flexShrink: 0, padding: "5px 14px", border: "none", borderRadius: 20,
        cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
        background: activo ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
        color: activo ? "#fff" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );

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
            {canManage && (
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

          {/* Filtros — Estado + Días */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginTop: 10, alignItems: "center" }}>
            {/* Estado */}
            {chipFiltro("activas",   "Activas",   filtroEstado === "activas")}
            {chipFiltro("inactivas", "Inactivas", filtroEstado === "inactivas")}
            {/* Separador */}
            <div style={{ width: 1, height: 18, background: "var(--border-strong)", flexShrink: 0, margin: "0 2px" }} />
            {/* Días */}
            {chipFiltro("dia:todos", "Todos", filtroDia === "todos")}
            {DIAS.map(d => chipFiltro(`dia:${d.key}`, d.label, filtroDia === d.key))}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "14px 20px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(108,99,255,.2)", borderTopColor: "#6c63ff", margin: "0 auto 14px", animation: "spin .8s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Cargando clases...</p>
            </div>
          ) : clasesFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>📭</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {busqueda || filtroDia !== "todos" ? "Sin resultados para este filtro" : filtroEstado === "inactivas" ? "No hay clases inactivas" : "Aún no hay clases creadas"}
              </p>
              {canManage && !busqueda && filtroDia === "todos" && filtroEstado === "activas" && (
                <button onClick={() => setModalClase("nueva")} style={{ marginTop: 12, border: "none", borderRadius: 12, padding: "10px 22px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff" }}>
                  + Crear primera clase
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, paddingBottom: 24 }}>
              {clasesFiltradas.map(c => (
                <ClaseCard
                  key={c.id} clase={c}
                  inscripciones={inscripciones} miembros={miembros} txs={txs} planes={planes}
                  canManage={canManage}
                  onSelect={setModalDetalle}
                  onEdit={cl => setModalClase(cl)}
                />
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
          gymId={gymId} canManage={canManage} planes={planes}
          onEditClase={() => { setModalClase(modalDetalle); setModalDetalle(null); }}
          onClose={() => setModalDetalle(null)}
          onAddTx={onAddTx}
        />
      )}
    </div>
  );
}
