// ─────────────────────────────────────────────
//  screens/MensajesScreen.jsx  —  REFACTORIZADO
//  Centro de Comunicación: 4 tabs
//    1. Vencimientos   (usa plantillas del sistema)
//    2. Individual     (+ sección Plantillas del sistema)
//    3. Masivo         (sin cambios de UX)
//    4. Mensajes del sistema  ← NUEVO
//
//  Props: (mismas que antes, + gymId)
//    miembros, txs, gymConfig, gymId
//    onBack, onUpdatePlantillas
//    miembroInicial, modoInicial
//    recordatoriosEnviados, onMarcarRecordatorio
// ─────────────────────────────────────────────

import { useState, useMemo, useCallback } from "react";
import {
  getMembershipInfo,
  diasParaVencer,
  buildWAUrl,           // helper original — se mantiene para compatibilidad
} from "../utils/constants";
import {
  replaceTemplateVars,
  resolveRecipient,
  buildWhatsappLink,
  copyToClipboard,
  buildVarsFromMember,
  mapDiasToTemplateKey,
  SYSTEM_TEMPLATE_KEYS,
} from "../utils/communicationHelpers";
import { useCommunication } from "../hooks/useCommunication";

// ─────────────────────────────────────────────
//  Sub-componente: GuardarEnSlot  (sin cambios)
// ─────────────────────────────────────────────
function GuardarEnSlot({ tplsCustom, onGuardar }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(p => !p)}
        title="Guardar en mis mensajes"
        style={{
          width: 36, height: 36,
          border: "1px solid rgba(108,99,255,.3)", borderRadius: 10,
          background: open ? "rgba(108,99,255,.2)" : "transparent",
          cursor: "pointer", color: "#a78bfa", fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >💾</button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 42, zIndex: 50,
          background: "#1e1e30", border: "1px solid rgba(108,99,255,.3)",
          borderRadius: 14, padding: 10, width: 220,
          boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        }}>
          <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>
            Guardar en...
          </p>
          {tplsCustom.map((slot, i) => {
            const ocupado = slot.label.trim() || slot.msg.trim();
            return (
              <button key={i} onClick={() => { onGuardar(i); setOpen(false); }}
                style={{ width: "100%", padding: "9px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "transparent", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{ocupado ? "⭐" : "○"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: ocupado ? "#fff" : "#8b949e", fontSize: 12, fontWeight: ocupado ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ocupado ? slot.label || `Mensaje ${i + 1}` : `Slot ${i + 1} — vacío`}
                  </p>
                  {ocupado && <p style={{ color: "#f59e0b", fontSize: 10, marginTop: 1 }}>⚠️ se sobreescribirá</p>}
                </div>
              </button>
            );
          })}
          <button onClick={() => setOpen(false)} style={{ width: "100%", padding: "7px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "#1c2128", color: "#8b949e", marginTop: 4 }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Sub-componente: PlantillaCustom  (sin cambios)
// ─────────────────────────────────────────────
function PlantillaCustom({ index, tpl, nombreMiembro, gymNom, onUsar, onGuardar }) {
  const [editando,  setEditando]  = useState(false);
  const [form,      setForm]      = useState({ label: tpl.label, msg: tpl.msg });
  const [guardando, setGuardando] = useState(false);

  const tieneContenido = tpl.label.trim() || tpl.msg.trim();
  const msgFinal = (form.msg || "").replace(/\{nombre\}/g, nombreMiembro).replace(/\{student_name\}/g, nombreMiembro);

  const handleGuardar = async () => {
    setGuardando(true);
    await onGuardar({ icon: "⭐", label: form.label, msg: form.msg });
    setGuardando(false);
    setEditando(false);
  };

  if (editando) {
    return (
      <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 14, padding: 14 }}>
        <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Mensaje {index + 1}</p>
        <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Nombre del mensaje" style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 8 }} />
        <textarea value={form.msg} onChange={e => setForm(p => ({ ...p, msg: e.target.value }))} placeholder={`Escribe el mensaje. Usa {student_name} para el nombre. — ${gymNom}`} rows={4}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 8 }} />
        {form.msg.trim() && (
          <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
            <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Vista previa</p>
            <p style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>{msgFinal}</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setEditando(false); setForm({ label: tpl.label, msg: tpl.msg }); }}
            style={{ flex: 1, padding: "10px", border: "1px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!form.label.trim() || !form.msg.trim() || guardando}
            style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: form.label.trim() && form.msg.trim() ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "#21262d", color: form.label.trim() && form.msg.trim() ? "#fff" : "#8b949e" }}>
            {guardando ? "Guardando…" : "💾 Guardar"}
          </button>
        </div>
      </div>
    );
  }

  if (tieneContenido) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{tpl.label}</p>
          <p style={{ color: "#8b949e", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.msg}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onUsar(tpl.msg.replace(/\{nombre\}/g, nombreMiembro).replace(/\{student_name\}/g, nombreMiembro), tpl.label)}
            style={{ padding: "6px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff" }}>
            Usar
          </button>
          <button onClick={() => { setForm({ label: tpl.label, msg: tpl.msg }); setEditando(true); }}
            style={{ padding: "6px 10px", border: "1px solid var(--border-strong)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            ✏️
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => { setForm({ label: "", msg: "" }); setEditando(true); }}
      style={{ width: "100%", padding: "12px 14px", border: "1px dashed rgba(108,99,255,.3)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16, color: "#6c63ff" }}>＋</span>
      <span style={{ color: "#8b949e", fontSize: 12 }}>Mensaje guardado {index + 1} — toca para crear</span>
    </button>
  );
}

// ─────────────────────────────────────────────
//  Sub-componente: SystemMessageCard
//  Tarjeta individual en el tab "Mensajes del sistema"
// ─────────────────────────────────────────────
function SystemMessageCard({ meta, template, automation, onToggle, onOffsetChange, onSave, onReset }) {
  const [editing,   setEditing]  = useState(false);
  const [editText,  setEditText] = useState("");
  const [saving,    setSaving]   = useState(false);
  const [resetting, setResetting] = useState(false);

  const isActive    = automation?.is_active ?? false;
  const offsetDays  = automation?.trigger_offset_days ?? 1;
  const bodyText    = template?.body_text || "";
  const preview     = bodyText.length > 90 ? bodyText.slice(0, 90) + "…" : bodyText;

  const handleEdit = () => {
    setEditText(bodyText);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(template?.id, editText);
    setSaving(false);
    setEditing(false);
  };

  const handleReset = async () => {
    setResetting(true);
    await onReset(meta.key);
    setResetting(false);
    setEditing(false);
  };

  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${isActive ? "rgba(108,99,255,.3)" : "var(--border)"}`,
      borderRadius: 16, padding: 14, marginBottom: 10,
      transition: "border .2s",
    }}>
      {/* Header: icono + nombre + switch */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{meta.name}</p>
          <p style={{ color: "#8b949e", fontSize: 11, marginTop: 2 }}>{meta.when}</p>
        </div>
        {/* Switch activo/inactivo */}
        <div
          onClick={() => onToggle(meta.key, !isActive)}
          style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0,
            background: isActive ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.1)",
            cursor: "pointer", position: "relative", transition: "background .2s",
          }}
        >
          <div style={{
            position: "absolute", top: 3, left: isActive ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%",
            background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)",
          }} />
        </div>
      </div>

      {/* Días antes (solo si hasOffset y activo) */}
      {meta.hasOffset && isActive && !editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px" }}>
          <p style={{ color: "#8b949e", fontSize: 11, flex: 1 }}>
            {offsetDays >= 0
              ? `Enviar ${offsetDays} día${offsetDays !== 1 ? "s" : ""} antes del vencimiento`
              : `Enviar ${Math.abs(offsetDays)} día${Math.abs(offsetDays) !== 1 ? "s" : ""} después del vencimiento`
            }
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 5, 7].map(d => (
              <button
                key={d}
                onClick={() => onOffsetChange(meta.key, d)}
                style={{
                  padding: "4px 8px", border: "none", borderRadius: 7,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, fontWeight: 600,
                  background: offsetDays === d ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-card)",
                  color: offsetDays === d ? "#fff" : "#8b949e",
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vista previa del mensaje */}
      {!editing && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>
            Mensaje
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.5 }}>{preview}</p>
        </div>
      )}

      {/* Editor inline */}
      {editing && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>
            Editando mensaje
          </p>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={6}
            style={{
              width: "100%", background: "var(--bg-elevated)",
              border: "1px solid rgba(108,99,255,.4)", borderRadius: 10,
              padding: "10px 12px", color: "var(--text-primary)", fontSize: 12,
              fontFamily: "inherit", outline: "none", resize: "vertical",
              lineHeight: 1.6, marginBottom: 6,
            }}
          />
          <p style={{ color: "#8b949e", fontSize: 10, lineHeight: 1.5 }}>
            Variables: {"{student_name}"} · {"{due_date}"} · {"{concept}"} · {"{amount}"} · {"{clabe}"} · {"{bank}"} · {"{propietario}"}
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: "flex", gap: 8 }}>
        {!editing ? (
          <>
            <button onClick={handleEdit}
              style={{ flex: 2, padding: "8px", border: "1px solid rgba(108,99,255,.3)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#a78bfa" }}>
              ✏️ Editar mensaje
            </button>
            <button onClick={handleReset} disabled={resetting}
              style={{ flex: 1, padding: "8px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: "#8b949e" }}>
              {resetting ? "…" : "↺ Restaurar"}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(false)}
              style={{ flex: 1, padding: "8px", border: "1px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button onClick={handleReset} disabled={resetting}
              style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: "#8b949e" }}>
              {resetting ? "…" : "↺ Default"}
            </button>
            <button onClick={handleSave} disabled={saving || !editText.trim()}
              style={{ flex: 2, padding: "8px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: editText.trim() ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "#21262d", color: editText.trim() ? "#fff" : "#8b949e" }}>
              {saving ? "Guardando…" : "💾 Guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MensajesScreen  —  Export principal
// ─────────────────────────────────────────────
export default function MensajesScreen({
  miembros,
  txs,
  gymConfig,
  gymId,
  onBack,
  onUpdatePlantillas,
  miembroInicial,
  modoInicial,
  recordatoriosEnviados = {},
  onMarcarRecordatorio,
  waQueue = [],
  onUpdateWaQueue,
}) {
  const [modo,       setModo]      = useState(modoInicial || (miembroInicial ? "individual" : ((waQueue||[]).filter(m=>!m.enviado).length > 0 ? "pendientes" : "vencimientos")));
  const [enviados,   setEnviados]  = useState({});
  const [selMiembro, setSelMiembro] = useState(miembroInicial || null);
  const [busqueda,   setBusqueda]  = useState("");
  const [msgTexto,   setMsgTexto]  = useState("");
  const [msgOrigen,  setMsgOrigen] = useState(null); // eslint-disable-line no-unused-vars
  const [copiadoMsg, setCopiadoMsg] = useState(false);
  const [copiadoNums, setCopiadoNums] = useState(false);

  // ── Hook de comunicación ──
  const {
    templates,
    automations,
    loading: commLoading,
    dbAvailable,
    getTemplate,
    getSystemTemplates,
    getQuickTemplates,
    saveTemplate,
    resetTemplate,
    toggleAutomation,
    updateOffset,
  } = useCommunication(gymId);

  const gymNom     = gymConfig?.nombre || "GymFit Pro";
  const tplsCustom = gymConfig?.plantillas_wa || [
    { icon: "⭐", label: "", msg: "" },
    { icon: "⭐", label: "", msg: "" },
    { icon: "⭐", label: "", msg: "" },
  ];

  // Plantillas rápidas: primero desde DB, fallback a hardcoded
  const tplsRapidas = useMemo(() => {
    const fromDB = getQuickTemplates();
    if (fromDB.length > 0) return fromDB;
    return [
      { id: "q1", icon: "🚫", name: "Clase cancelada",  body_text: "¡Hola {student_name}! La clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏" },
      { id: "q2", icon: "⏰", name: "Cambio de horario", body_text: "¡Hola {student_name}! Aviso: hubo un cambio de horario. El nuevo horario es a las 7:00pm 📅" },
      { id: "q3", icon: "🏋️", name: "Evento especial",  body_text: `¡Hola {student_name}! 🔥 Te invitamos a nuestro evento especial este sábado. ¡Esperamos verte! — ${gymNom}` },
      { id: "q4", icon: "🛑", name: "Cierre temporal",  body_text: `¡Hola {student_name}! El gym estará cerrado mañana por mantenimiento 🛑 — ${gymNom}` },
    ];
  }, [getQuickTemplates, gymNom]);

  // ── Construir mensaje de vencimiento desde plantilla ──
  const buildVencimientoMsg = useCallback((miembro, diasReales, memInfo) => {
    const templateKey = mapDiasToTemplateKey(diasReales);
    const tpl = getTemplate(templateKey);

    // Si no hay template en DB, usar buildWAMsg original como fallback
    if (!tpl) {
      // Fallback: lógica anterior
      const nombre   = miembro.nombre.split(" ")[0];
      const vence    = memInfo?.vence || "";
      const plan     = memInfo?.plan || "";
      const gym      = gymNom;
      const planStr  = plan ? ` *${plan}*` : "";
      if (diasReales === 0) return `¡Hola ${nombre}! 🚨 Tu membresía${planStr} en *${gym}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`;
      if (diasReales <= 3)  return `¡Hola ${nombre}! ⏰ Tu membresía${planStr} vence en *${diasReales} días* (${vence}). No pierdas tu acceso al gym 🔥`;

      // Template largo (1 día): usar recordatorio_tpl de gymConfig
      const recordatorioTpl = gymConfig?.recordatorio_tpl || tpl?.body_text || "";
      return recordatorioTpl
        .replace(/\{nombre\}/gi,             nombre)
        .replace(/\{student_name\}/gi,       nombre)
        .replace(/\{fecha\}/gi,              vence)
        .replace(/\{due_date\}/gi,           vence)
        .replace(/\{clabe\}/gi,              gymConfig?.transferencia_clabe || "")
        .replace(/\{titular\}/gi,            gymConfig?.transferencia_titular || "")
        .replace(/\{banco\}/gi,              gymConfig?.transferencia_banco || "")
        .replace(/\{bank\}/gi,               gymConfig?.transferencia_banco || "")
        .replace(/\{propietario\}/gi,        gymConfig?.propietario_nombre || gym)
        .replace(/\{propietario_titulo\}/gi, gymConfig?.propietario_titulo || "")
        .replace(/\{gym\}/gi,                gym)
        .replace(/\{plan\}/gi,               plan)
        .replace(/\{concept\}/gi,            plan);
    }

    // Con template de DB
    const vars = buildVarsFromMember(miembro, memInfo, gymConfig);
    return replaceTemplateVars(tpl.body_text, vars);
  }, [getTemplate, gymConfig, gymNom]);

  // ── Alertas: miembros activos que vencen en ≤5 días ──
  const alertas = useMemo(() => {
    const result = [];
    miembros
      .filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo")
      .forEach(m => {
        const info       = getMembershipInfo(m.id, txs, m);
        const diasReales = diasParaVencer(info.vence);
        if (diasReales === null || diasReales < 0 || diasReales > 5) return;
        result.push({ miembro: m, diasReales, memInfo: info });
      });
    result.sort((a, b) => a.diasReales - b.diasReales);
    return result;
  }, [miembros, txs]);

  const pendientes = alertas.filter(({ miembro }) => !enviados[miembro.id]).length;
  const pendientesWA = (waQueue || []).filter(m => !m.enviado).length;
  const totalBadge = pendientes + pendientesWA;

  const urgColor = (d) => d <= 1 ? "#f43f5e" : d <= 3 ? "#f59e0b" : "#22d3ee";
  const urgLabel = (d) => d === 0 ? "HOY 🚨" : d === 1 ? "MAÑANA" : `${d}d`;

  // ── Envío WA ──
  const enviarWA = (tel, msg, miembroId) => {
    window.open(buildWAUrl(tel, msg), "_blank");
    if (miembroId) {
      setEnviados(p => ({ ...p, [miembroId]: true }));
      if (onMarcarRecordatorio) onMarcarRecordatorio(miembroId);
    }
  };
  const enviarWAIndividual = (tel, msg, miembroId) => {
    window.open(buildWAUrl(tel, msg), "_blank");
    if (miembroId && onMarcarRecordatorio) onMarcarRecordatorio(miembroId);
  };

  const selNombre1 = selMiembro?.nombre?.split(" ")[0] || "";
  const destMasivo = miembros.filter(mb => getMembershipInfo(mb.id, txs, mb).estado === "Activo" && mb.tel);

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    setMsgTexto("");
    setMsgOrigen(null);
    setCopiadoMsg(false);
    setCopiadoNums(false);
  };

  // ── Tabs: 4 modos ──
  const modos = [
    { k: "pendientes",         icon: "📬", label: "Pendientes",  badge: pendientesWA },
    { k: "vencimientos",       icon: "⏰", label: "Vencimientos" },
    { k: "individual",         icon: "👤", label: "Individual"   },
    { k: "masivo",             icon: "📢", label: "Masivo"       },
    { k: "mensajes_sistema",   icon: "⚙️", label: "Sistema"      },
  ];

  const btnModoBase = (activo) => ({
    flex: 1, padding: "9px 4px",
    border: "none", borderRadius: 11,
    cursor: "pointer", fontFamily: "inherit",
    background: activo ? "linear-gradient(135deg,#25d366,#128c7e)" : "transparent",
    color: activo ? "#fff" : "#8b949e",
    fontSize: 10, fontWeight: activo ? 700 : 500,
    boxShadow: activo ? "0 2px 12px rgba(37,211,102,.3)" : "none",
    transition: "all .2s",
  });

  const textareaStyle = {
    width: "100%", background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)", borderRadius: 14,
    padding: "14px", color: "var(--text-primary)", fontSize: 13,
    fontFamily: "inherit", outline: "none", resize: "none",
    lineHeight: 1.6, marginBottom: 6,
  };

  // ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Header fijo ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "#21262d", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0 }}>←</button>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700 }}>💬 Mensajes</h1>
              <p style={{ color: "#8b949e", fontSize: 11 }}>Centro de comunicación WhatsApp</p>
            </div>
            {totalBadge > 0 && (
              <span style={{ background: "#f43f5e", color: "#fff", borderRadius: 10, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
                {totalBadge}
              </span>
            )}
          </div>

          {/* Selector de modos */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", borderRadius: 14, padding: 4, marginBottom: 14, overflowX: "auto" }}>
            {modos.map(m => (
              <button key={m.k} onClick={() => cambiarModo(m.k)} style={{ ...btnModoBase(modo === m.k), position: "relative", flexShrink: 0 }}>
                {m.icon} {m.label}
                {m.badge > 0 && (
                  <span style={{
                    position: "absolute", top: 2, right: 2,
                    background: "#f43f5e", color: "#fff",
                    borderRadius: "50%", width: 14, height: 14,
                    fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{m.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido scrollable ── */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "0 20px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

          {/* ════ MODO: PENDIENTES (WA Queue) ════ */}
          {modo === "pendientes" && (() => {
            const queue = waQueue || [];
            const marcarEnviado = (id) => {
              const updated = queue.map(m => m.id === id ? { ...m, enviado: true } : m);
              if (onUpdateWaQueue) onUpdateWaQueue(updated);
            };
            const eliminar = (id) => {
              const updated = queue.filter(m => m.id !== id);
              if (onUpdateWaQueue) onUpdateWaQueue(updated);
            };
            const fmtShort = (iso) => {
              if (!iso) return "—";
              const [y, mo, d] = iso.split("-");
              const M = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
              return `${parseInt(d)} ${M[parseInt(mo)-1]} ${y}`;
            };
            return (
              <>
                {queue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "50px 0" }}>
                    <p style={{ fontSize: 40, marginBottom: 12 }}>📬</p>
                    <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700 }}>Sin mensajes pendientes</p>
                    <p style={{ color: "#8b949e", fontSize: 12, marginTop: 6 }}>Los mensajes de bienvenida aparecerán aquí al agregar miembros</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                      <p style={{ color: "#a78bfa", fontSize: 12 }}>
                        📬 {queue.filter(m => !m.enviado).length} pendiente{queue.filter(m => !m.enviado).length !== 1 ? "s" : ""} de enviar · {queue.filter(m => m.enviado).length} enviado{queue.filter(m => m.enviado).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {queue.map(entry => {
                      const col = entry.enviado ? "var(--border)" : "#6c63ff";
                      return (
                        <div key={entry.id} style={{
                          background: entry.enviado ? "var(--bg-card)" : "rgba(108,99,255,.06)",
                          border: `1px solid ${entry.enviado ? "var(--border)" : "rgba(108,99,255,.3)"}`,
                          borderRadius: 18, padding: 14, marginBottom: 12,
                          opacity: entry.enviado ? 0.65 : 1, transition: "all .3s",
                        }}>
                          {/* Header */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div style={{
                              width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                              background: "linear-gradient(135deg,#6c63ff33,#e040fb33)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 17, fontWeight: 700, color: "#a78bfa",
                            }}>
                              {(entry.nombreMiembro || "?").charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>{entry.nombreMiembro}</p>
                              <p style={{ color: "#8b949e", fontSize: 11 }}>
                                {entry.plan || "Sin plan"} · {entry.tel || "Sin número"}
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {entry.enviado ? (
                                <span style={{ background: "rgba(74,222,128,.15)", color: "#4ade80", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>✓ Enviado</span>
                              ) : (
                                <span style={{ background: "rgba(108,99,255,.2)", color: "#a78bfa", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>📬 Pendiente</span>
                              )}
                            </div>
                          </div>

                          {/* Detalles membresía */}
                          {entry.plan && (
                            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
                              {[
                                ["Plan", entry.plan],
                                ["Monto", "$" + Number(entry.monto || 0).toLocaleString("es-MX")],
                                ["Pago", entry.formaPago || "—"],
                                ["Vence", fmtShort(entry.venceISO)],
                              ].map(([l, v]) => (
                                <div key={l}>
                                  <p style={{ color: "#8b949e", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>{l}</p>
                                  <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>{v}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comprobante si existe */}
                          {entry.comprobantePNG && (() => {
                            const [expanded, setExpanded] = window._compState = window._compState || {};
                            return (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                  <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>🧾 Comprobante</p>
                                  <a href={entry.comprobantePNG} download={`recibo-${(entry.nombreMiembro||"").replace(/\s+/g,"-")}.png`}
                                    style={{ color: "#6c63ff", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>📥 Descargar</a>
                                </div>
                                <div style={{ maxHeight: 180, overflow: "hidden", borderRadius: 10, border: "1px solid var(--border)", position: "relative", cursor: "pointer" }}
                                  onClick={e => { const el = e.currentTarget; el.style.maxHeight = el.style.maxHeight === "none" ? "180px" : "none"; }}>
                                  <img src={entry.comprobantePNG} alt="Comprobante" style={{ width: "100%", display: "block" }} />
                                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(transparent, rgba(0,0,0,.5))", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6, pointerEvents: "none" }}>
                                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>Toca para ver completo</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Mensaje WA editable */}
                          <textarea
                            value={entry._editMsg !== undefined ? entry._editMsg : entry.msg}
                            onChange={e => {
                              const updated = queue.map(m => m.id === entry.id ? { ...m, _editMsg: e.target.value } : m);
                              if (onUpdateWaQueue) onUpdateWaQueue(updated);
                            }}
                            rows={4}
                            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, marginBottom: 8 }}
                          />

                          {/* Botones */}
                          <div style={{ display: "flex", gap: 8 }}>
                            {!entry.enviado && entry.tel && (
                              <button
                                onClick={() => {
                                  const msg = entry._editMsg !== undefined ? entry._editMsg : entry.msg;
                                  const clean = (entry.tel || "").replace(/\D/g, "");
                                  const phone = clean.startsWith("52") ? clean : `52${clean}`;
                                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                                  marcarEnviado(entry.id);
                                }}
                                style={{
                                  flex: 2, padding: "11px", border: "none", borderRadius: 12,
                                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                                  background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff",
                                  boxShadow: "0 4px 14px rgba(37,211,102,.3)",
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                                }}
                              >
                                <span style={{ fontSize: 16 }}>💬</span> Enviar por WhatsApp
                              </button>
                            )}
                            {entry.enviado && (
                              <button
                                onClick={() => {
                                  const msg = entry._editMsg !== undefined ? entry._editMsg : entry.msg;
                                  const clean = (entry.tel || "").replace(/\D/g, "");
                                  const phone = clean.startsWith("52") ? clean : `52${clean}`;
                                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                                }}
                                style={{ flex: 2, padding: "11px", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: "rgba(37,211,102,.08)", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                              >
                                <span>🔁</span> Reenviar
                              </button>
                            )}
                            <button
                              onClick={() => eliminar(entry.id)}
                              style={{ flex: 1, padding: "11px", border: "1px solid rgba(248,113,113,.25)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "rgba(248,113,113,.08)", color: "#f87171" }}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}

          {/* ════ MODO: VENCIMIENTOS ════ */}
          {modo === "vencimientos" && (
            <>
              {alertas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <p style={{ fontSize: 40, marginBottom: 12 }}>🎉</p>
                  <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700 }}>¡Sin vencimientos próximos!</p>
                  <p style={{ color: "#8b949e", fontSize: 12, marginTop: 6 }}>Todos los miembros tienen su membresía al día</p>
                </div>
              ) : (
                alertas.map(({ miembro, diasReales, memInfo }) => {
                  const col     = urgColor(diasReales);
                  const enviado = !!enviados[miembro.id];
                  // ← CAMBIO: usar plantilla del sistema en lugar de buildWAMsg
                  const msg     = buildVencimientoMsg(miembro, diasReales, memInfo);
                  return (
                    <div
                      key={miembro.id}
                      style={{
                        background: enviado ? "var(--bg-card)" : `${col}10`,
                        border: `1px solid ${enviado ? "var(--border)" : col + "35"}`,
                        borderRadius: 18, padding: 14, marginBottom: 12,
                        opacity: enviado ? 0.65 : 1, transition: "all .3s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: `${col}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: col, border: `2px solid ${col}50` }}>
                          {miembro.foto
                            ? <img src={miembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : miembro.nombre.charAt(0)
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>{miembro.nombre}</p>
                          <p style={{ color: "#8b949e", fontSize: 11 }}>{memInfo.plan} · {miembro.tel || "Sin número"}</p>
                        </div>
                        <span style={{ background: enviado ? "rgba(74,222,128,.15)" : `${col}25`, color: enviado ? "#4ade80" : col, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                          {enviado ? "✓" : urgLabel(diasReales)}
                        </span>
                      </div>

                      <textarea
                        value={enviado ? msg : (enviados["msg_" + miembro.id] ?? msg)}
                        onChange={e => setEnviados(p => ({ ...p, ["msg_" + miembro.id]: e.target.value }))}
                        rows={3}
                        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, marginBottom: 8 }}
                      />

                      <button
                        onClick={() => enviarWA(miembro.tel, enviados["msg_" + miembro.id] ?? msg, miembro.id)}
                        disabled={!miembro.tel}
                        style={{
                          width: "100%", padding: "11px", border: "none", borderRadius: 12,
                          cursor: miembro.tel ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                          background: enviado ? "rgba(74,222,128,.12)" : miembro.tel ? "linear-gradient(135deg,#25d366,#128c7e)" : "#21262d",
                          color: enviado ? "#4ade80" : miembro.tel ? "#fff" : "#8b949e",
                          boxShadow: !enviado && miembro.tel ? "0 4px 14px rgba(37,211,102,.3)" : "none",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        }}
                      >
                        {enviado ? "✓ Enviado" : miembro.tel ? "💬 Enviar por WhatsApp" : "Sin número registrado"}
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ════ MODO: INDIVIDUAL ════ */}
          {modo === "individual" && (
            <>
              {/* Vista A: Selección de miembro */}
              {!selMiembro && (
                <>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#8b949e", pointerEvents: "none" }}>🔍</span>
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar miembro..."
                      style={{ width: "100%", background: "#21262d", border: "1px solid #30363d", borderRadius: 12, padding: "10px 12px 10px 36px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                    />
                    {busqueda && (
                      <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8b949e", fontSize: 16, cursor: "pointer", padding: 2 }}>✕</button>
                    )}
                  </div>

                  {(() => {
                    const conTel    = miembros.filter(m => m.tel);
                    const filtrados = busqueda.trim()
                      ? conTel.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || m.tel.includes(busqueda))
                      : conTel;
                    const sinTel    = miembros.filter(m => !m.tel).length;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {filtrados.length === 0 && <p style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No se encontró "{busqueda}"</p>}
                        {filtrados.map(m => (
                          <button key={m.id} onClick={() => { setSelMiembro(m); setMsgTexto(""); setMsgOrigen(null); setBusqueda(""); }}
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                              {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                            </div>
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                              <p style={{ color: "#8b949e", fontSize: 11 }}>📱 {m.tel}</p>
                            </div>
                            <span style={{ color: "#8b949e", fontSize: 14 }}>›</span>
                          </button>
                        ))}
                        {sinTel > 0 && !busqueda && <p style={{ color: "#8b949e", fontSize: 11, textAlign: "center", padding: "6px 0" }}>{sinTel} miembro{sinTel > 1 ? "s" : ""} sin número no aparecen</p>}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Vista B: Composición de mensaje */}
              {selMiembro && (
                <>
                  {/* Header destinatario */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(108,99,255,.1)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                      {selMiembro.foto ? <img src={selMiembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selMiembro.nombre.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>{selMiembro.nombre}</p>
                      <p style={{ color: "#8b949e", fontSize: 11 }}>📱 {selMiembro.tel}</p>
                    </div>
                    <button onClick={() => { setSelMiembro(null); setMsgTexto(""); setMsgOrigen(null); }}
                      style={{ background: "#21262d", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", color: "#8b949e", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Cambiar ✕
                    </button>
                  </div>

                  {/* Textarea */}
                  <textarea
                    value={msgTexto}
                    onChange={e => setMsgTexto(e.target.value)}
                    placeholder={`Hola ${selNombre1}, escribe o elige una plantilla abajo...`}
                    rows={4} autoFocus
                    style={textareaStyle}
                  />
                  <p style={{ color: "#8b949e", fontSize: 11, textAlign: "right", marginBottom: 10 }}>{msgTexto.length} caracteres</p>

                  {/* Botón enviar */}
                  <button
                    onClick={() => enviarWAIndividual(selMiembro.tel, msgTexto.trim(), selMiembro.id)}
                    disabled={!msgTexto.trim()}
                    style={{
                      width: "100%", padding: "14px", border: "none", borderRadius: 14,
                      cursor: msgTexto.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                      background: msgTexto.trim() ? "linear-gradient(135deg,#25d366,#128c7e)" : "#21262d",
                      color: msgTexto.trim() ? "#fff" : "#8b949e",
                      boxShadow: msgTexto.trim() ? "0 4px 18px rgba(37,211,102,.35)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>💬</span>
                    {msgTexto.trim() ? `Enviar a ${selNombre1} por WhatsApp` : "Escribe o elige un mensaje"}
                  </button>

                  {/* Mis mensajes guardados */}
                  <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💾 Mis mensajes guardados</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {[0, 1, 2, 3].map(i => {
                      const slot = tplsCustom[i] || { icon: "⭐", label: "", msg: "" };
                      return (
                        <PlantillaCustom
                          key={i} index={i} tpl={slot}
                          nombreMiembro={selNombre1} gymNom={gymNom}
                          onUsar={(msg) => setMsgTexto(msg)}
                          onGuardar={async (nueva) => {
                            const nuevas = [...tplsCustom];
                            while (nuevas.length <= i) nuevas.push({ icon: "⭐", label: "", msg: "" });
                            nuevas[i] = nueva;
                            await onUpdatePlantillas(nuevas);
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* ← NUEVO: Plantillas del sistema */}
                  {getSystemTemplates().length > 0 && (
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                        <span>⚙️ Plantillas del sistema</span>
                        <span style={{ color: "#8b949e", fontSize: 10, fontWeight: 400, marginLeft: "auto" }}>toca para ver ›</span>
                      </summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                        {getSystemTemplates().map(tpl => {
                          const memInfo = getMembershipInfo(selMiembro.id, txs, selMiembro);
                          const vars    = buildVarsFromMember(selMiembro, memInfo, gymConfig);
                          const msgFinal = replaceTemplateVars(tpl.body_text, vars);
                          return (
                            <button key={tpl.id} onClick={() => setMsgTexto(msgFinal)}
                              style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "#161b22", border: `1px solid ${msgTexto === msgFinal ? "rgba(37,211,102,.3)" : "#21262d"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all .2s" }}>
                              <span style={{ fontSize: 16 }}>⚙️</span>
                              <span style={{ color: msgTexto === msgFinal ? "#4ade80" : "#8b949e", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name}</span>
                              {msgTexto === msgFinal && <span style={{ color: "#4ade80" }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {/* Plantillas rápidas */}
                  <details style={{ marginBottom: 14 }}>
                    <summary style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                      <span>⚡ Plantillas rápidas</span>
                      <span style={{ color: "#8b949e", fontSize: 10, fontWeight: 400, marginLeft: "auto" }}>toca para ver ›</span>
                    </summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {tplsRapidas.map((tpl, i) => {
                        const vars     = { student_name: selNombre1 };
                        const msgFinal = replaceTemplateVars(tpl.body_text || tpl.msg || "", vars);
                        return (
                          <button key={tpl.id || i} onClick={() => setMsgTexto(msgFinal)}
                            style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "#161b22", border: `1px solid ${msgTexto === msgFinal ? "rgba(37,211,102,.3)" : "#21262d"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all .2s" }}>
                            <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                            <span style={{ color: msgTexto === msgFinal ? "#4ade80" : "#8b949e", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name || tpl.label}</span>
                            {msgTexto === msgFinal && <span style={{ color: "#4ade80" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                </>
              )}
            </>
          )}

          {/* ════ MODO: MASIVO ════ (sin cambios de UX) */}
          {modo === "masivo" && (
            <>
              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Mensaje para todos</p>
              <textarea
                value={msgTexto}
                onChange={e => setMsgTexto(e.target.value)}
                placeholder={`Ej: Hola, la clase de hoy fue cancelada. Disculpen 🙏 — ${gymNom}`}
                rows={5} style={textareaStyle}
              />
              <p style={{ color: "#8b949e", fontSize: 11, textAlign: "right", marginBottom: 12 }}>{msgTexto.length} caracteres</p>

              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Plantillas rápidas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {tplsRapidas.map((tpl, i) => {
                  const msgFinal = tpl.body_text || tpl.msg || "";
                  return (
                    <button key={tpl.id || i} onClick={() => setMsgTexto(msgFinal)}
                      style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "var(--bg-card)", border: `1px solid ${msgTexto === msgFinal ? "rgba(37,211,102,.3)" : "var(--border)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all .2s" }}>
                      <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                      <span style={{ color: msgTexto === msgFinal ? "#4ade80" : "#8b949e", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name || tpl.label}</span>
                      {msgTexto === msgFinal && <span style={{ color: "#4ade80" }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {msgTexto.trim() && (
                <>
                  <div style={{ background: "rgba(37,211,102,.06)", border: "1px solid rgba(37,211,102,.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                    <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Destinatarios ({destMasivo.length})</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {destMasivo.map(mb => (
                        <div key={mb.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--bg-elevated)", borderRadius: 20, padding: "4px 10px 4px 4px" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                            {mb.foto ? <img src={mb.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mb.nombre.charAt(0)}
                          </div>
                          <span style={{ color: "#8b949e", fontSize: 11 }}>{mb.nombre.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {[
                    { num: 1, label: "Copia el mensaje", copiado: copiadoMsg,  action: () => { copyToClipboard(msgTexto); setCopiadoMsg(true); } },
                    { num: 2, label: "Copia los números", sub: `${destMasivo.length} contactos`, copiado: copiadoNums, action: () => { copyToClipboard(destMasivo.map(mb => mb.tel.replace(/\D/g, "")).join("\n")); setCopiadoNums(true); } },
                  ].map(step => (
                    <div key={step.num} style={{ background: "var(--bg-card)", border: step.copiado ? "1px solid rgba(37,211,102,.4)" : "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 8, transition: "border .3s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: step.copiado ? "rgba(37,211,102,.2)" : "var(--bg-elevated)", color: step.copiado ? "#4ade80" : "var(--text-primary)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                            {step.copiado ? "✓" : step.num}
                          </span>
                          <div>
                            <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{step.label}</p>
                            {step.sub && <p style={{ color: "#8b949e", fontSize: 10, marginTop: 2 }}>{step.sub}</p>}
                          </div>
                        </div>
                        <button onClick={step.action} style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: step.copiado ? "rgba(37,211,102,.2)" : "linear-gradient(135deg,#6c63ff,#e040fb)", color: step.copiado ? "#4ade80" : "#fff" }}>
                          {step.copiado ? "✓ Copiado" : "📋 Copiar"}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                    <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>3️⃣ Abre WhatsApp</p>
                    <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>Nueva lista de difusión → pega los números → pega el mensaje. Llega como mensaje privado a cada uno.</p>
                  </div>

                  <button onClick={() => window.open("https://wa.me", "_blank")}
                    style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", boxShadow: "0 4px 18px rgba(37,211,102,.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span> Abrir WhatsApp
                  </button>
                </>
              )}
            </>
          )}

          {/* ════ MODO: MENSAJES DEL SISTEMA ════ */}
          {modo === "mensajes_sistema" && (
            <>
              {/* Intro */}
              <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>⚙️ Centro de automatización</p>
                <p style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                  Aquí configuras los mensajes que el sistema envía automáticamente. Actívalos, personaliza el texto y ajusta cuántos días antes se envían.
                </p>
              </div>

              {commLoading && (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <p style={{ color: "#8b949e", fontSize: 13 }}>Cargando mensajes…</p>
                </div>
              )}

              {!commLoading && (
                <>
                  {/* Tarjetas de mensajes del sistema */}
                  {SYSTEM_TEMPLATE_KEYS.map(meta => {
                    const template   = getTemplate(meta.key);
                    const automation = automations.find(a => a.event_key === meta.key);
                    return (
                      <SystemMessageCard
                        key={meta.key}
                        meta={meta}
                        template={template}
                        automation={automation}
                        onToggle={toggleAutomation}
                        onOffsetChange={updateOffset}
                        onSave={saveTemplate}
                        onReset={resetTemplate}
                      />
                    );
                  })}

                  {/* Banner solo si hay gymId pero la DB no está inicializada */}
                  {!dbAvailable && !gymId && (
                    <div style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 14, padding: "14px 16px", marginTop: 4 }}>
                      <p style={{ color: "#f43f5e", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        ⚠️ Error de configuración — gymId no disponible
                      </p>
                      <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>
                        No se pudo determinar el ID del gimnasio. Verifica que hayas iniciado sesión correctamente y recarga la página.
                      </p>
                    </div>
                  )}
                  {!dbAvailable && gymId && (
                    <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 14, padding: "14px 16px", marginTop: 4 }}>
                      <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        📋 Modo vista previa — los cambios no se guardarán
                      </p>
                      <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>
                        Las tablas de comunicación aún no están inicializadas. Para activar el guardado, ejecuta en Supabase SQL Editor:
                      </p>
                      <code style={{ display: "block", background: "#0d1117", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#a78bfa", wordBreak: "break-all" }}>
                        {`SELECT seed_communication_templates('${gymId}');`}
                      </code>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
