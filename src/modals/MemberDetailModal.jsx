// src/modals/MemberDetailModal.jsx
import { useState, useEffect } from "react";
import { Modal, Btn, Inp } from "../components/UI";
import PhotoModal from "../components/PhotoModal";
import { CAT_ICON } from "../utils/constants";
import {
  getMembershipInfo,
  calcVence,
} from "../utils/membershipUtils";
import {
  parseDate,
  fmtDate,
  todayISO,
  today,
  diasParaCumple,
  calcEdad,
  fmt,
  diasParaVencer,
} from "../utils/dateUtils";
import {
  parseDate,
  fmtDate,
  todayISO,
  today,
  diasParaCumple,
  calcEdad,
  fmt,
} from "../utils/dateUtils";
import { uid } from "../utils/helpers";

/* ─── CONGELAR MODAL (sub-componente interno) ─── */
function CongelarModal({ m, onClose, onConfirm }) {
  const [modo, setModo] = useState("manual"); // "manual" | "fecha"
  const [fechaDesc, setFechaDesc] = useState("");
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.88)",
        backdropFilter: "blur(10px)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          borderRadius: 24,
          padding: 24,
          width: "100%",
          maxWidth: 340,
          border: "1px solid rgba(96,165,250,.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>🧊</p>
          <h3 style={{ color: "#60a5fa", fontSize: 16, fontWeight: 700 }}>
            Congelar membresía
          </h3>
          <p style={{ color: "#4b4b6a", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            Los días congelados se suman automáticamente al vencimiento cuando
            se descongele.
          </p>
        </div>
        <p
          style={{
            color: "#6b7280",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 10,
          }}
        >
          ¿Cómo se descongela?
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { val: "manual", label: "✋ Manualmente", desc: "Tú la descongelas cuando quieras" },
            { val: "fecha", label: "📅 Con fecha", desc: "Se descongela automáticamente" },
          ].map((op) => (
            <button
              key={op.val}
              onClick={() => setModo(op.val)}
              style={{
                flex: 1,
                padding: "10px 8px",
                border: modo === op.val ? "2px solid #60a5fa" : "1.5px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                background: modo === op.val ? "rgba(96,165,250,.1)" : "rgba(255,255,255,.04)",
                textAlign: "center",
              }}
            >
              <p style={{ color: modo === op.val ? "#60a5fa" : "#6b7280", fontSize: 11, fontWeight: 700 }}>
                {op.label}
              </p>
              <p style={{ color: "#4b4b6a", fontSize: 9, marginTop: 3, lineHeight: 1.4 }}>
                {op.desc}
              </p>
            </button>
          ))}
        </div>
        {modo === "fecha" && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              Fecha de regreso
            </p>
            <input
              type="date"
              value={fechaDesc}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setFechaDesc(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(96,165,250,.3)",
                borderRadius: 12,
                padding: "12px 14px",
                color: fechaDesc ? "#fff" : "#3d3d5c",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn full outline color="#6b7280" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn full color="#60a5fa" onClick={() => onConfirm(modo === "fecha" ? fechaDesc : null)}>
            🧊 Congelar
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── CONFIRM DELETE INPUT (sub-componente interno) ─── */
function ConfirmDeleteInput({ nombre, onConfirm, onCancel }) {
  const [val, setVal] = useState("");
  const ok = val.trim().toUpperCase() === "ELIMINAR";
  return (
    <div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Escribe ELIMINAR"
        style={{
          width: "100%",
          background: "rgba(255,255,255,.07)",
          border: `1px solid ${ok ? "rgba(244,63,94,.6)" : "rgba(255,255,255,.1)"}`,
          borderRadius: 10,
          padding: "10px 12px",
          color: "#fff",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
          marginBottom: 10,
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            background: "transparent",
            color: "#6b7280",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={!ok}
          style={{
            flex: 2,
            padding: "10px",
            border: "none",
            borderRadius: 10,
            cursor: ok ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            background: ok ? "#f43f5e" : "rgba(244,63,94,.15)",
            color: ok ? "#fff" : "rgba(244,63,94,.4)",
          }}
        >
          🗑️ Eliminar definitivamente
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ─── MEMBER DETAIL MODAL ─── */
/* ═══════════════════════════════════════════════════════ */
export default function MemberDetailModal({
  m,
  txs,
  onClose,
  onSave,
  onToggleEstado,
  onAddPago,
  onDone,
  planesActivos,
  planPrecioActivo,
  onEditTx,
  gymConfig,
  onUpdatePlantillas,
  onDelete,
  onGoToMensajes,
}) {
  const [detTab, setDetTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const memInfo = getMembershipInfo(m.id, txs, m);
  const [form, setForm] = useState({
    nombre: m.nombre,
    tel: m.tel || "",
    fecha_incorporacion: m.fecha_incorporacion || "",
    sexo: m.sexo || "",
    fecha_nacimiento: m.fecha_nacimiento || "",
    notas: m.notas || "",
  });
  const [pagoModal, setPagoModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDelete2, setConfirmDelete2] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail === m.id) {
        setDetTab("historial");
        setPagoModal(true);
      }
    };
    document.addEventListener("openPagoModal", handler);
    return () => document.removeEventListener("openPagoModal", handler);
  }, [m.id]);

  const [photoModal, setPhotoModal] = useState(false);
  const [renovarModal, setRenovarModal] = useState(false);
  const [congelarModal, setCongelarModal] = useState(false);
  const [cobrarModal, setCobrarModal] = useState(false);
  const [cobro, setCobro] = useState({
    tipo: "",
    desc: "",
    monto: "",
    fecha: todayISO(),
    formaPago: "Efectivo",
  });

  const defaultPlan =
    memInfo.plan || (planesActivos && planesActivos[0]) || "Mensual";
  const defaultMonto =
    memInfo.monto ||
    (planPrecioActivo && planPrecioActivo[defaultPlan]) ||
    "";

  const [renovar, setRenovar] = useState({
    plan: defaultPlan,
    monto: String(defaultMonto),
    inicio: todayISO(),
    vence: calcVence(todayISO(), defaultPlan),
    venceManual: false,
    formaPago: "Efectivo",
  });
  const [pago, setPago] = useState({
    monto: String(defaultMonto),
    desc: "",
    fecha: todayISO(),
  });

  const historial = txs
    .filter(
      (t) =>
        String(t.miembroId) === String(m.id) ||
        String(t.miembro_id) === String(m.id)
    )
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const diasCumple = diasParaCumple(m.fecha_nacimiento);
  const edad = calcEdad(m.fecha_nacimiento);

  const hasChanges =
    form.nombre !== m.nombre ||
    form.tel !== (m.tel || "") ||
    form.fecha_incorporacion !== (m.fecha_incorporacion || "") ||
    form.sexo !== (m.sexo || "") ||
    form.fecha_nacimiento !== (m.fecha_nacimiento || "") ||
    form.notas !== (m.notas || "");

  const handleSave = () => {
    if (!hasChanges) return;
    onSave({
      ...m,
      nombre: form.nombre,
      tel: form.tel,
      fecha_incorporacion: form.fecha_incorporacion,
      sexo: form.sexo,
      fecha_nacimiento: form.fecha_nacimiento,
      notas: form.notas,
    });
    setEditing(false);
  };

  const handleAddPago = () => {
    if (!pago.desc.trim()) { alert("Agrega una descripción"); return; }
    if (!pago.monto || Number(pago.monto) <= 0) { alert("El monto debe ser mayor a 0"); return; }
    const descText = pago.desc.trim();
    const fechaPago = fmtDate(pago.fecha) || today();
    onAddPago({
      id: uid(),
      tipo: "ingreso",
      categoria: "Membresías",
      desc: descText,
      descripcion: descText,
      monto: Number(pago.monto),
      fecha: fechaPago,
      miembroId: m.id,
    });
    setPagoModal(false);
    setPago({ monto: String(defaultMonto), desc: "", fecha: todayISO() });
  };

  const handlePhoto = (dataUrl) => {
    onSave({ ...m, foto: dataUrl });
  };

  const handleRenovar = async () => {
    if (!renovar.inicio) return;
    const montoPagado = Number(renovar.monto) || 0;
    const fechaISO = renovar.inicio;
    const venceISO = renovar.vence;
    const descText = `Renovación ${renovar.plan} - ${m.nombre} [${renovar.formaPago || "Efectivo"}]${venceISO ? ` (vence:${venceISO})` : ""}`;
    await onAddPago({
      id: uid(),
      tipo: "ingreso",
      categoria: "Membresías",
      desc: descText,
      descripcion: descText,
      monto: montoPagado,
      fecha: fechaISO,
      miembroId: m.id,
      vence_manual: venceISO || null,
    });
    setRenovarModal(false);
  };

  const diasRestantes = diasParaVencer(memInfo.vence);
  const waUmbral =
    diasRestantes !== null && diasRestantes <= 5 && diasRestantes >= 0
      ? diasRestantes <= 1 ? 1 : diasRestantes <= 3 ? 3 : 5
      : null;

  /* ─── TIPOS DE COBRO ─── */
  const TIPOS_COBRO = [
    { val: "clase",    icon: "🏋️", label: "Clase suelta",   cat: "Clases extras", placeholder: "Drop-in, clase especial..." },
    { val: "producto", icon: "🛍️", label: "Producto",       cat: "Otro",          placeholder: "Suplemento, botella, ropa..." },
    { val: "servicio", icon: "⭐", label: "Servicio extra", cat: "Clases extras", placeholder: "Clase personal, nutrición..." },
    { val: "libre",    icon: "✏️", label: "Personalizado",  cat: "Otro",          placeholder: "Describe el cobro..." },
  ];

  return (
    <Modal title="Perfil del miembro" onClose={onClose}>
      {photoModal && (
        <PhotoModal onClose={() => setPhotoModal(false)} onCapture={handlePhoto} />
      )}

      {/* ── Congelar modal ── */}
      {congelarModal && (
        <CongelarModal
          m={m}
          onClose={() => setCongelarModal(false)}
          onConfirm={(fechaDesc) => {
            const today_ = new Date().toISOString().split("T")[0];
            const diasPrevios = m.dias_congelados || 0;
            const updated = {
              ...m,
              congelado: true,
              fecha_descongelar: fechaDesc || null,
              dias_congelados: diasPrevios,
              fecha_congelado: today_,
            };
            onSave(updated);
            setCongelarModal(false);
          }}
        />
      )}

      {/* ── Cobrar modal ── */}
      {cobrarModal && (() => {
        const tipoInfo = TIPOS_COBRO.find((t) => t.val === cobro.tipo);
        const handleCobrar = async () => {
          if (!cobro.monto || !cobro.tipo) return;
          const desc = cobro.desc.trim() || tipoInfo?.label + " - " + m.nombre;
          const cat = tipoInfo?.cat || "Otro";
          await onAddPago({
            id: uid(),
            tipo: "ingreso",
            categoria: cat,
            desc,
            descripcion: desc,
            monto: Number(cobro.monto),
            fecha: cobro.fecha,
            miembroId: m.id,
          });
          setCobrarModal(false);
        };
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.88)",
              backdropFilter: "blur(10px)",
              zIndex: 200,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                background: "#1a1a2e",
                borderRadius: "28px 28px 0 0",
                padding: "24px 24px 44px",
                animation: "slideUp .3s ease",
                maxHeight: "90%",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>
                  💰 Cobrar a {m.nombre.split(" ")[0]}
                </h2>
                <button
                  onClick={() => setCobrarModal(false)}
                  style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18 }}
                >
                  ✕
                </button>
              </div>

              {/* Tipo de cobro */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
                {TIPOS_COBRO.map((t) => (
                  <button
                    key={t.val}
                    onClick={() => setCobro((p) => ({ ...p, tipo: t.val, desc: "" }))}
                    style={{
                      flexShrink: 0,
                      padding: "7px 12px",
                      border: cobro.tipo === t.val ? "1.5px solid #4ade80" : "1.5px solid rgba(255,255,255,.08)",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      background: cobro.tipo === t.val ? "rgba(74,222,128,.12)" : "rgba(255,255,255,.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all .2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{t.icon}</span>
                    <span style={{ color: cobro.tipo === t.val ? "#4ade80" : "#9ca3af", fontSize: 12, fontWeight: cobro.tipo === t.val ? 700 : 500 }}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Descripción <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>(opcional)</span>
              </p>
              <input
                value={cobro.desc}
                onChange={(e) => setCobro((p) => ({ ...p, desc: e.target.value }))}
                placeholder={tipoInfo?.placeholder}
                style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Monto ($)
              </p>
              <input
                type="number"
                value={cobro.monto}
                onChange={(e) => setCobro((p) => ({ ...p, monto: e.target.value }))}
                placeholder="0.00"
                style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 16, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Fecha
              </p>
              <input
                type="date"
                value={cobro.fecha}
                onChange={(e) => setCobro((p) => ({ ...p, fecha: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Forma de pago
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[{ val: "Efectivo", icon: "💵" }, { val: "Transferencia", icon: "📲" }, { val: "Tarjeta", icon: "💳" }].map((op) => (
                  <button
                    key={op.val}
                    onClick={() => setCobro((p) => ({ ...p, formaPago: op.val }))}
                    style={{
                      flex: 1, padding: "10px 4px",
                      border: cobro.formaPago === op.val ? "2px solid #a78bfa" : "1.5px solid rgba(255,255,255,.08)",
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      background: cobro.formaPago === op.val ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.04)",
                      transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{op.icon}</span>
                    <span style={{ color: cobro.formaPago === op.val ? "#a78bfa" : "#6b7280", fontSize: 10, fontWeight: 700 }}>
                      {op.val}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleCobrar}
                disabled={!cobro.monto}
                style={{
                  width: "100%", padding: "14px", border: "none", borderRadius: 14,
                  cursor: cobro.monto ? "pointer" : "not-allowed", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700,
                  background: cobro.monto ? "linear-gradient(135deg,#4ade80,#22c55e)" : "rgba(255,255,255,.06)",
                  color: cobro.monto ? "#000" : "#4b4b6a",
                  boxShadow: cobro.monto ? "0 4px 18px rgba(74,222,128,.35)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s",
                }}
              >
                <span style={{ fontSize: 18 }}>💰</span> Registrar cobro
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Renovar modal ── */}
      {renovarModal && (() => {
        const esPrimeraMembresía = !txs.some(
          (t) =>
            t.categoria === "Membresías" &&
            (String(t.miembroId) === String(m.id) ||
              String(t.miembro_id) === String(m.id))
        );
        const esMesPasado =
          renovar.inicio && renovar.inicio < todayISO().slice(0, 7);
        return (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.88)",
              backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%", background: "#1a1a2e", borderRadius: "28px 28px 0 0",
                padding: "24px 24px 44px", animation: "slideUp .3s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>
                  🔄 {esPrimeraMembresía ? "Registrar membresía" : "Renovar membresía"}
                </h2>
                <button
                  onClick={() => setRenovarModal(false)}
                  style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 12 }}>
                {esPrimeraMembresía
                  ? "Primera membresía — puedes registrar una fecha de inicio pasada para reflejar el historial real del miembro."
                  : (() => {
                      const dias = diasParaVencer(m.vence);
                      return dias !== null && dias > 0
                        ? `¡Le quedan ${dias} día${dias !== 1 ? "s" : ""} a la membresía actual! El inicio sugerido es desde su fecha de vencimiento.`
                        : "La membresía está vencida. El inicio sugerido es hoy.";
                    })()}
              </p>

              {esPrimeraMembresía && (
                <div style={{ background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <p style={{ color: "#a78bfa", fontSize: 11 }}>
                    El pago quedará registrado en el mes de la fecha de inicio que elijas.
                  </p>
                </div>
              )}

              {esMesPasado && (
                <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <p style={{ color: "#f59e0b", fontSize: 11 }}>
                    Estás registrando en un <strong>mes pasado</strong> — el movimiento aparecerá en el historial de{" "}
                    {new Date(renovar.inicio + "T00:00:00").toLocaleString("es-MX", { month: "long", year: "numeric" })}.
                  </p>
                </div>
              )}

              <Inp
                label="Plan"
                value={renovar.plan}
                onChange={(v) =>
                  setRenovar((p) => ({
                    ...p,
                    plan: v,
                    monto: String(
                      (planPrecioActivo || {})[v] || p.monto
                    ),
                    vence: p.venceManual ? p.vence : calcVence(p.inicio, v),
                  }))
                }
                options={planesActivos}
              />
              <Inp
                label="Monto ($)"
                type="number"
                value={renovar.monto}
                onChange={(v) => setRenovar((p) => ({ ...p, monto: v }))}
                placeholder="0.00"
              />

              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Forma de pago
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[
                  { val: "Efectivo", icon: "💵" },
                  { val: "Transferencia", icon: "📲" },
                  { val: "Tarjeta", icon: "💳" },
                ].map((op) => (
                  <button
                    key={op.val}
                    onClick={() => setRenovar((p) => ({ ...p, formaPago: op.val }))}
                    style={{
                      flex: 1, padding: "10px 4px",
                      border: renovar.formaPago === op.val ? "2px solid #a78bfa" : "1.5px solid rgba(255,255,255,.08)",
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      background: renovar.formaPago === op.val ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.04)",
                      transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{op.icon}</span>
                    <span style={{ color: renovar.formaPago === op.val ? "#a78bfa" : "#6b7280", fontSize: 10, fontWeight: 700 }}>
                      {op.val}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Inicio
                  </p>
                  <input
                    type="date"
                    value={renovar.inicio}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!esPrimeraMembresía && v < todayISO()) return;
                      setRenovar((p) => ({
                        ...p,
                        inicio: v,
                        vence: p.venceManual ? p.vence : calcVence(v, p.plan),
                      }));
                    }}
                    style={{
                      width: "100%", background: "rgba(255,255,255,.07)",
                      border: `1px solid ${esMesPasado ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.15)"}`,
                      borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13,
                      fontFamily: "inherit", outline: "none", marginBottom: 12,
                    }}
                  />
                </div>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Vencimiento
                  </p>
                  <input
                    type="date"
                    value={renovar.vence}
                    min={renovar.inicio}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v < renovar.inicio) return;
                      setRenovar((p) => ({ ...p, vence: v, venceManual: true }));
                    }}
                    style={{
                      width: "100%", background: "rgba(255,255,255,.07)",
                      border: "1px solid rgba(255,255,255,.15)",
                      borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13,
                      fontFamily: "inherit", outline: "none", marginBottom: 12,
                    }}
                  />
                </div>
              </div>

              <div style={{ background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 14, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#4b4b6a", fontSize: 12 }}>Duración</span>
                <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 700 }}>
                  {(() => {
                    if (!renovar.inicio || !renovar.vence) return "—";
                    const [vy, vm, vd] = renovar.vence.split("-").map(Number);
                    const [iy, im, id2] = renovar.inicio.split("-").map(Number);
                    const diff = Math.round(
                      (new Date(vy, vm - 1, vd) - new Date(iy, im - 1, id2)) /
                        (1000 * 60 * 60 * 24)
                    );
                    return diff > 0 ? `${diff} días` : "Fecha inválida";
                  })()}
                </span>
              </div>

              <button
                onClick={handleRenovar}
                style={{
                  width: "100%", padding: "14px", border: "none", borderRadius: 14,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: "linear-gradient(135deg,#22d3ee,#06b6d4)",
                  color: "#fff", boxShadow: "0 4px 18px rgba(34,211,238,.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🔄</span>{" "}
                {esPrimeraMembresía ? "Registrar membresía" : "Confirmar renovación"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══════════ AVATAR + HEADER ══════════ */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 96, margin: "0 auto 12px" }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: "50%",
              background: m.estado === "Activo"
                ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                : "linear-gradient(135deg,#f43f5e,#fb923c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 34, color: "#fff", fontWeight: 700, overflow: "hidden",
              boxShadow: m.foto ? "0 0 0 3px rgba(108,99,255,.5)" : "none",
            }}
          >
            {m.foto
              ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : m.nombre.charAt(0)}
          </div>
          <button
            onClick={() => setPhotoModal(true)}
            style={{
              position: "absolute", bottom: -4, right: -4,
              width: 30, height: 30, borderRadius: 10,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)",
              border: "2px solid #191928", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, boxShadow: "0 2px 8px rgba(108,99,255,.5)",
            }}
          >
            📷
          </button>
        </div>

        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{m.nombre}</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginTop: 8 }}>
          <span
            style={{
              background:
                memInfo.estado === "Activo" ? "rgba(74,222,128,.15)"
                : memInfo.estado === "Congelado" ? "rgba(96,165,250,.15)"
                : memInfo.estado === "Sin membresía" ? "rgba(107,114,128,.15)"
                : "rgba(248,113,113,.15)",
              color:
                memInfo.estado === "Activo" ? "#4ade80"
                : memInfo.estado === "Congelado" ? "#60a5fa"
                : memInfo.estado === "Sin membresía" ? "#6b7280"
                : "#f87171",
              borderRadius: 10, padding: "4px 14px", fontSize: 12, fontWeight: 700,
            }}
          >
            {memInfo.estado === "Congelado" ? "🧊 Congelado" : memInfo.estado}
          </span>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 500 }}>
            {memInfo.estado === "Congelado"
              ? `🧊 Congelado — vence ${fmtDate(memInfo.vence)}`
              : memInfo.estado === "Activo"
              ? `Activo hasta ${fmtDate(memInfo.vence)}`
              : memInfo.estado === "Sin membresía"
              ? "Sin membresía registrada"
              : `Vencido desde ${fmtDate(memInfo.vence)}`}
          </span>
        </div>

        {m.tel && onGoToMensajes && (
          <button
            onClick={() => onGoToMensajes(m)}
            style={{
              marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 20,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg,#25d366,#128c7e)",
              color: "#fff", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 3px 12px rgba(37,211,102,.35)",
            }}
          >
            <span>💬</span> Enviar mensaje WA
          </button>
        )}

        {waUmbral !== null && m.tel && onGoToMensajes && (
          <button
            onClick={() => onGoToMensajes(m)}
            style={{
              marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 20,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg,#25d366,#128c7e)",
              color: "#fff", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 3px 12px rgba(37,211,102,.35)",
            }}
          >
            <span>💬</span>
            Enviar recordatorio WA (
            {diasRestantes === 0 ? "hoy" : diasRestantes === 1 ? "mañana" : `${diasRestantes} días`}
            )
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4, marginBottom: 18 }}>
        {[{ k: "perfil", label: "📋 Perfil" }, { k: "historial", label: "💳 Historial" }].map((t) => (
          <button
            key={t.k}
            onClick={() => setDetTab(t.k)}
            style={{
              flex: 1, padding: "9px 0", border: "none", borderRadius: 11, cursor: "pointer",
              fontFamily: "inherit",
              background: detTab === t.k ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "transparent",
              color: detTab === t.k ? "#fff" : "#4b4b6a",
              fontSize: 12, fontWeight: detTab === t.k ? 700 : 500,
              boxShadow: detTab === t.k ? "0 2px 12px rgba(108,99,255,.4)" : "none",
              transition: "all .2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: PERFIL ══════════ */}
      {detTab === "perfil" && (
        <>
          {editing ? (
            <>
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Datos personales
              </p>
              <Inp label="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Nombre completo" />
              <Inp label="Teléfono" value={form.tel} onChange={(v) => setForm((p) => ({ ...p, tel: v }))} placeholder="999 000 0000" type="tel" />

              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Fecha de incorporación
              </p>
              <input
                type="date"
                value={form.fecha_incorporacion}
                onChange={(e) => setForm((p) => ({ ...p, fecha_incorporacion: e.target.value }))}
                style={{
                  width: "100%", background: "rgba(255,255,255,.07)",
                  border: `1px solid ${form.fecha_incorporacion ? "rgba(255,255,255,.1)" : "rgba(245,158,11,.4)"}`,
                  borderRadius: 12, padding: "12px 14px",
                  color: form.fecha_incorporacion ? "#fff" : "#3d3d5c",
                  fontSize: 14, fontFamily: "inherit", outline: "none",
                  marginBottom: form.fecha_incorporacion ? 12 : 6,
                }}
              />
              {!form.fecha_incorporacion && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>
                  ⚠️ Sin fecha de incorporación — agrégala para no confundir con otras fechas
                </p>
              )}

              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Sexo
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { val: "Masculino", icon: "♂️", color: "#60a5fa" },
                  { val: "Femenino",  icon: "♀️", color: "#f472b6" },
                  { val: "",          icon: "—",  color: "#6b7280" },
                ].map((op) => (
                  <button
                    key={op.val}
                    onClick={() => setForm((p) => ({ ...p, sexo: op.val }))}
                    style={{
                      flex: 1, padding: "10px 0",
                      border: form.sexo === op.val ? `2px solid ${op.color}` : "1.5px solid rgba(255,255,255,.08)",
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      background: form.sexo === op.val ? `${op.color}20` : "rgba(255,255,255,.04)",
                      color: form.sexo === op.val ? op.color : "#4b4b6a",
                      fontSize: 12, fontWeight: 700, transition: "all .2s",
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{op.icon}</div>
                    {op.val || "N/E"}
                  </button>
                ))}
              </div>

              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Fecha de nacimiento
              </p>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))}
                style={{
                  width: "100%", background: "rgba(255,255,255,.07)",
                  border: `1px solid ${form.fecha_nacimiento ? "rgba(255,255,255,.1)" : "rgba(245,158,11,.4)"}`,
                  borderRadius: 12, padding: "12px 14px",
                  color: form.fecha_nacimiento ? "#fff" : "#3d3d5c",
                  fontSize: 14, fontFamily: "inherit", outline: "none",
                  marginBottom: form.fecha_nacimiento ? 12 : 6,
                }}
              />
              {!form.fecha_nacimiento && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>
                  ⚠️ Sin fecha de nacimiento — agrégala para ver cumpleaños
                </p>
              )}

              <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                📝 Notas internas{" "}
                <span style={{ color: "#6b7280", fontWeight: 400, fontSize: 10, textTransform: "none" }}>(opcional)</span>
              </p>
              <textarea
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                rows={3}
                placeholder="Ej: Tiene lesión de rodilla. Paga los viernes. Familiar del dueño."
                style={{
                  width: "100%", background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(167,139,250,.2)", borderRadius: 12,
                  padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit",
                  outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 14,
                }}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <Btn full outline color="#6b7280" onClick={() => setEditing(false)}>Cancelar</Btn>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  style={{
                    flex: 1, padding: "13px 20px", border: "none", borderRadius: 14,
                    cursor: hasChanges ? "pointer" : "not-allowed", fontFamily: "inherit",
                    fontSize: 14, fontWeight: 700,
                    background: hasChanges ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.06)",
                    color: hasChanges ? "#fff" : "#4b4b6a",
                    boxShadow: hasChanges ? "0 4px 18px rgba(108,99,255,.4)" : "none",
                    transition: "all .3s",
                  }}
                >
                  {hasChanges ? "Guardar ✓" : "Sin cambios"}
                </button>
              </div>

              {/* ── Eliminar miembro ── */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      width: "100%", padding: "10px", border: "1px solid rgba(244,63,94,.2)",
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                      fontWeight: 600, background: "transparent", color: "rgba(244,63,94,.5)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    🗑️ Eliminar miembro
                  </button>
                ) : !confirmDelete2 ? (
                  <div style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 14, padding: 14 }}>
                    <p style={{ color: "#f43f5e", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      ⚠️ ¿Eliminar a {m.nombre}?
                    </p>
                    <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 12 }}>
                      Se borrarán también todas sus transacciones (
                      {txs.filter((t) => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length}{" "}
                      movimiento
                      {txs.filter((t) => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length !== 1 ? "s" : ""}
                      ). Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#6b7280" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => setConfirmDelete2(true)}
                        style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "rgba(244,63,94,.2)", color: "#f43f5e" }}
                      >
                        Sí, eliminar todo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(244,63,94,.12)", border: "2px solid rgba(244,63,94,.5)", borderRadius: 14, padding: 14 }}>
                    <p style={{ color: "#f43f5e", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🚨 Confirmación final</p>
                    <p style={{ color: "#9ca3af", fontSize: 11, marginBottom: 12 }}>
                      Escribe <strong style={{ color: "#f43f5e" }}>ELIMINAR</strong> para confirmar
                    </p>
                    <ConfirmDeleteInput
                      nombre={m.nombre}
                      onConfirm={() => onDelete && onDelete(m.id)}
                      onCancel={() => { setConfirmDelete(false); setConfirmDelete2(false); }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Banner cumpleaños ── */}
              {diasCumple !== null && diasCumple <= 7 && (
                <div
                  style={{
                    background: diasCumple === 0
                      ? "linear-gradient(135deg,rgba(250,204,21,.2),rgba(234,179,8,.1))"
                      : "rgba(250,204,21,.08)",
                    border: `1px solid ${diasCumple === 0 ? "rgba(250,204,21,.5)" : "rgba(250,204,21,.2)"}`,
                    borderRadius: 16, padding: "12px 16px", marginBottom: 14,
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <span style={{ fontSize: 26 }}>{diasCumple === 0 ? "🎂" : "🎁"}</span>
                  <div>
                    <p style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>
                      {diasCumple === 0
                        ? `¡Hoy es el cumpleaños de ${m.nombre.split(" ")[0]}! 🎉`
                        : diasCumple === 1
                        ? `Mañana es el cumpleaños de ${m.nombre.split(" ")[0]}`
                        : `Cumpleaños en ${diasCumple} días`}
                    </p>
                    {edad !== null && (
                      <p style={{ color: "#92400e", fontSize: 11, marginTop: 2 }}>
                        {diasCumple === 0 ? `¡Cumple ${edad} años hoy!` : `Cumplirá ${edad + 1} años`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Datos personales ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Datos personales
              </p>
              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {[
                  { label: "📱 Teléfono", val: m.tel || "—" },
                  {
                    label: "📆 Incorporación",
                    custom: !m.fecha_incorporacion ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{fmtDate(m.fecha_incorporacion) || m.fecha_incorporacion}</span>
                    ),
                  },
                  {
                    label: "⚧ Sexo",
                    custom: !m.sexo ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: m.sexo === "Masculino" ? "#60a5fa" : "#f472b6", fontWeight: 700, fontSize: 13 }}>
                        {m.sexo === "Masculino" ? "♂️" : "♀️"} {m.sexo}
                      </span>
                    ),
                  },
                  {
                    label: "🎂 Nacimiento",
                    custom: !m.fecha_nacimiento ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                        {fmtDate(m.fecha_nacimiento)}{edad !== null ? ` · ${edad} años` : ""}
                        {diasCumple !== null && diasCumple <= 30 && (
                          <span style={{ color: "#fbbf24", marginLeft: 6, fontSize: 11 }}>🎂 en {diasCumple}d</span>
                        )}
                      </span>
                    ),
                  },
                ].map((row, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                    }}
                  >
                    <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                    {row.custom || <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{row.val || "—"}</span>}
                  </div>
                ))}
              </div>

              {/* ── Membresía actual ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Membresía actual
              </p>

              {memInfo.congelado && (
                <div style={{ background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 14, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🧊</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700 }}>Membresía congelada</p>
                    <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>
                      {memInfo.fechaDescongelar
                        ? `Se descongela el ${fmtDate(memInfo.fechaDescongelar)}`
                        : "Se descongela manualmente"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const inicioCongelado = m.fecha_congelado
                        ? new Date(m.fecha_congelado + "T00:00:00")
                        : null;
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);
                      const diasNuevos = inicioCongelado
                        ? Math.round((hoy - inicioCongelado) / (1000 * 60 * 60 * 24))
                        : 0;
                      const updated = {
                        ...m,
                        congelado: false,
                        fecha_descongelar: null,
                        fecha_congelado: null,
                        dias_congelados: (m.dias_congelados || 0) + diasNuevos,
                      };
                      onSave(updated);
                    }}
                    style={{
                      background: "rgba(96,165,250,.2)", border: "1px solid rgba(96,165,250,.4)",
                      borderRadius: 10, padding: "6px 12px", color: "#60a5fa",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Descongelar
                  </button>
                </div>
              )}

              {memInfo.esGratis && memInfo.estado !== "Sin membresía" && (
                <div style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 14, padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🎁</span>
                  <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700 }}>Membresía en cortesía (sin costo)</p>
                </div>
              )}

              <div
                style={{
                  background: memInfo.estado === "Activo" || memInfo.congelado
                    ? "rgba(34,211,238,.05)" : "rgba(248,113,113,.05)",
                  border: `1px solid ${memInfo.estado === "Activo" || memInfo.congelado
                    ? "rgba(34,211,238,.15)" : "rgba(248,113,113,.15)"}`,
                  borderRadius: 14, padding: "0 14px", marginBottom: 16,
                }}
              >
                {memInfo.estado !== "Sin membresía" ? (
                  [
                    { label: "📋 Plan", val: memInfo.plan || "—" },
                    { label: "📅 Inicio", val: fmtDate(memInfo.inicio) || "—" },
                    { label: "⏰ Vence", val: memInfo.congelado ? `${fmtDate(memInfo.vence)} (+congelado)` : fmtDate(memInfo.vence) || "—" },
                    { label: "💰 Último pago", val: memInfo.esGratis ? "Cortesía 🎁" : (memInfo.monto ? `$${Number(memInfo.monto).toLocaleString("es-MX")}` : "—") },
                    ...(memInfo.formaPago
                      ? [{ label: "💳 Forma de pago", val: memInfo.formaPago === "Efectivo" ? "💵 Efectivo" : memInfo.formaPago === "Transferencia" ? "📲 Transferencia" : "💳 Tarjeta" }]
                      : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                      <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                      <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 600 }}>{row.val}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "18px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, marginBottom: 6 }}>📋</p>
                    <p style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>Sin membresía registrada</p>
                    <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 4 }}>Usa Renovar para registrar un nuevo pago</p>
                  </div>
                )}
              </div>

              {/* ── Notas internas ── */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  📝 Notas internas
                </p>
                {m.notas ? (
                  <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.notas}</p>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditing(true)}
                    style={{ background: "rgba(255,255,255,.03)", border: "1px dashed rgba(255,255,255,.08)", borderRadius: 12, padding: "12px 14px", textAlign: "center", cursor: "pointer" }}
                  >
                    <p style={{ color: "#4b4b6a", fontSize: 12 }}>Sin notas — toca para agregar</p>
                  </div>
                )}
              </div>

              {/* ── Resumen financiero ── */}
              {(() => {
                const inicioDate = memInfo.inicio ? parseDate(memInfo.inicio) : null;
                const mesActivo = inicioDate
                  ? historial.filter((t) => {
                      const d = parseDate(t.fecha);
                      return d && d.getFullYear() === inicioDate.getFullYear() && d.getMonth() === inicioDate.getMonth();
                    })
                  : historial;
                const totalMes = mesActivo.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
                const MESES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const mesLabel = inicioDate
                  ? `${MESES_SHORT[inicioDate.getMonth()]} ${inicioDate.getFullYear()}`
                  : "Este mes";
                return (
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.15)", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
                        Pagado {mesLabel}
                      </p>
                      <p style={{ color: "#22d3ee", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                        ${totalMes.toLocaleString("es-MX")}
                      </p>
                    </div>
                    <div style={{ flex: 1, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
                        Movimientos
                      </p>
                      <p style={{ color: "#a78bfa", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                        {historial.length}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Botones de acción ── */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Btn full outline color="#a78bfa" onClick={() => setEditing(true)}>✏️ Editar</Btn>
                <Btn
                  full
                  onClick={() => {
                    const dias = diasParaVencer(memInfo.vence);
                    const venceISO = (() => {
                      const v = parseDate(memInfo.vence);
                      if (!v) return todayISO();
                      v.setHours(0, 0, 0, 0);
                      return v.toISOString().split("T")[0];
                    })();
                    const sugerido = dias !== null && dias > 0 ? venceISO : todayISO();
                    setRenovar({
                      plan: memInfo.plan || defaultPlan,
                      monto: String(memInfo.monto || (planPrecioActivo && planPrecioActivo[memInfo.plan || defaultPlan]) || defaultMonto || ""),
                      inicio: sugerido,
                      vence: calcVence(sugerido, memInfo.plan || defaultPlan),
                      venceManual: false,
                      formaPago: "Efectivo",
                    });
                    setRenovarModal(true);
                  }}
                  color="#22d3ee"
                >
                  🔄 Renovar
                </Btn>
              </div>
              <Btn
                full
                outline
                color="#4ade80"
                onClick={() => {
                  setCobro({ tipo: "libre", desc: "", monto: "", fecha: todayISO(), formaPago: "Efectivo" });
                  setCobrarModal(true);
                }}
              >
                💰 + Cobrar
              </Btn>
              {memInfo.estado === "Activo" && !memInfo.congelado && (
                <Btn full outline color="#60a5fa" onClick={() => setCongelarModal(true)} style={{ marginTop: 8 }}>
                  🧊 Congelar membresía
                </Btn>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════ TAB: HISTORIAL ══════════ */}
      {detTab === "historial" && (
        <>
          {historial.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
              <p style={{ color: "#4b4b6a", fontSize: 13 }}>Sin movimientos registrados</p>
            </div>
          ) : (
            <div>
              {(() => {
                const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                const grupos = {};
                historial.forEach((t) => {
                  const d = parseDate(t.fecha);
                  const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}` : "sin-fecha";
                  const label = d ? `${MESES[d.getMonth()]} ${d.getFullYear()}` : "Sin fecha";
                  if (!grupos[key]) grupos[key] = { label, txs: [] };
                  grupos[key].txs.push(t);
                });
                return Object.keys(grupos)
                  .sort((a, b) => b.localeCompare(a))
                  .map((key) => {
                    const g = grupos[key];
                    const totalMes = g.txs
                      .filter((t) => t.tipo === "ingreso")
                      .reduce((s, t) => s + Number(t.monto), 0);
                    return (
                      <div key={key} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
                            {g.label}
                          </p>
                          <p style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                            ${totalMes.toLocaleString("es-MX")}
                          </p>
                        </div>
                        {g.txs.map((t) => {
                          const desc = t.desc || t.descripcion || "—";
                          const isIngreso = t.tipo === "ingreso";
                          const color = isIngreso ? "#22d3ee" : "#f43f5e";
                          const bgColor = isIngreso ? "rgba(34,211,238,.10)" : "rgba(244,63,94,.10)";
                          return (
                            <div
                              key={t.id}
                              className="rh"
                              onClick={() => onEditTx && onEditTx(t)}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "13px 14px", borderRadius: 16, marginBottom: 8,
                                background: "rgba(255,255,255,.04)",
                                border: "1px solid rgba(255,255,255,.06)", cursor: "pointer",
                              }}
                            >
                              <div style={{ width: 42, height: 42, borderRadius: "50%", fontSize: 18, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: `2px solid ${color}30` }}>
                                {isIngreso && m.foto
                                  ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : CAT_ICON[t.categoria] || (isIngreso ? "💰" : "💸")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                  {desc}
                                </p>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                  <span style={{ background: bgColor, color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                                    {t.categoria}
                                  </span>
                                  <span style={{ color: "#4b4b6a", fontSize: 10 }}>· {fmtDate(t.fecha)}</span>
                                </div>
                              </div>
                              <p style={{ color, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                                {isIngreso ? "+" : "-"}{fmt(t.monto)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
              })()}
            </div>
          )}

          {pagoModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", background: "#1e1e30", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>💰 Registrar cobro extra</h2>
                  <button onClick={() => setPagoModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <Inp label="Descripción" value={pago.desc} onChange={(v) => setPago((p) => ({ ...p, desc: v }))} placeholder="Ej: Clase extra, venta tienda, etc." />
                <Inp label="Monto ($)" type="number" value={pago.monto} onChange={(v) => setPago((p) => ({ ...p, monto: v }))} placeholder="0.00" />
                <Inp label="Fecha" type="date" value={pago.fecha} onChange={(v) => setPago((p) => ({ ...p, fecha: v }))} />
                <Btn full onClick={handleAddPago} color="#22d3ee">Guardar pago ✓</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
