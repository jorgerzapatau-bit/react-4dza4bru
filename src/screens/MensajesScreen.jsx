// ─────────────────────────────────────────────
//  screens/MensajesScreen.jsx  —  v3  "Bandeja Inteligente"
//
//  Tabs:
//    1. 📬 Bandeja     — cola inteligente del día, sin mensajes obsoletos
//    2. 👤 Individual  — mensaje a un miembro específico
//    3. 📢 Masivo      — mensaje a todos
//    4. ⚙️ Sistema     — configuración de plantillas automáticas
//
//  Lógica de caducidad y deduplicación:
//    • Recordatorios de pago: solo el MÁS URGENTE por alumno (nunca dos)
//      Si no enviaste el de 5 días y ya son 3 días, solo muestra el de 3.
//    • Cumpleaños: solo aparecen hoy (caducan al día siguiente)
//    • Cola WA (bienvenidas, recibos): caducan a los 3 días del timestamp
//    • Enviados se recuerdan durante el día (localStorage), se limpian al día siguiente
// ─────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  getMembershipInfo,
  diasParaVencer,
  diasParaCumple,
  calcEdad,
  buildWAUrl,
} from "../utils/constants";
import {
  replaceTemplateVars,
  copyToClipboard,
  buildVarsFromMember,
  mapDiasToTemplateKey,
  SYSTEM_TEMPLATE_KEYS,
} from "../utils/communicationHelpers";
import { useCommunication } from "../hooks/useCommunication";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return "—";
  const [y, mo, d] = iso.split("-");
  const M = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${parseInt(d)} ${M[parseInt(mo)-1]} ${y}`;
}

// ─────────────────────────────────────────────
//  resolveDestinatario
//  Si el miembro es menor de edad (< 18) Y tiene tutor registrado,
//  el mensaje va al tutor: nombre y teléfono del tutor.
//  Devuelve { tel, nombre, esMenor, tutorNombre, tutorParentesco }
// ─────────────────────────────────────────────
function resolveDestinatario(miembro) {
  const edad = calcEdad(miembro?.fecha_nacimiento);
  const esMenor = edad !== null && edad < 18;
  const tieneTutor = !!(miembro?.tutor_nombre && miembro?.tutor_telefono);

  if (esMenor && tieneTutor) {
    return {
      tel:             miembro.tutor_telefono,
      nombre:          miembro.tutor_nombre,
      esMenor:         true,
      tutorNombre:     miembro.tutor_nombre,
      tutorParentesco: miembro.tutor_parentesco || "Tutor",
      tutorFoto:       miembro.tutor_foto || null,
    };
  }
  return {
    tel:             miembro?.tel || miembro?.tutor_telefono || null,
    nombre:          miembro?.nombre || "",
    esMenor:         false,
    tutorNombre:     null,
    tutorParentesco: null,
    tutorFoto:       null,
  };
}

function AvatarCircle({ nombre, foto, size = 44, color = "var(--col-accent)" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${color}44, ${color}22)`,
      border: `2px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontSize: size * 0.4, fontWeight: 700, color,
    }}>
      {foto
        ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : (nombre || "?").charAt(0).toUpperCase()
      }
    </div>
  );
}

function UrgBadge({ dias, tipo }) {
  if (tipo === "birthday") return <span style={chip("var(--col-warning)")}>🎂 HOY</span>;
  if (tipo === "welcome")  return <span style={chip("var(--col-info)")}>🎉 Nuevo</span>;
  if (tipo === "waQueue")  return <span style={chip("var(--col-accent-text)")}>📬 Cola</span>;
  if (dias === 0) return <span style={chip("var(--col-danger)")}>🚨 HOY</span>;
  if (dias === 1) return <span style={chip("var(--col-warning)")}>⚡ 1 día</span>;
  if (dias <= 3)  return <span style={chip("var(--col-warning)")}>⏰ {dias}d</span>;
  return              <span style={chip("var(--col-info)")}>📅 {dias}d</span>;
}
const chip = (color) => ({
  background: `${color}20`, color, borderRadius: 8,
  padding: "3px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
});

const urgColor = (tipo, dias) => {
  if (tipo === "birthday") return "var(--col-warning)";
  if (tipo === "waQueue")  return "var(--col-accent-text)";
  if (tipo === "welcome")  return "var(--col-info)";
  if (dias === 0) return "var(--col-danger)";
  if (dias === 1) return "var(--col-warning)";
  if (dias <= 3)  return "var(--col-warning)";
  return "var(--col-info)";
};

const navBtn = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, width: 28, height: 28, padding: 0,
  cursor: "pointer", fontFamily: "inherit", fontSize: 16, color: "var(--text-primary)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const btnSec = {
  flex: 1, padding: "9px 12px",
  border: "1px solid var(--border-strong)", borderRadius: 10,
  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
  background: "var(--bg-elevated)", color: "var(--text-secondary)",
};

// ─────────────────────────────────────────────
//  TarjetaCola
// ─────────────────────────────────────────────
function TarjetaCola({ item, index, total, isCurrent, onEnviado, onSaltar, onEditMsg }) {
  const [editando, setEditando] = useState(false);
  const [texto,    setTexto]    = useState(item.msg);

  useEffect(() => { setTexto(item.msg); }, [item.msg]);

  const col = urgColor(item.tipo, item.diasReales);

  const enviarWA = () => {
    const clean = (item.tel || "").replace(/\D/g, "");
    const phone = clean.startsWith("52") ? clean : `52${clean}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, "_blank");
    onEnviado(item.id);
  };

  return (
    <div style={{
      background: item.enviado ? "var(--col-success-soft)" : isCurrent ? `${col}0d` : "var(--bg-card)",
      border: `1px solid ${item.enviado ? "var(--col-success-border)" : isCurrent ? col + "40" : "var(--border)"}`,
      borderRadius: 18, padding: 16, transition: "all .3s",
      opacity: item.enviado ? 0.65 : 1,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {/* Avatar: doble para menores, simple para adultos */}
        {item.esMenor ? (
          <div style={{ position: "relative", width: 52, height: 44, flexShrink: 0 }}>
            {/* Alumno (fondo) */}
            <div style={{ position: "absolute", left: 0, top: 2 }}>
              <AvatarCircle nombre={item.miembro?.nombre || item.nombreMiembro} foto={item.miembro?.foto} size={36} color={col} />
            </div>
            {/* Tutor (frente) */}
            <div style={{ position: "absolute", right: 0, bottom: 0, border: "2px solid var(--bg-card)", borderRadius: "50%" }}>
              <AvatarCircle nombre={item.tutorNombre} foto={item.tutorFoto} size={32} color="var(--col-warning)" />
            </div>
          </div>
        ) : (
          <AvatarCircle nombre={item.miembro?.nombre || item.nombreMiembro} foto={item.miembro?.foto} color={col} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {item.miembro?.nombre || item.nombreMiembro}
          </p>
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 1 }}>{item.tel || "Sin número"}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <UrgBadge dias={item.diasReales} tipo={item.tipo} />
          {item.enviado
            ? <span style={{ color: "var(--col-success)", fontSize: 10, fontWeight: 700 }}>✓ Enviado</span>
            : isCurrent && <span style={{ color: col, fontSize: 10, fontWeight: 700 }}>{index + 1}/{total}</span>
          }
        </div>
      </div>

      {/* Banner menor de edad */}
      {item.esMenor && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--col-warning-soft)", border: "1px solid var(--col-warning-border)", borderRadius: 10, padding: "7px 12px", marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>👨‍👩‍👧</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: "var(--col-warning)", fontSize: 11, fontWeight: 700 }}>Menor de edad — mensaje al tutor</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>{item.tutorParentesco}: <strong style={{ color: "var(--text-primary)" }}>{item.tutorNombre}</strong> · {item.tel}</p>
          </div>
        </div>
      )}

      {/* Datos de membresía */}
      {item.memInfo && item.tipo === "pago" && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          {[
            item.memInfo.plan  && ["Plan",  item.memInfo.plan],
            item.memInfo.monto && ["Monto", "$" + Number(item.memInfo.monto || 0).toLocaleString("es-MX")],
            item.memInfo.vence && ["Vence", fmtFecha(item.memInfo.vence)],
          ].filter(Boolean).map(([l, v]) => (
            <div key={l}>
              <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>{l}</p>
              <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Mensaje */}
      {editando ? (
        <div style={{ marginBottom: 10 }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} autoFocus
            style={{ width: "100%", background: "var(--bg-elevated)", border: `1px solid ${col}60`, borderRadius: 12, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={() => { setTexto(item.msg); setEditando(false); }} style={btnSec}>Cancelar</button>
            <button onClick={() => { onEditMsg(item.id, texto); setEditando(false); }}
              style={{ flex: 2, padding: "9px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${col},${col}cc)`, color: "#fff" }}>
              💾 Guardar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, position: "relative" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {texto.length > 200 ? texto.slice(0, 200) + "…" : texto}
          </p>
          {!item.enviado && (
            <button onClick={() => setEditando(true)}
              style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, padding: 2 }}>
              ✏️
            </button>
          )}
        </div>
      )}

      {/* Botones de acción */}
      {!editando && (
        <div style={{ display: "flex", gap: 8 }}>
          {item.tel ? (
            <button onClick={enviarWA} style={{
              flex: 2, padding: "11px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, border: "none",
              background: item.enviado ? "rgba(37,211,102,.12)" : "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))",
              color: item.enviado ? "var(--col-success)" : "#fff",
              boxShadow: item.enviado ? "none" : "0 4px 14px var(--col-success-border)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
              <span style={{ fontSize: 16 }}>💬</span>
              {item.enviado ? "Reenviar" : "Abrir en WhatsApp →"}
            </button>
          ) : (
            <div style={{ flex: 2, padding: "11px", borderRadius: 12, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Sin número registrado</span>
            </div>
          )}
          {!item.enviado && onSaltar && (
            <button onClick={() => onSaltar(item.id)}
              style={{ padding: "11px 14px", border: "1px solid var(--border-strong)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              Saltar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  BandejaTab — la cola inteligente
// ─────────────────────────────────────────────
function BandejaTab({ items, enviados, saltados, onEnviado, onSaltar, onEditMsg }) {
  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [currentIdx,   setCurrentIdx]   = useState({});

  const GRUPOS = [
    { key: "hoy",      label: "Vence HOY",       icon: "🚨", color: "var(--col-danger)", filter: i => i.tipo === "pago" && i.diasReales === 0 },
    { key: "manana",   label: "Vence mañana",     icon: "⚡", color: "var(--col-warning)", filter: i => i.tipo === "pago" && i.diasReales === 1 },
    { key: "tres",     label: "En 3 días",         icon: "⏰", color: "var(--col-warning)", filter: i => i.tipo === "pago" && i.diasReales > 1 && i.diasReales <= 3 },
    { key: "cinco",    label: "En 5 días",         icon: "📅", color: "var(--col-info)", filter: i => i.tipo === "pago" && i.diasReales > 3 },
    { key: "birthday", label: "Cumpleaños hoy",   icon: "🎂", color: "var(--col-warning)", filter: i => i.tipo === "birthday" },
    { key: "waQueue",  label: "Cola pendiente",    icon: "📬", color: "var(--col-accent-text)", filter: i => i.tipo === "waQueue" },
  ];

  const grupos = useMemo(() =>
    GRUPOS.map(g => ({ ...g, items: items.filter(i => g.filter(i) && !saltados[i.id]) }))
          .filter(g => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, saltados]
  );

  const totalPend     = items.filter(i => !enviados[i.id] && !saltados[i.id]).length;
  const totalEnviados = items.filter(i =>  enviados[i.id]).length;
  const totalSaltados = Object.keys(saltados).length;

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🎉</p>
        <p style={{ color: "var(--col-success)", fontSize: 16, fontWeight: 700 }}>¡Bandeja vacía!</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>No hay mensajes pendientes para hoy.</p>
      </div>
    );
  }

  return (
    <>
      {/* Resumen global */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          📋 Bandeja de hoy
        </p>

        {/* Chips de grupos */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {grupos.map(g => {
            const pendG = g.items.filter(i => !enviados[i.id]).length;
            const envG  = g.items.filter(i =>  enviados[i.id]).length;
            const activo = grupoAbierto === g.key;
            return (
              <button key={g.key} onClick={() => setGrupoAbierto(activo ? null : g.key)}
                style={{ display: "flex", alignItems: "center", gap: 6,
                  background: activo ? `${g.color}18` : "var(--bg-elevated)",
                  border: `1px solid ${activo ? g.color + "50" : "var(--border)"}`,
                  borderRadius: 12, padding: "7px 12px",
                  cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                <span style={{ fontSize: 14 }}>{g.icon}</span>
                <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                <span style={{ background: pendG > 0 ? `${g.color}25` : "var(--col-success-soft)", color: pendG > 0 ? g.color : "var(--col-success)", borderRadius: 8, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                  {pendG > 0 ? pendG : `✓${envG}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Barra de progreso */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            {totalEnviados} enviados · {totalPend} pendientes{totalSaltados > 0 ? ` · ${totalSaltados} saltados` : ""}
          </span>
          <span style={{ color: "var(--col-success)", fontSize: 11, fontWeight: 700 }}>
            {items.length > 0 ? Math.round((totalEnviados / items.length) * 100) : 0}%
          </span>
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 99, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,var(--col-wa),var(--col-wa-dark))", width: `${items.length > 0 ? (totalEnviados / items.length) * 100 : 0}%`, transition: "width .5s ease" }} />
        </div>
      </div>

      {/* Grupos visibles */}
      {grupos.map(g => {
        // Si hay un filtro activo, solo mostrar ese grupo
        if (grupoAbierto && grupoAbierto !== g.key) return null;

        const cidx       = currentIdx[g.key] ?? 0;
        const gItems     = g.items;
        const pendCount  = gItems.filter(i => !enviados[i.id]).length;

        // Encontrar el primer no-enviado si el current ya fue enviado
        const effectiveCidx = enviados[gItems[cidx]?.id]
          ? (gItems.findIndex((i, idx) => idx >= cidx && !enviados[i.id]) >= 0
              ? gItems.findIndex((i, idx) => idx >= cidx && !enviados[i.id])
              : cidx)
          : cidx;

        const avanzar    = () => setCurrentIdx(p => ({ ...p, [g.key]: Math.min(cidx + 1, gItems.length - 1) }));
        const retroceder = () => setCurrentIdx(p => ({ ...p, [g.key]: Math.max(cidx - 1, 0) }));

        return (
          <div key={g.key} style={{ marginBottom: 20 }}>
            {/* Header del grupo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <p style={{ color: g.color, fontSize: 13, fontWeight: 700, flex: 1 }}>{g.label}</p>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{pendCount} pendiente{pendCount !== 1 ? "s" : ""}</span>
              {gItems.length > 1 && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button onClick={retroceder} disabled={cidx === 0} style={{ ...navBtn, opacity: cidx === 0 ? .3 : 1 }}>‹</button>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11, minWidth: 40, textAlign: "center" }}>{effectiveCidx + 1}/{gItems.length}</span>
                  <button onClick={avanzar} disabled={cidx >= gItems.length - 1} style={{ ...navBtn, opacity: cidx >= gItems.length - 1 ? .3 : 1 }}>›</button>
                </div>
              )}
            </div>

            {/* Tarjeta activa */}
            {gItems[effectiveCidx] && (
              <TarjetaCola
                key={gItems[effectiveCidx].id}
                item={gItems[effectiveCidx]}
                index={effectiveCidx}
                total={gItems.length}
                isCurrent={true}
                onEnviado={(id) => { onEnviado(id); if (effectiveCidx < gItems.length - 1) avanzar(); }}
                onSaltar={(id)  => { onSaltar(id);  if (effectiveCidx < gItems.length - 1) avanzar(); }}
                onEditMsg={onEditMsg}
              />
            )}

            {/* Enviados colapsados */}
            {grupoAbierto === g.key && gItems.filter(i => enviados[i.id]).length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", padding: "6px 0", listStyle: "none" }}>
                  ✓ {gItems.filter(i => enviados[i.id]).length} ya enviados — ver
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {gItems.filter(i => enviados[i.id]).map((item, idx) => (
                    <TarjetaCola key={item.id} item={item} index={idx} total={gItems.length} isCurrent={false}
                      onEnviado={onEnviado} onSaltar={null} onEditMsg={onEditMsg} />
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
//  PlantillaCustom
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
    setGuardando(false); setEditando(false);
  };

  if (editando) return (
    <div style={{ background: "var(--col-accent-soft)", border: "1px solid var(--col-accent-border)", borderRadius: 14, padding: 14 }}>
      <p style={{ color: "var(--col-accent-text)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Mensaje {index + 1}</p>
      <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Nombre del mensaje"
        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 8 }} />
      <textarea value={form.msg} onChange={e => setForm(p => ({ ...p, msg: e.target.value }))}
        placeholder={`Mensaje. Usa {student_name} para el nombre. — ${gymNom}`} rows={4}
        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 8 }} />
      {form.msg.trim() && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Vista previa</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>{msgFinal}</p>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setEditando(false); setForm({ label: tpl.label, msg: tpl.msg }); }} style={btnSec}>Cancelar</button>
        <button onClick={handleGuardar} disabled={!form.label.trim() || !form.msg.trim() || guardando}
          style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            background: form.label.trim() && form.msg.trim() ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-elevated)",
            color: form.label.trim() && form.msg.trim() ? "#fff" : "var(--text-secondary)" }}>
          {guardando ? "Guardando…" : "💾 Guardar"}
        </button>
      </div>
    </div>
  );

  if (tieneContenido) return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--col-accent-border)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 18 }}>⭐</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "var(--col-accent-text)", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{tpl.label}</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.msg}</p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={() => onUsar(tpl.msg.replace(/\{nombre\}/g, nombreMiembro).replace(/\{student_name\}/g, nombreMiembro), tpl.label)}
          style={{ padding: "6px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))", color: "#fff" }}>
          Usar
        </button>
        <button onClick={() => { setForm({ label: tpl.label, msg: tpl.msg }); setEditando(true); }}
          style={{ padding: "6px 10px", border: "1px solid var(--border-strong)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          ✏️
        </button>
      </div>
    </div>
  );

  return (
    <button onClick={() => { setForm({ label: "", msg: "" }); setEditando(true); }}
      style={{ width: "100%", padding: "12px 14px", border: "1px dashed var(--col-accent-border)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16, color: "var(--col-accent)" }}>＋</span>
      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Mensaje guardado {index + 1} — toca para crear</span>
    </button>
  );
}

// ─────────────────────────────────────────────
//  SystemMessageCard
// ─────────────────────────────────────────────
function SystemMessageCard({ meta, template, automation, onToggle, onOffsetChange, onSave, onReset }) {
  const [editing,   setEditing]   = useState(false);
  const [editText,  setEditText]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [resetting, setResetting] = useState(false);

  const isActive   = automation?.is_active ?? false;
  const offsetDays = automation?.trigger_offset_days ?? 1;
  const bodyText   = template?.body_text || "";
  const preview    = bodyText.length > 90 ? bodyText.slice(0, 90) + "…" : bodyText;

  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid ${isActive ? "var(--col-accent-border)" : "var(--border)"}`, borderRadius: 16, padding: 14, marginBottom: 10, transition: "border .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>{meta.name}</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 2 }}>{meta.when}</p>
        </div>
        <div onClick={() => onToggle(meta.key, !isActive)}
          style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: isActive ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "rgba(255,255,255,.1)", cursor: "pointer", position: "relative", transition: "background .2s" }}>
          <div style={{ position: "absolute", top: 3, left: isActive ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
        </div>
      </div>

      {meta.hasOffset && isActive && !editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, flex: 1 }}>
            {offsetDays >= 0 ? `Enviar ${offsetDays}d antes` : `Enviar ${Math.abs(offsetDays)}d después`}
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,5,7].map(d => (
              <button key={d} onClick={() => onOffsetChange(meta.key, d)}
                style={{ padding: "4px 8px", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                  background: offsetDays === d ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-card)",
                  color: offsetDays === d ? "#fff" : "var(--text-secondary)" }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      )}

      {!editing && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Mensaje</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.5 }}>{preview}</p>
        </div>
      )}

      {editing && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ color: "var(--col-accent-text)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>Editando mensaje</p>
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={6}
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid rgba(108,99,255,.4)", borderRadius: 10, padding: "10px 12px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6, marginBottom: 6 }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 10, lineHeight: 1.5 }}>
            Variables: {"{student_name}"} · {"{due_date}"} · {"{concept}"} · {"{amount}"} · {"{clabe}"} · {"{bank}"} · {"{propietario}"}
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!editing ? (
          <>
            <button onClick={() => { setEditText(bodyText); setEditing(true); }}
              style={{ flex: 2, padding: "8px", border: "1px solid var(--col-accent-border)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "var(--col-accent-text)" }}>
              ✏️ Editar mensaje
            </button>
            <button onClick={async () => { setResetting(true); await onReset(meta.key); setResetting(false); }} disabled={resetting}
              style={{ flex: 1, padding: "8px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: "var(--text-secondary)" }}>
              {resetting ? "…" : "↺ Restaurar"}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(false)} style={btnSec}>Cancelar</button>
            <button onClick={async () => { setResetting(true); await onReset(meta.key); setResetting(false); setEditing(false); }} disabled={resetting}
              style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: "var(--text-secondary)" }}>
              {resetting ? "…" : "↺ Default"}
            </button>
            <button onClick={async () => { setSaving(true); await onSave(template?.id, editText); setSaving(false); setEditing(false); }}
              disabled={saving || !editText.trim()}
              style={{ flex: 2, padding: "8px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: editText.trim() ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "var(--bg-elevated)",
                color: editText.trim() ? "#fff" : "var(--text-secondary)" }}>
              {saving ? "Guardando…" : "💾 Guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MensajesScreen — export principal
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
  recordatoriosEnviados = {},   // eslint-disable-line no-unused-vars
  onMarcarRecordatorio,
  waQueue = [],
  onUpdateWaQueue,
}) {
  const [modo,        setModo]       = useState(modoInicial || (miembroInicial ? "individual" : "bandeja"));
  const [selMiembro,  setSelMiembro] = useState(miembroInicial || null);
  const [busqueda,    setBusqueda]   = useState("");
  const [msgTexto,    setMsgTexto]   = useState("");
  const [copiadoMsg,  setCopiadoMsg] = useState(false);
  const [copiadoNums, setCopiadoNums] = useState(false);

  // ── Estado persistente de enviados (por día) ──
  const storageKey = `bandeja_env_${gymId}`;
  const dateKey    = `bandeja_fecha_${gymId}`;

  const [enviados,  setEnviados]  = useState(() => {
    try {
      const hoy     = new Date().toDateString();
      const guardado = localStorage.getItem(dateKey);
      if (guardado !== hoy) return {};
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch { return {}; }
  });
  const [saltados,  setSaltados]  = useState({});
  const [msgEdits,  setMsgEdits]  = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(enviados));
      localStorage.setItem(dateKey, new Date().toDateString());
    } catch {}
  }, [enviados, storageKey, dateKey]);

  // ── Hook de comunicación ──
  const {
    automations,
    loading:    commLoading,
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

  const tplsRapidas = useMemo(() => {
    const fromDB = getQuickTemplates();
    if (fromDB.length > 0) return fromDB;
    return [
      { id: "q1", icon: "🚫", name: "Clase cancelada",  body_text: "¡Hola {student_name}! La clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏" },
      { id: "q2", icon: "⏰", name: "Cambio de horario", body_text: "¡Hola {student_name}! Aviso: hubo un cambio de horario. El nuevo horario es a las 7:00pm 📅" },
      { id: "q3", icon: "🏋️", name: "Evento especial",  body_text: `¡Hola {student_name}! 🔥 Te invitamos a nuestro evento especial este sábado. — ${gymNom}` },
      { id: "q4", icon: "🛑", name: "Cierre temporal",  body_text: `¡Hola {student_name}! El gym estará cerrado mañana por mantenimiento 🛑 — ${gymNom}` },
    ];
  }, [getQuickTemplates, gymNom]);

  // ── Build mensaje de vencimiento ──
  // dest = resultado de resolveDestinatario(miembro)
  const buildVencimientoMsg = useCallback((miembro, diasReales, memInfo, dest) => {
    const dest_  = dest || resolveDestinatario(miembro);
    // Para menor: el saludo va al tutor, pero el alumno se menciona en el cuerpo
    // Nombre seguro para el saludo (tutor si es menor, alumno si es mayor)
    const nombreSaludo = (dest_.esMenor && dest_.tutorNombre)
      ? dest_.tutorNombre.split(" ")[0]
      : miembro.nombre.split(" ")[0];
    const nombreAlumno = miembro.nombre.split(" ")[0];

    const tpl  = getTemplate(mapDiasToTemplateKey(diasReales));
    const plan = memInfo?.plan || "";
    const vence = memInfo?.vence || "";

    if (!tpl) {
      const planStr = plan ? ` *${plan}*` : "";
      const intro   = dest_.esMenor
        ? `¡Hola ${nombreSaludo}! Le informamos sobre la membresía de *${nombreAlumno}* en *${gymNom}*.`
        : `¡Hola ${nombreSaludo}!`;
      if (diasReales === 0) return `${intro} 🚨 La membresía${planStr} vence *HOY*. Renueva para no perder el acceso 💪`;
      if (diasReales <= 3)  return `${intro} ⏰ La membresía${planStr} vence en *${diasReales} días* (${vence}). No pierdas el acceso 🔥`;
      const tplLargo = gymConfig?.recordatorio_tpl || "";
      return (tplLargo || `${intro} Recordatorio: la membresía${planStr} vence el *${vence}*. — ${gymNom}`)
        .replace(/\{nombre\}/gi, nombreSaludo).replace(/\{student_name\}/gi, nombreSaludo)
        .replace(/\{fecha\}/gi, vence).replace(/\{due_date\}/gi, vence)
        .replace(/\{clabe\}/gi, gymConfig?.transferencia_clabe || "")
        .replace(/\{titular\}/gi, gymConfig?.transferencia_titular || "")
        .replace(/\{banco\}/gi, gymConfig?.transferencia_banco || "")
        .replace(/\{bank\}/gi, gymConfig?.transferencia_banco || "")
        .replace(/\{propietario\}/gi, gymConfig?.propietario_nombre || gymNom)
        .replace(/\{propietario_titulo\}/gi, gymConfig?.propietario_titulo || "")
        .replace(/\{gym\}/gi, gymNom).replace(/\{plan\}/gi, plan).replace(/\{concept\}/gi, plan || gymNom);
    }
    // Con plantilla del sistema: inyectar nombre correcto y garantizar {concept} no quede vacío
    const vars = {
      ...buildVarsFromMember(miembro, memInfo, gymConfig),
      student_name: nombreSaludo,
      alumno_name:  nombreAlumno,
      concept:      plan || gymNom,   // fallback: gym si no hay plan
    };
    return replaceTemplateVars(tpl.body_text, vars);
  }, [getTemplate, gymConfig, gymNom]);

  // ──────────────────────────────────────────────────────────────────
  //  BANDEJA INTELIGENTE — lógica de deduplicación y caducidad
  // ──────────────────────────────────────────────────────────────────
  const bandejaItems = useMemo(() => {
    const items = [];

    // 1) Recordatorios de pago — UN solo mensaje por alumno (el más urgente)
    const porAlumno = {};
    miembros
      .filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo")
      .forEach(m => {
        const info  = getMembershipInfo(m.id, txs, m);
        const dias  = diasParaVencer(info.vence);
        if (dias === null || dias < 0 || dias > 5) return;
        if (porAlumno[m.id] === undefined || dias < porAlumno[m.id].dias) {
          porAlumno[m.id] = { miembro: m, dias, info };
        }
      });

    Object.values(porAlumno).forEach(({ miembro, dias, info }) => {
      const id   = `pago_${miembro.id}`;
      const dest = resolveDestinatario(miembro);
      const msg  = buildVencimientoMsg(miembro, dias, info, dest);
      items.push({
        id, tipo: "pago", miembro,
        diasReales: dias, memInfo: info,
        msg:             msgEdits[id] ?? msg,
        tel:             dest.tel,
        enviado:         !!enviados[id],
        esMenor:         dest.esMenor,
        tutorNombre:     dest.tutorNombre,
        tutorParentesco: dest.tutorParentesco,
        tutorFoto:       dest.tutorFoto,
      });
    });

    // 2) Cumpleaños — solo hoy
    miembros.forEach(m => {
      if (!m.fecha_nacimiento) return;
      if (diasParaCumple(m.fecha_nacimiento) !== 0) return;
      const id   = `bday_${m.id}`;
      const dest = resolveDestinatario(m);
      const tpl  = getTemplate("birthday");

      const nombreAlumno = m.nombre.split(" ")[0];
      const nombreTutor  = (dest.esMenor && dest.tutorNombre)
        ? dest.tutorNombre.split(" ")[0]
        : null;
      const nombreSaludo = (dest.esMenor && nombreTutor) ? nombreTutor : nombreAlumno;

      // concept = gymNom para evitar que quede vacio en la plantilla
      const vars = {
        ...buildVarsFromMember(m, {}, gymConfig),
        student_name: nombreSaludo,
        alumno_name:  nombreAlumno,
        concept:      gymNom,
      };

      let msg;
      if (tpl) {
        msg = replaceTemplateVars(tpl.body_text, vars);
      } else if (dest.esMenor) {
        msg = `🎂 ¡Hola ${nombreSaludo}! Hoy es el cumpleaños de *${nombreAlumno}*. En *${gymNom}* le deseamos un día increíble lleno de salud y motivación 🎉💪`;
      } else {
        msg = `🎂 ¡Feliz cumpleaños ${nombreSaludo}! En *${gymNom}* te deseamos un día increíble lleno de salud y motivación 💪🎉`;
      }

      items.push({
        id, tipo: "birthday", miembro: m,
        diasReales: 0,
        msg:             msgEdits[id] ?? msg,
        tel:             dest.tel,
        enviado:         !!enviados[id],
        esMenor:         dest.esMenor,
        tutorNombre:     dest.tutorNombre,
        tutorParentesco: dest.tutorParentesco,
        tutorFoto:       dest.tutorFoto,
      });
    });

    // 3) Cola WA — con caducidad de 3 días
    const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;
    const ahora     = Date.now();
    (waQueue || []).forEach(entry => {
      if (entry.ts && (ahora - entry.ts) > TRES_DIAS) return; // caducado
      items.push({
        id:            entry.id,
        tipo:          "waQueue",
        miembro:       null,
        nombreMiembro: entry.nombreMiembro,
        diasReales:    null,
        memInfo:       null,
        msg:           msgEdits[entry.id] ?? (entry._editMsg ?? entry.msg),
        tel:           entry.tel,
        enviado:       !!enviados[entry.id] || !!entry.enviado,
      });
    });

    // Ordenar: no enviados primero, por urgencia
    return items.sort((a, b) => {
      if (a.enviado !== b.enviado) return a.enviado ? 1 : -1;
      const order = { birthday: -2, waQueue: -1 };
      const oa = order[a.tipo] ?? a.diasReales ?? 99;
      const ob = order[b.tipo] ?? b.diasReales ?? 99;
      return oa - ob;
    });
  }, [miembros, txs, waQueue, enviados, msgEdits, buildVencimientoMsg, getTemplate, gymConfig, gymNom]);

  const pendientesBandeja = bandejaItems.filter(i => !enviados[i.id] && !saltados[i.id]).length;

  const handleEnviado = useCallback((id) => {
    setEnviados(p => ({ ...p, [id]: true }));
    const isWA = (waQueue || []).find(e => e.id === id);
    if (isWA && onUpdateWaQueue)
      onUpdateWaQueue((waQueue || []).map(e => e.id === id ? { ...e, enviado: true } : e));
    if (onMarcarRecordatorio) onMarcarRecordatorio(id);
  }, [waQueue, onUpdateWaQueue, onMarcarRecordatorio]);

  const handleSaltar   = useCallback((id)        => setSaltados(p => ({ ...p, [id]: true })), []);
  const handleEditMsg  = useCallback((id, texto)  => setMsgEdits(p => ({ ...p, [id]: texto })), []);

  const destMasivo = miembros.filter(mb => getMembershipInfo(mb.id, txs, mb).estado === "Activo" && mb.tel);
  const selNombre1 = selMiembro?.nombre?.split(" ")[0] || "";

  const cambiarModo = (m) => { setModo(m); setMsgTexto(""); setCopiadoMsg(false); setCopiadoNums(false); };

  const modos = [
    { k: "bandeja",          icon: "📬", label: "Bandeja",   badge: pendientesBandeja },
    { k: "individual",       icon: "👤", label: "Individual" },
    { k: "masivo",           icon: "📢", label: "Masivo"     },
    { k: "mensajes_sistema", icon: "⚙️", label: "Sistema"    },
  ];

  const tabStyle = (activo) => ({
    flex: 1, padding: "9px 4px", border: "none", borderRadius: 11,
    cursor: "pointer", fontFamily: "inherit",
    background: activo ? "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))" : "transparent",
    color: activo ? "#fff" : "var(--text-secondary)",
    fontSize: 10, fontWeight: activo ? 700 : 500,
    boxShadow: activo ? "0 2px 12px var(--col-success-border)" : "none",
    transition: "all .2s", position: "relative", flexShrink: 0,
  });

  const textareaStyle = {
    width: "100%", background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)", borderRadius: 14,
    padding: "14px", color: "var(--text-primary)", fontSize: 13,
    fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 6,
  };

  // ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={onBack}
              style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0 }}>
              ←
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700 }}>💬 Mensajes</h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>Centro de comunicación WhatsApp</p>
            </div>
            {pendientesBandeja > 0 && (
              <span style={{ background: "var(--col-danger)", color: "#fff", borderRadius: 10, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
                {pendientesBandeja > 99 ? "99+" : pendientesBandeja}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", borderRadius: 14, padding: 4, marginBottom: 14, overflowX: "auto" }}>
            {modos.map(m => (
              <button key={m.k} onClick={() => cambiarModo(m.k)} style={tabStyle(modo === m.k)}>
                {m.icon} {m.label}
                {m.badge > 0 && (
                  <span style={{ position: "absolute", top: 2, right: 2, background: "var(--col-danger)", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {m.badge > 99 ? "99+" : m.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "0 20px 20px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

          {/* ════ BANDEJA ════ */}
          {modo === "bandeja" && (
            <BandejaTab
              items={bandejaItems}
              enviados={enviados}
              saltados={saltados}
              onEnviado={handleEnviado}
              onSaltar={handleSaltar}
              onEditMsg={handleEditMsg}
            />
          )}

          {/* ════ INDIVIDUAL ════ */}
          {modo === "individual" && (
            <>
              {!selMiembro ? (
                <>
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-secondary)", pointerEvents: "none" }}>🔍</span>
                    <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar miembro..."
                      style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "10px 12px 10px 36px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                    {busqueda && (
                      <button onClick={() => setBusqueda("")}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-secondary)", fontSize: 16, cursor: "pointer" }}>✕</button>
                    )}
                  </div>
                  {(() => {
                    const conTel    = miembros.filter(m => m.tel);
                    const filtrados = busqueda.trim()
                      ? conTel.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || m.tel.includes(busqueda))
                      : conTel;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {filtrados.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No se encontró "{busqueda}"</p>}
                        {filtrados.map(m => (
                          <button key={m.id} onClick={() => { setSelMiembro(m); setMsgTexto(""); setBusqueda(""); }}
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
                            <AvatarCircle nombre={m.nombre} foto={m.foto} size={36} />
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>📱 {m.tel}</p>
                            </div>
                            <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>›</span>
                          </button>
                        ))}
                        {miembros.filter(m => !m.tel).length > 0 && !busqueda && (
                          <p style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: "6px 0" }}>
                            {miembros.filter(m => !m.tel).length} miembros sin número no aparecen
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--col-accent-soft)", border: "1px solid var(--col-accent-border)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>
                    <AvatarCircle nombre={selMiembro.nombre} foto={selMiembro.foto} size={38} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "var(--col-accent-text)", fontSize: 13, fontWeight: 700 }}>{selMiembro.nombre}</p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>📱 {selMiembro.tel}</p>
                    </div>
                    <button onClick={() => { setSelMiembro(null); setMsgTexto(""); }}
                      style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
                      Cambiar ✕
                    </button>
                  </div>

                  <textarea value={msgTexto} onChange={e => setMsgTexto(e.target.value)}
                    placeholder={`Hola ${selNombre1}, escribe o elige una plantilla...`}
                    rows={4} autoFocus style={textareaStyle} />
                  <p style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "right", marginBottom: 10 }}>{msgTexto.length} caracteres</p>

                  <button onClick={() => { window.open(buildWAUrl(selMiembro.tel, msgTexto.trim()), "_blank"); if (onMarcarRecordatorio) onMarcarRecordatorio(selMiembro.id); }}
                    disabled={!msgTexto.trim()}
                    style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: msgTexto.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                      background: msgTexto.trim() ? "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))" : "var(--bg-elevated)",
                      color: msgTexto.trim() ? "#fff" : "var(--text-secondary)",
                      boxShadow: msgTexto.trim() ? "0 4px 18px var(--col-success-border)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 18 }}>💬</span>
                    {msgTexto.trim() ? `Enviar a ${selNombre1} por WhatsApp` : "Escribe o elige un mensaje"}
                  </button>

                  <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💾 Mis mensajes guardados</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {[0,1,2,3].map(i => {
                      const slot = tplsCustom[i] || { icon: "⭐", label: "", msg: "" };
                      return (
                        <PlantillaCustom key={i} index={i} tpl={slot} nombreMiembro={selNombre1} gymNom={gymNom}
                          onUsar={(msg) => setMsgTexto(msg)}
                          onGuardar={async (nueva) => {
                            const nuevas = [...tplsCustom];
                            while (nuevas.length <= i) nuevas.push({ icon: "⭐", label: "", msg: "" });
                            nuevas[i] = nueva;
                            await onUpdatePlantillas(nuevas);
                          }} />
                      );
                    })}
                  </div>

                  {getSystemTemplates().length > 0 && (
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                        <span>⚙️ Plantillas del sistema</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 400, marginLeft: "auto" }}>toca para ver ›</span>
                      </summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                        {getSystemTemplates().map(tpl => {
                          const memInfo  = getMembershipInfo(selMiembro.id, txs, selMiembro);
                          const vars     = buildVarsFromMember(selMiembro, memInfo, gymConfig);
                          const msgFinal = replaceTemplateVars(tpl.body_text, vars);
                          return (
                            <button key={tpl.id} onClick={() => setMsgTexto(msgFinal)}
                              style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "var(--bg-card)", border: `1px solid ${msgTexto === msgFinal ? "var(--col-success-border)" : "var(--bg-elevated)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                              <span style={{ fontSize: 16 }}>⚙️</span>
                              <span style={{ color: msgTexto === msgFinal ? "var(--col-success)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name}</span>
                              {msgTexto === msgFinal && <span style={{ color: "var(--col-success)" }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  <details style={{ marginBottom: 14 }}>
                    <summary style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                      <span>⚡ Plantillas rápidas</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 400, marginLeft: "auto" }}>toca para ver ›</span>
                    </summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {tplsRapidas.map((tpl, i) => {
                        const msgFinal = replaceTemplateVars(tpl.body_text || tpl.msg || "", { student_name: selNombre1 });
                        return (
                          <button key={tpl.id || i} onClick={() => setMsgTexto(msgFinal)}
                            style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "var(--bg-card)", border: `1px solid ${msgTexto === msgFinal ? "var(--col-success-border)" : "var(--bg-elevated)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                            <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                            <span style={{ color: msgTexto === msgFinal ? "var(--col-success)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name || tpl.label}</span>
                            {msgTexto === msgFinal && <span style={{ color: "var(--col-success)" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                </>
              )}
            </>
          )}

          {/* ════ MASIVO ════ */}
          {modo === "masivo" && (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Mensaje para todos</p>
              <textarea value={msgTexto} onChange={e => setMsgTexto(e.target.value)}
                placeholder={`Ej: Hola, la clase de hoy fue cancelada. Disculpen 🙏 — ${gymNom}`}
                rows={5} style={textareaStyle} />
              <p style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "right", marginBottom: 12 }}>{msgTexto.length} caracteres</p>

              <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Plantillas rápidas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {tplsRapidas.map((tpl, i) => {
                  const msgFinal = tpl.body_text || tpl.msg || "";
                  return (
                    <button key={tpl.id || i} onClick={() => setMsgTexto(msgFinal)}
                      style={{ background: msgTexto === msgFinal ? "rgba(37,211,102,.1)" : "var(--bg-card)", border: `1px solid ${msgTexto === msgFinal ? "var(--col-success-border)" : "var(--border)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                      <span style={{ color: msgTexto === msgFinal ? "var(--col-success)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.name || tpl.label}</span>
                      {msgTexto === msgFinal && <span style={{ color: "var(--col-success)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {msgTexto.trim() && (
                <>
                  <div style={{ background: "var(--col-success-soft)", border: "1px solid var(--col-success-border)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Destinatarios ({destMasivo.length})</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {destMasivo.map(mb => (
                        <div key={mb.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--bg-elevated)", borderRadius: 20, padding: "4px 10px 4px 4px" }}>
                          <AvatarCircle nombre={mb.nombre} foto={mb.foto} size={22} />
                          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{mb.nombre.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {[
                    { num: 1, label: "Copia el mensaje", copiado: copiadoMsg, action: () => { copyToClipboard(msgTexto); setCopiadoMsg(true); } },
                    { num: 2, label: "Copia los números", sub: `${destMasivo.length} contactos`, copiado: copiadoNums, action: () => { copyToClipboard(destMasivo.map(mb => mb.tel.replace(/\D/g, "")).join("\n")); setCopiadoNums(true); } },
                  ].map(step => (
                    <div key={step.num} style={{ background: "var(--bg-card)", border: step.copiado ? "1px solid rgba(37,211,102,.4)" : "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: step.copiado ? "var(--col-success-border)" : "var(--bg-elevated)", color: step.copiado ? "var(--col-success)" : "var(--text-primary)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                            {step.copiado ? "✓" : step.num}
                          </span>
                          <div>
                            <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{step.label}</p>
                            {step.sub && <p style={{ color: "var(--text-secondary)", fontSize: 10, marginTop: 2 }}>{step.sub}</p>}
                          </div>
                        </div>
                        <button onClick={step.action}
                          style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: step.copiado ? "var(--col-success-border)" : "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: step.copiado ? "var(--col-success)" : "#fff" }}>
                          {step.copiado ? "✓ Copiado" : "📋 Copiar"}
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                    <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>3️⃣ Abre WhatsApp</p>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.5 }}>Nueva lista de difusión → pega los números → pega el mensaje. Llega como mensaje privado a cada uno.</p>
                  </div>

                  <button onClick={() => window.open("https://wa.me", "_blank")}
                    style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))", color: "#fff", boxShadow: "0 4px 18px var(--col-success-border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span> Abrir WhatsApp
                  </button>
                </>
              )}
            </>
          )}

          {/* ════ SISTEMA ════ */}
          {modo === "mensajes_sistema" && (
            <>
              <div style={{ background: "var(--col-accent-soft)", border: "1px solid var(--col-accent-border)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ color: "var(--col-accent-text)", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>⚙️ Centro de automatización</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
                  Configura los mensajes del sistema. Los activos aparecen automáticamente en la Bandeja según sus reglas.
                </p>
              </div>

              {commLoading ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Cargando mensajes…</p>
                </div>
              ) : (
                <>
                  {SYSTEM_TEMPLATE_KEYS.map(meta => (
                    <SystemMessageCard key={meta.key} meta={meta}
                      template={getTemplate(meta.key)}
                      automation={automations.find(a => a.event_key === meta.key)}
                      onToggle={toggleAutomation} onOffsetChange={updateOffset}
                      onSave={saveTemplate} onReset={resetTemplate} />
                  ))}
                  {!dbAvailable && gymId && (
                    <div style={{ background: "var(--col-warning-soft)", border: "1px solid var(--col-warning-border)", borderRadius: 14, padding: "14px 16px", marginTop: 4 }}>
                      <p style={{ color: "var(--col-warning)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📋 Modo vista previa</p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>Para guardar cambios, ejecuta en Supabase:</p>
                      <code style={{ display: "block", background: "var(--bg-base)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--col-accent-text)", wordBreak: "break-all" }}>
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
