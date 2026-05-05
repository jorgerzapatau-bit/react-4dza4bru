// src/modals/MemberDetailModal.jsx
import { useState, useEffect } from "react";
import MemberQRTab from "./MemberQRTab";
import { Btn, Inp } from "../components/UI";
import PhotoModal from "../components/PhotoModal";
import { CAT_ICON } from "../utils/constants";
import { GRADOS_KARATE, GRADOS_NOMBRES, getGradoInfo } from "../utils/constants";
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
import { uid } from "../utils/helpers";
import { esMenorDeEdad, validarTutor } from "../utils/tutorUtils";
import TutorFields from "../components/TutorFields";

const useIsDesktop = () => {
  const [ok, setOk] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : false);
  useEffect(() => {
    const h = () => setOk(window.innerWidth >= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return ok;
};

// ── Helpers de formato ──────────────────────────────────────────
function fmt$(n) { return "$" + Number(n || 0).toLocaleString("es-MX"); }

// ── Generador de Comprobante de Pago (Canvas PNG) ───────────────
async function generarComprobantePNG({ gymConfig, miembro, plan, monto, formaPago, venceISO }) {
  const gym = gymConfig || {};
  const W = 560;
  const DIAS  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const hoyD = new Date();
  const fechaHoy  = `${DIAS[hoyD.getDay()]}, ${MESES[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO
    ? (() => { const d = new Date(venceISO+"T00:00:00"); return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })()
    : "—";

  const rows = [
    { label: "Fecha:",        value: fechaHoy,                                        bold: true },
    { type: "alumno",         nombre: (miembro.nombre || "—").toUpperCase(), plan: `Plan ${plan || "—"}` },
    { label: "Modo de Pago:", value: (formaPago || "—").toUpperCase(),                bold: true },
    { label: "Cantidad:",     value: fmt$(monto),                                     bold: true },
    { label: "Vencimiento:",  value: venceLong,                                       bold: true },
    { label: "Recibió:",      value: gym.propietario_nombre || "—",                   bold: false },
  ];

  const HEADER_H = 140, ROW_H = 36, CLABE_H = gym.transferencia_clabe ? 90 : 0, FOOTER_H = 60, STAMP_H = 50;
  const H = HEADER_H + rows.length * ROW_H + CLABE_H + FOOTER_H + STAMP_H + 8;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f9fafb"; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke();

  const LOGO_SZ = 80, LX = 20, LY = 18;
  if (gym.logo) {
    await new Promise(res => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { ctx.save(); ctx.beginPath(); ctx.roundRect(LX,LY,LOGO_SZ,LOGO_SZ,10); ctx.clip(); ctx.drawImage(img,LX,LY,LOGO_SZ,LOGO_SZ); ctx.restore(); res(); };
      img.onerror = res; img.src = gym.logo;
    });
  } else {
    ctx.fillStyle = "#1e1b4b"; ctx.beginPath(); ctx.roundRect(LX,LY,LOGO_SZ,LOGO_SZ,10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🥋", LX+LOGO_SZ/2, LY+LOGO_SZ/2); ctx.textBaseline = "alphabetic";
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#111827"; ctx.font = "bold 17px Georgia,serif";
  ctx.fillText((gym.nombre || "GYM").toUpperCase(), W/2, 38);
  ctx.fillStyle = "#6b7280"; ctx.font = "13px Georgia,serif";
  ctx.fillText(gym.slogan || "", W/2, 58);
  if (gym.telefono) { ctx.fillStyle = "#374151"; ctx.font = "12px Arial"; ctx.fillText(`WhatsApp: ${gym.telefono}`, W/2, 78); }
  if (gym.facebook) { ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial"; ctx.fillText(`Facebook: ${gym.facebook}`, W/2, 96); }
  ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 110); ctx.lineTo(W-20, 110); ctx.stroke();
  ctx.fillStyle = "#ef4444"; ctx.font = "bold 9px Arial"; ctx.textAlign = "right";
  ctx.fillText("COMPROBANTE DE PAGO RECIBIDO", W-16, 128); ctx.textAlign = "left";

  let y = HEADER_H + 2;
  rows.forEach((row, i) => {
    ctx.fillStyle = i%2===0?"#ffffff":"#f9fafb"; ctx.fillRect(0,y,W,ROW_H);
    ctx.strokeStyle="#f3f4f6"; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(0,y+ROW_H-0.5); ctx.lineTo(W,y+ROW_H-0.5); ctx.stroke();
    if (row.type === "alumno") {
      ctx.fillStyle="#111827"; ctx.font="bold 15px Arial"; ctx.textAlign="center"; ctx.fillText(row.nombre, W/2, y+20);
      ctx.fillStyle="#6b7280"; ctx.font="11px Arial"; ctx.fillText(row.plan, W/2, y+ROW_H-6); ctx.textAlign="left";
    } else {
      ctx.fillStyle="#6b7280"; ctx.font="12px Arial"; ctx.fillText(row.label, 24, y+ROW_H-12);
      ctx.fillStyle="#111827"; ctx.font=row.bold?"bold 13px Arial":"13px Arial"; ctx.textAlign="right";
      ctx.fillText(row.value, W-24, y+ROW_H-12); ctx.textAlign="left";
    }
    y += ROW_H;
  });

  if (gym.transferencia_clabe) {
    ctx.fillStyle="#f3f4f6"; ctx.fillRect(0,y,W,CLABE_H);
    ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    ctx.fillStyle="#111827"; ctx.font="bold 12px Arial"; ctx.textAlign="left"; ctx.fillText("PARA TRANSFERENCIAS:", 24, y+22);
    ctx.font="12px Arial"; ctx.fillStyle="#374151";
    ctx.fillText(`CLABE:  ${gym.transferencia_clabe}`, 24, y+42);
    ctx.fillText(`Beneficiario:  ${gym.transferencia_titular||"—"}`, 24, y+60);
    if (gym.transferencia_banco) ctx.fillText(`Banco:  ${gym.transferencia_banco}`, 24, y+78);
    y += CLABE_H;
  }

  ctx.fillStyle="#f9fafb"; ctx.fillRect(0,y,W,FOOTER_H);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  ctx.fillStyle="#6b7280"; ctx.font="11px Arial"; ctx.textAlign="center";
  ctx.fillText("Favor de enviar comprobante de transferencia al número de", W/2, y+22);
  ctx.fillText("Whatsapp que aparece en la parte superior de este recibo.", W/2, y+40);
  y += FOOTER_H;
  ctx.fillStyle="#111827"; ctx.font="bold 20px Arial"; ctx.textAlign="center";
  ctx.fillText("COMPROBANTE DE PAGO RECIBIDO", W/2, y+34);

  return canvas.toDataURL("image/png");
}

// ── Generador de Info de Transferencia (Canvas PNG) ──────────────
async function generarInfoTransferenciaPNG({ gymConfig, miembro, plan, monto, venceISO }) {
  const gym = gymConfig || {};
  const W = 560;
  const DIAS  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const hoyD = new Date();
  const fechaHoy  = `${DIAS[hoyD.getDay()]}, ${MESES[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO
    ? (() => { const d = new Date(venceISO+"T00:00:00"); return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })()
    : "—";

  const tableRows = [
    ...(gym.facebook ? [{ label: "Facebook:", value: gym.facebook, span: true }] : []),
    { label: "Fecha:",        value: fechaHoy },
    { label: "ALUMNO",        value: (miembro.nombre||"—").toUpperCase(), bold: true },
    { label: "",              value: (MESES[hoyD.getMonth()]).toUpperCase() },
    { label: "Modo de Pago:", value: "TRANSFERENCIA" },
    { label: "Cantidad:",     value: fmt$(monto), big: true },
    { label: "Vencimiento:",  value: venceLong, bold: true },
    { label: "Recibió:",      value: gym.propietario_nombre || gym.transferencia_titular || "—" },
  ];

  const HEADER_H = 140, ROW_H = 36, CLABE_H = 100, FOOTER_H = 56;
  const H = HEADER_H + tableRows.length * ROW_H + CLABE_H + FOOTER_H + 8;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#f9fafb"; ctx.fillRect(0,0,W,HEADER_H);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,HEADER_H); ctx.lineTo(W,HEADER_H); ctx.stroke();

  const LOGO_SZ=80, LX=20, LY=18;
  if (gym.logo) {
    await new Promise(res => {
      const img=new Image(); img.crossOrigin="anonymous";
      img.onload=()=>{ ctx.save(); ctx.beginPath(); ctx.roundRect(LX,LY,LOGO_SZ,LOGO_SZ,10); ctx.clip(); ctx.drawImage(img,LX,LY,LOGO_SZ,LOGO_SZ); ctx.restore(); res(); };
      img.onerror=res; img.src=gym.logo;
    });
  } else {
    ctx.fillStyle="#1e1b4b"; ctx.beginPath(); ctx.roundRect(LX,LY,LOGO_SZ,LOGO_SZ,10); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold 28px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🥋",LX+LOGO_SZ/2,LY+LOGO_SZ/2); ctx.textBaseline="alphabetic";
  }
  ctx.textAlign="center";
  ctx.fillStyle="#111827"; ctx.font="bold 17px Georgia,serif"; ctx.fillText((gym.nombre||"GYM").toUpperCase(), W/2, 38);
  ctx.fillStyle="#6b7280"; ctx.font="13px Georgia,serif"; ctx.fillText(gym.slogan||"", W/2, 58);
  if (gym.telefono) { ctx.fillStyle="#374151"; ctx.font="12px Arial"; ctx.fillText(`WhatsApp: ${gym.telefono}`, W/2, 78); }

  let y = HEADER_H + 2;
  tableRows.forEach((row, i) => {
    ctx.fillStyle=i%2===0?"#fff":"#f9fafb"; ctx.fillRect(0,y,W,ROW_H);
    ctx.strokeStyle="#f3f4f6"; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(0,y+ROW_H-0.5); ctx.lineTo(W,y+ROW_H-0.5); ctx.stroke();
    if (row.span) {
      ctx.fillStyle="#374151"; ctx.font="12px Arial"; ctx.textAlign="center";
      ctx.fillText(`${row.label}  ${row.value}`, W/2, y+ROW_H-10); ctx.textAlign="left";
    } else if (row.big) {
      ctx.fillStyle="#6b7280"; ctx.font="12px Arial"; ctx.textAlign="left"; ctx.fillText(row.label, 24, y+ROW_H-10);
      ctx.fillStyle="#111827"; ctx.font="bold 16px Arial"; ctx.textAlign="right"; ctx.fillText(row.value, W-24, y+ROW_H-10); ctx.textAlign="left";
    } else {
      ctx.fillStyle="#6b7280"; ctx.font=row.bold?"bold 12px Arial":"12px Arial"; ctx.fillText(row.label, 24, y+ROW_H-10);
      ctx.fillStyle="#111827"; ctx.font=row.bold?"bold 13px Arial":"13px Arial"; ctx.textAlign="right"; ctx.fillText(row.value, W-24, y+ROW_H-10); ctx.textAlign="left";
    }
    y += ROW_H;
  });

  ctx.fillStyle="#fff"; ctx.fillRect(0,y,W,CLABE_H);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  ctx.fillStyle="#111827"; ctx.font="bold 12px Arial"; ctx.textAlign="left"; ctx.fillText("PARA TRANSFERENCIAS:", 24, y+22);
  ctx.font="12px Arial"; ctx.fillStyle="#374151";
  ctx.fillText(`CLABE:   ${gym.transferencia_clabe||"—"}`, 24, y+42);
  ctx.fillText(`Beneficiario:   ${gym.transferencia_titular||"—"}`, 24, y+60);
  if (gym.transferencia_banco) ctx.fillText(`Banco:   ${gym.transferencia_banco}`, 24, y+78);
  y += CLABE_H;

  ctx.fillStyle="#f3f4f6"; ctx.fillRect(0,y,W,FOOTER_H);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  ctx.fillStyle="#374151"; ctx.font="bold 11px Arial"; ctx.textAlign="center";
  ctx.fillText("Favor de enviar comprobante de transferencia al número de", W/2, y+20);
  ctx.fillText("Whatsapp que aparece en la parte superior de este recibo.", W/2, y+38);

  return canvas.toDataURL("image/png");
}

// ── Copiar imagen PNG al portapapeles ────────────────────────────
async function copiarImagenAlPortapapeles(dataUrl) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    const win = window.open();
    if (win) win.document.write(`<img src="${dataUrl}" style="max-width:100%">`);
    return false;
  }
}

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
          background: "var(--bg-card)",
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
          <p style={{ color: "#8b949e", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            Los días congelados se suman automáticamente al vencimiento cuando
            se descongele.
          </p>
        </div>
        <p
          style={{
            color: "#8b949e",
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
                background: modo === op.val ? "rgba(96,165,250,.1)" : "var(--bg-elevated)",
                textAlign: "center",
              }}
            >
              <p style={{ color: modo === op.val ? "#60a5fa" : "#8b949e", fontSize: 11, fontWeight: 700 }}>
                {op.label}
              </p>
              <p style={{ color: "#8b949e", fontSize: 9, marginTop: 3, lineHeight: 1.4 }}>
                {op.desc}
              </p>
            </button>
          ))}
        </div>
        {modo === "fecha" && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              Fecha de regreso
            </p>
            <input
              type="date"
              value={fechaDesc}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setFechaDesc(e.target.value)}
              style={{
                width: "100%",
                background: "#21262d",
                border: "1px solid rgba(96,165,250,.3)",
                borderRadius: 12,
                padding: "12px 14px",
                color: fechaDesc ? "#fff" : "#484f58",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn full outline color="#8b949e" onClick={onClose}>
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
          background: "var(--bg-elevated)",
          border: `1px solid ${ok ? "rgba(244,63,94,.6)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "10px 12px",
          color: "var(--text-primary)",
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
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
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
  formCfg,
  onUpdatePlantillas,
  onDelete,
  onGoToMensajes,
  gymId,
  onMemberUpdate,
  planesMembresia,
  isDojo,
  activePlanes,
  clases,
  horarios,
  miembroClases,
  onUpdateMiembroClases,
}) {
  const isDesktop = useIsDesktop();
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
    beca: m.beca || false,
    // ── Tutor (Fase 1) ──
    tutor_nombre:     m.tutor_nombre     || "",
    tutor_telefono:   m.tutor_telefono   || "",
    tutor_parentesco: m.tutor_parentesco || "",
    // ── DOJO: Grado y cinturón ──
    grado_actual:        m.grado_actual        || "",
    fecha_ultimo_examen: m.fecha_ultimo_examen || "",
    proximo_objetivo:    m.proximo_objetivo    || "",
  });
  const [tutorErrores, setTutorErrores] = useState({});
  const [pagoModal, setPagoModal] = useState(false);
  const [clasesPagoModal, setClasesPagoModal] = useState(false); // modal forma de pago al asignar clases con costo
  const [clasesPagoFormaPago, setClasesPagoFormaPago] = useState("Efectivo");
  const [clasesPagoSaving, setClasesPagoSaving] = useState(false);

  // ── Clases múltiples asignadas al miembro ──
  const clasesDelMiembro = (miembroClases || [])
    .filter(mc => String(mc.miembro_id) === String(m.id))
    .map(mc => String(mc.clase_id));

  const [clasesEdit, setClasesEdit] = useState(clasesDelMiembro);

  const clasesHanCambiado = editing && (
    clasesEdit.length !== clasesDelMiembro.length ||
    clasesEdit.some(id => !clasesDelMiembro.includes(id))
  );

  const guardarClasesMiembro = async (nuevasIds, clasesAnteriores, formaPagoClases = "Efectivo") => {
    if (!gymId) return;
    try {
      const supabaseLib = await import("../supabase.js").then(mod => mod.default);
      const db = await supabaseLib.from("miembro_clases");

      // ── Solo insertar clases que no existían antes (nunca borrar las anteriores) ──
      const clasesAntIds = (clasesAnteriores || []).map(String);
      const clasesSoloNuevas = nuevasIds.filter(id => !clasesAntIds.includes(String(id)));
      // Clases que se desmarcaron → eliminar solo esas
      const clasesEliminadas = clasesAntIds.filter(id => !nuevasIds.map(String).includes(id));

      // Insertar nuevas
      const insertadas = [];
      for (const claseId of clasesSoloNuevas) {
        const saved = await db.insert({ gym_id: gymId, miembro_id: m.id, clase_id: claseId });
        if (saved) insertadas.push(saved);
      }
      // Eliminar solo las desmarcadas
      for (const claseId of clasesEliminadas) {
        const mc = (miembroClases || []).find(x =>
          String(x.miembro_id) === String(m.id) && String(x.clase_id) === claseId
        );
        if (mc?.id) await db.delete(mc.id);
      }

      // Actualizar estado global
      if (onUpdateMiembroClases) {
        const eliminadasSet = new Set(clasesEliminadas);
        const sinEliminadas = (miembroClases || []).filter(mc =>
          !(String(mc.miembro_id) === String(m.id) && eliminadasSet.has(String(mc.clase_id)))
        );
        onUpdateMiembroClases([...sinEliminadas, ...insertadas]);
      }

      // ── Generar transacción + comprobante por cada clase nueva con costo ──
      if (!m.beca && onAddPago && clasesSoloNuevas.length > 0) {
        const getPrecio = (c) => {
          const planVinc = (planesMembresia||[]).find(p =>
            (p.clases_vinculadas||[]).map(String).includes(String(c.id)) ||
            p.clase_nombre === c.nombre || p.nombre === c.nombre
          );
          return Number(planVinc?.precio_publico ?? c?.precio_membresia ?? c?.costo ?? 0);
        };

        // Acumular clases con costo para un solo comprobante
        const clasesConCosto = clasesSoloNuevas
          .map(id => (clases||[]).find(c => String(c.id) === String(id)))
          .filter(c => c && getPrecio(c) > 0);

        if (clasesConCosto.length > 0) {
          const montoTotal = clasesConCosto.reduce((s, c) => s + getPrecio(c), 0);
          const nombresClases = clasesConCosto.map(c => c.nombre).join(", ");
          const desc = `Clase${clasesConCosto.length > 1 ? "s" : ""}: ${nombresClases} - ${m.nombre}`;

          await onAddPago({
            tipo: "ingreso",
            categoria: "Clases",
            desc,
            descripcion: desc,
            monto: montoTotal,
            fecha: todayISO(),
            miembroId: m.id,
          });

          // Generar PNG de comprobante y abrir modal
          try {
            const png = await generarComprobantePNG({
              gymConfig,
              miembro: m,
              plan: nombresClases,
              monto: montoTotal,
              formaPago: formaPagoClases,
              venceISO: null,
            });
            setComprobanteData({ tipo: "efectivo", png, plan: nombresClases, monto: montoTotal, formaPago: formaPagoClases, vence: null });
            setComprobanteModal(true);
          } catch(e) {
            console.warn("No se pudo generar comprobante de clase:", e);
          }
        }
      }
    } catch(e) {
      console.error("❌ Error guardando clases del miembro:", e);
    }
  };
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
  const [renovarStep, setRenovarStep] = useState(1); // 1 = membresía, 2 = pago, 3 = comprobante
  const [renovarCompPNG, setRenovarCompPNG] = useState(null);
  const [renovarInfoPNG, setRenovarInfoPNG] = useState(null);
  const [renovarCopiado, setRenovarCopiado] = useState(false);
  const [renovarSaving, setRenovarSaving] = useState(false);
  const [planCambiado, setPlanCambiado] = useState(false);
  const [planOriginal, setPlanOriginal] = useState(null);
  const [comprobanteModal, setComprobanteModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [comprobanteData, setComprobanteData] = useState(null); // { tipo: "efectivo"|"transferencia", png, infoPNG, plan, monto, vence }
  const [copiado, setCopiado] = useState(false);
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
    planesExtra: [],
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

  const esEdicionMenor = esMenorDeEdad(form.fecha_nacimiento);

  const hasChanges =
    form.nombre !== m.nombre ||
    form.tel !== (m.tel || "") ||
    form.fecha_incorporacion !== (m.fecha_incorporacion || "") ||
    form.sexo !== (m.sexo || "") ||
    form.fecha_nacimiento !== (m.fecha_nacimiento || "") ||
    form.notas !== (m.notas || "") ||
    form.tutor_nombre     !== (m.tutor_nombre     || "") ||
    form.tutor_telefono   !== (m.tutor_telefono   || "") ||
    form.tutor_parentesco !== (m.tutor_parentesco || "") ||
    form.beca !== (m.beca || false) ||
    form.grado_actual        !== (m.grado_actual        || "") ||
    form.fecha_ultimo_examen !== (m.fecha_ultimo_examen || "") ||
    form.proximo_objetivo    !== (m.proximo_objetivo    || "") ||
    clasesHanCambiado;

  const handleSave = () => {
    if (!hasChanges) return;

    // Validar tutor si el miembro en edición es menor
    if (esEdicionMenor) {
      const { valido, errores } = validarTutor(form);
      if (!valido) {
        setTutorErrores(errores);
        return;
      }
    }
    setTutorErrores({});

    // Si pasó a ser mayor de edad, limpiar datos de tutor
    const tutorData = esEdicionMenor
      ? {
          tutor_nombre:     form.tutor_nombre     || null,
          tutor_telefono:   form.tutor_telefono   || null,
          tutor_parentesco: form.tutor_parentesco || null,
        }
      : { tutor_nombre: null, tutor_telefono: null, tutor_parentesco: null };

    onSave({
      ...m,
      nombre:              form.nombre,
      tel:                 form.tel,
      fecha_incorporacion: form.fecha_incorporacion,
      sexo:                form.sexo,
      fecha_nacimiento:    form.fecha_nacimiento,
      notas:               form.notas,
      beca:                form.beca,
      // ── DOJO ──
      grado_actual:        form.grado_actual,
      fecha_ultimo_examen: form.fecha_ultimo_examen,
      proximo_objetivo:    form.proximo_objetivo,
      ...tutorData,
    });
    // Guardar clases si cambiaron
    if (clasesHanCambiado) {
      // Calcular si hay clases nuevas con costo
      const clasesSoloNuevas = clasesEdit.filter(id => !clasesDelMiembro.includes(String(id)));
      const getPrecioClase = (c) => {
        const planVinc = (planesMembresia||[]).find(p =>
          (p.clases_vinculadas||[]).map(String).includes(String(c.id)) ||
          p.clase_nombre === c.nombre || p.nombre === c.nombre
        );
        return Number(planVinc?.precio_publico ?? c?.precio_membresia ?? c?.costo ?? 0);
      };
      const hayCargoNuevo = !m.beca && clasesSoloNuevas.some(id => {
        const c = (clases||[]).find(x => String(x.id) === String(id));
        return c && getPrecioClase(c) > 0;
      });
      if (hayCargoNuevo) {
        // Abrir modal de forma de pago antes de guardar
        setClasesPagoFormaPago("Efectivo");
        setClasesPagoModal(true);
        return; // No cerrar edición todavía — lo cierra el modal de pago
      }
      guardarClasesMiembro(clasesEdit, clasesDelMiembro, "Efectivo");
    }
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
    if (!renovar.inicio || renovarSaving) return;
    setRenovarSaving(true);
    try {
      const montoPagado = m.beca ? 0 : (Number(renovar.monto) || 0);
      const fechaISO = renovar.inicio;
      const venceISO = renovar.vence;
      const becaTag = m.beca ? " [BECA]" : "";
      const cambioTag = (planCambiado && planOriginal && planOriginal !== renovar.plan)
        ? ` [cambio desde: ${planOriginal}]` : "";
      const fp = renovar.formaPago || "Efectivo";
      const esPendienteTransf = fp === "Transferencia";
      const descText = `Renovación ${renovar.plan} - ${m.nombre} [${fp}]${becaTag}${cambioTag}${venceISO ? ` (vence:${venceISO})` : ""}`;
      await onAddPago({
        id: uid(), tipo: "ingreso", categoria: "Membresías",
        desc: descText, descripcion: descText,
        monto: montoPagado, fecha: fechaISO,
        miembroId: m.id, vence_manual: venceISO || null,
      });

      // Registrar planesExtra (clases adicionales) como transacciones separadas
      const extrasNoVacios = (renovar.planesExtra || []).filter(pe => pe.nombre);
      for (const pe of extrasNoVacios) {
        const montoExtra = m.beca ? 0 : (Number(pe.monto) || 0);
        const descExtra = `Renovación ${pe.nombre} - ${m.nombre} [${fp}]${becaTag}${venceISO ? ` (vence:${venceISO})` : ""}`;
        await onAddPago({
          id: uid(), tipo: "ingreso", categoria: "Membresías",
          desc: descExtra, descripcion: descExtra,
          monto: montoExtra, fecha: fechaISO,
          miembroId: m.id, vence_manual: null,
        });
      }

      // Si es transferencia pendiente, marcar al miembro como pendiente
      if (esPendienteTransf) {
        try {
          const planForToken = renovar.plan || "Membresía";
          const updated = { ...m, pago_pendiente: true, plan_pendiente: planForToken, monto_pendiente: String(montoPagado), vence_pendiente: venceISO };
          await onSave(updated);
          if (onMemberUpdate) onMemberUpdate(updated);
        } catch(e) { console.error(e); }
      }

      // Si es beca, cerrar sin comprobante
      if (m.beca) { setRenovarModal(false); return; }

      // Generar imagen según forma de pago
      const montoTotal = montoPagado + extrasNoVacios.reduce((s, pe) => s + (m.beca ? 0 : (Number(pe.monto) || 0)), 0);
      if (fp === "Efectivo" || fp === "Tarjeta") {
        try {
          const png = await generarComprobantePNG({ gymConfig, miembro: m, plan: renovar.plan, monto: montoTotal, formaPago: fp, venceISO });
          setRenovarCompPNG(png);
        } catch(e) { console.error(e); }
      } else if (esPendienteTransf) {
        try {
          const infoPNG = await generarInfoTransferenciaPNG({ gymConfig, miembro: m, plan: renovar.plan, monto: montoTotal, venceISO });
          setRenovarInfoPNG(infoPNG);
        } catch(e) { console.error(e); }
      }
      // Avanzar al paso 3 (comprobante)
      setRenovarStep(3);
    } finally {
      setRenovarSaving(false);
    }
  };

  // ── Confirmar transferencia desde Paso 2 de renovación ──
  const handleRenovarConfirmarPago = async () => {
    if (renovarSaving) return;
    setRenovarSaving(true);
    try {
      const qrToken = m.qr_token || ("DZ-" + Math.random().toString(36).toUpperCase().slice(2,6) + Math.random().toString(36).toUpperCase().slice(2,4));
      const updated = { ...m, estado: "Activo", qr_token: qrToken };
      await onSave(updated);
      if (onMemberUpdate) onMemberUpdate(updated);
      // Generar comprobante de pago confirmado
      try {
        const montoPagado = Number(renovar.monto) || 0;
        const png = await generarComprobantePNG({ gymConfig, miembro: m, plan: renovar.plan, monto: montoPagado, formaPago: "Transferencia", venceISO: renovar.vence });
        setRenovarCompPNG(png);
        setRenovarInfoPNG(null);
      } catch(e) {}
    } finally {
      setRenovarSaving(false);
    }
  };

  // ── Confirmar pago de transferencia pendiente ──────────────────
  const isPagoPendiente = m.estado === "Pendiente";
  const [confirmandoPago, setConfirmandoPago] = useState(false);
  const [confirmarModal, setConfirmarModal] = useState(false);
  const [confirmarDatos, setConfirmarDatos] = useState({
    monto: m.monto_pendiente || "",
    plan:  m.plan_pendiente  || "",
    fecha: todayISO(),
    formaPago: "Transferencia",
  });

  const handleConfirmarPago = async () => {
    if (confirmandoPago) return;
    setConfirmandoPago(true);
    try {
      const monto    = Number(confirmarDatos.monto) || 0;
      const plan     = confirmarDatos.plan  || "Membresía";
      const fechaISO = confirmarDatos.fecha || todayISO();

      // 1. Calcular vencimiento
      const CICLO_MESES = { mensual:1, trimestral:3, semestral:6, anual:12 };
      const mesesPlan = { Mensual:1, Trimestral:3, Semestral:6, Anual:12 };
      const meses = CICLO_MESES[plan.toLowerCase()] || mesesPlan[plan] || 1;
      const [y, mo, d] = fechaISO.split("-").map(Number);
      const vD = new Date(y, mo - 1 + meses, d);
      const venceISO = `${vD.getFullYear()}-${String(vD.getMonth()+1).padStart(2,"0")}-${String(vD.getDate()).padStart(2,"0")}`;

      // 2. Generar qr_token si no tiene
      const qrToken = m.qr_token || ("DZ-" + Math.random().toString(36).toUpperCase().slice(2,6) + Math.random().toString(36).toUpperCase().slice(2,4));

      // 3. Registrar transacción de membresía
      const descTx = `Renovación ${plan} - ${m.nombre} [Transferencia] (vence:${venceISO})`;
      await onAddPago({
        id: uid(),
        tipo: "ingreso",
        categoria: "Membresías",
        desc: descTx,
        descripcion: descTx,
        monto,
        fecha: fechaISO,
        miembroId: m.id,
        vence_manual: venceISO,
      });

      // 4. Actualizar estado del miembro a Activo + guardar qr_token
      const updated = { ...m, estado: "Activo", qr_token: qrToken };
      await onSave(updated);
      if (onMemberUpdate) onMemberUpdate(updated);

      setConfirmarModal(false);
    } finally {
      setConfirmandoPago(false);
    }
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "var(--bg-main)", overflow: "hidden" }}>

      {/* ══ MODAL: Forma de Pago — Clases nuevas con costo ══ */}
      {clasesPagoModal && (() => {
        // Calcular clases nuevas con costo
        const getPrecioClase = (c) => {
          const planVinc = (planesMembresia||[]).find(p =>
            (p.clases_vinculadas||[]).map(String).includes(String(c.id)) ||
            p.clase_nombre === c.nombre || p.nombre === c.nombre
          );
          return Number(planVinc?.precio_publico ?? c?.precio_membresia ?? c?.costo ?? 0);
        };
        const clasesSoloNuevas = clasesEdit.filter(id => !clasesDelMiembro.includes(String(id)));
        const clasesConCosto = clasesSoloNuevas
          .map(id => (clases||[]).find(c => String(c.id) === String(id)))
          .filter(c => c && getPrecioClase(c) > 0);
        const montoTotal = clasesConCosto.reduce((s, c) => s + getPrecioClase(c), 0);

        const confirmarPago = async () => {
          setClasesPagoSaving(true);
          await guardarClasesMiembro(clasesEdit, clasesDelMiembro, clasesPagoFormaPago);
          setClasesPagoModal(false);
          setClasesPagoSaving(false);
          setEditing(false);
        };

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", backdropFilter:"blur(12px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
            <div style={{ background:"var(--bg-card)", borderRadius:24, padding:24, width:"100%", maxWidth:420, border:"1px solid rgba(255,255,255,.08)" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <h2 style={{ color:"var(--text-primary)", fontSize:17, fontWeight:700, margin:0 }}>💰 Cobro de Clase</h2>
                  <p style={{ color:"#8b949e", fontSize:12, marginTop:4 }}>Selecciona la forma de pago</p>
                </div>
                <button onClick={() => setClasesPagoModal(false)}
                  style={{ border:"none", background:"rgba(255,255,255,.1)", color:"#8b949e", width:34, height:34, borderRadius:10, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  ✕
                </button>
              </div>

              {/* Resumen de clases */}
              <div style={{ background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.15)", borderRadius:14, padding:"12px 16px", marginBottom:18 }}>
                <p style={{ color:"#8b949e", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Resumen de cobro</p>
                {clasesConCosto.map(c => (
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:"var(--text-secondary)", fontSize:13 }}>🏋️ {c.nombre}</span>
                    <span style={{ color:"#22d3ee", fontSize:13, fontWeight:700 }}>${getPrecioClase(c).toLocaleString("es-MX")}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(34,211,238,.15)" }}>
                  <span style={{ color:"var(--text-primary)", fontSize:14, fontWeight:700 }}>Total</span>
                  <span style={{ color:"#22d3ee", fontSize:14, fontWeight:800 }}>${montoTotal.toLocaleString("es-MX")}</span>
                </div>
              </div>

              {/* Selector forma de pago */}
              <p style={{ color:"#8b949e", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Forma de pago</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
                {[{id:"Efectivo",icon:"💵"},{id:"Transferencia",icon:"🏦"},{id:"Tarjeta",icon:"💳"}].map(op => {
                  const sel = clasesPagoFormaPago === op.id;
                  return (
                    <button key={op.id} onClick={() => setClasesPagoFormaPago(op.id)}
                      style={{ padding:"13px 6px", borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                        border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                        background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                        display:"flex", flexDirection:"column", alignItems:"center", gap:5, transition:"all .2s" }}>
                      <span style={{ fontSize:22 }}>{op.icon}</span>
                      <span style={{ color: sel?"#c4b5fd":"var(--text-primary)", fontSize:12, fontWeight:sel?700:500 }}>{op.id}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nota */}
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"rgba(108,99,255,.07)", border:"1px solid rgba(108,99,255,.2)", borderRadius:12, marginBottom:18 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>🧾</span>
                <p style={{ color:"var(--text-secondary)", fontSize:12, lineHeight:1.4 }}>
                  Se generará un <strong style={{ color:"var(--text-primary)" }}>comprobante de pago</strong> automáticamente.
                </p>
              </div>

              {/* Botones */}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setClasesPagoModal(false)}
                  style={{ flex:1, padding:"13px", border:"1px solid var(--border)", borderRadius:14, background:"transparent", color:"#8b949e", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
                <button onClick={confirmarPago} disabled={clasesPagoSaving}
                  style={{ flex:2, padding:"13px", border:"none", borderRadius:14, cursor:clasesPagoSaving?"not-allowed":"pointer", fontFamily:"inherit",
                    fontSize:14, fontWeight:700,
                    background: clasesPagoSaving ? "var(--bg-elevated)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
                    color: clasesPagoSaving ? "#8b949e" : "#fff",
                    boxShadow: clasesPagoSaving ? "none" : "0 4px 18px rgba(108,99,255,.4)",
                    transition:"all .3s" }}>
                  {clasesPagoSaving ? "⏳ Guardando..." : `✅ Confirmar $${montoTotal.toLocaleString("es-MX")}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Comprobante de Renovación ══ */}
      {comprobanteModal && comprobanteData && (() => {
        const { tipo, png, infoPNG, plan, monto, vence, formaPago } = comprobanteData;
        const tel = m.tel || "";
        const waNumero = tel.replace(/\D/g, "");
        const waFull = waNumero.startsWith("52") ? waNumero : "52" + waNumero;
        const MESES_S = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const vD = vence ? new Date(vence + "T00:00:00") : null;
        const venceFmt = vD ? `${vD.getDate()} ${MESES_S[vD.getMonth()]} ${vD.getFullYear()}` : "—";

        const waTextComp = tel ? `🧾 Hola ${m.nombre.split(" ")[0]}, aquí está tu comprobante de renovación en *${gymConfig?.nombre || "el gym"}*.\n\nPlan: ${plan} · $${Number(monto).toLocaleString("es-MX")}\nVence: ${venceFmt}\n\n¡Gracias por tu pago! 💪` : null;
        const waTextInfo = tel ? `¡Hola ${m.nombre.split(" ")[0]}! 🥋 Para completar tu renovación en *${gymConfig?.nombre || "el gym"}*, realiza tu transferencia por *$${Number(monto).toLocaleString("es-MX")}* (Plan ${plan}).\n\nVence: ${venceFmt}\n\nFavor de enviar tu comprobante por este mismo WhatsApp. ¡Gracias! 💪` : null;

        const descargar = (dataUrl, prefix) => {
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `${prefix}_${m.nombre.replace(/\s+/g,"_")}.png`;
          a.click();
        };
        const copiarImg = async (dataUrl) => {
          await copiarImagenAlPortapapeles(dataUrl);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2200);
        };

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", backdropFilter:"blur(12px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
            <div style={{ background:"var(--bg-card)", borderRadius:24, padding:24, width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto", border:"1px solid rgba(255,255,255,.08)" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <h2 style={{ color:"var(--text-primary)", fontSize:17, fontWeight:700, margin:0 }}>
                    {tipo === "transferencia" ? "📲 Info para Transferencia" : "🧾 Comprobante de Pago"}
                  </h2>
                  <p style={{ color:"#8b949e", fontSize:12, marginTop:4 }}>
                    {tipo === "transferencia"
                      ? "Comparte los datos de pago con el alumno"
                      : "Renovación registrada exitosamente"}
                  </p>
                </div>
                <button onClick={() => setComprobanteModal(false)}
                  style={{ border:"none", background:"rgba(255,255,255,.1)", color:"#8b949e", width:34, height:34, borderRadius:10, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  ✕
                </button>
              </div>

              {/* Resumen */}
              <div style={{ background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.15)", borderRadius:14, padding:"12px 16px", marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <p style={{ color:"#8b949e", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Plan</p>
                  <p style={{ color:"#22d3ee", fontSize:13, fontWeight:700, marginTop:2 }}>{plan}</p>
                </div>
                <div>
                  <p style={{ color:"#8b949e", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Monto</p>
                  <p style={{ color:"#22d3ee", fontSize:13, fontWeight:700, marginTop:2, fontFamily:"'DM Mono',monospace" }}>${Number(monto).toLocaleString("es-MX")}</p>
                </div>
                <div>
                  <p style={{ color:"#8b949e", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Vencimiento</p>
                  <p style={{ color:"#22d3ee", fontSize:13, fontWeight:700, marginTop:2 }}>{venceFmt}</p>
                </div>
                <div>
                  <p style={{ color:"#8b949e", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>Forma de pago</p>
                  <p style={{ color:"#22d3ee", fontSize:13, fontWeight:700, marginTop:2 }}>
                    {tipo === "transferencia" ? "📲 Transferencia" : formaPago === "Tarjeta" ? "💳 Tarjeta" : "💵 Efectivo"}
                  </p>
                </div>
              </div>

              {/* Imagen */}
              {(tipo === "transferencia" ? infoPNG : png) && (
                <div style={{ marginBottom:16 }}>
                  <img
                    src={tipo === "transferencia" ? infoPNG : png}
                    alt={tipo === "transferencia" ? "Info transferencia" : "Comprobante"}
                    style={{ width:"100%", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}
                  />
                </div>
              )}

              {/* Botones de acción */}
              <div style={{ display:"flex", gap:8, marginBottom:tel?12:0 }}>
                <button
                  onClick={() => descargar(tipo==="transferencia"?infoPNG:png, tipo==="transferencia"?"transferencia":"comprobante")}
                  style={{ flex:1, padding:"11px 8px", border:"1px solid rgba(255,255,255,.12)", borderRadius:12, background:"var(--bg-elevated)", color:"var(--text-primary)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  ⬇️ Descargar
                </button>
                <button
                  onClick={() => copiarImg(tipo==="transferencia"?infoPNG:png)}
                  style={{ flex:1, padding:"11px 8px", border:"1px solid rgba(255,255,255,.12)", borderRadius:12, background:"var(--bg-elevated)", color: copiado ? "#4ade80" : "var(--text-primary)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {copiado ? "✅ Copiado" : "📋 Copiar"}
                </button>
              </div>

              {/* Botón WhatsApp */}
              {tel && (tipo==="transferencia" ? waTextInfo : waTextComp) && (
                <button
                  onClick={() => window.open(`https://wa.me/${waFull}?text=${encodeURIComponent(tipo==="transferencia"?waTextInfo:waTextComp)}`, "_blank")}
                  style={{ width:"100%", padding:"13px", border:"none", borderRadius:14, background:"linear-gradient(135deg,#25d366,#128c7e)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(37,211,102,.35)", marginBottom:12 }}>
                  <span>💬</span> Enviar por WhatsApp
                </button>
              )}

              <button
                onClick={() => setComprobanteModal(false)}
                style={{ width:"100%", padding:"12px", border:"1px solid var(--border)", borderRadius:12, background:"transparent", color:"#8b949e", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Confirmar pago de transferencia ══ */}
      {confirmarModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", backdropFilter:"blur(10px)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"var(--bg-card)", borderRadius:24, padding:24, width:"100%", maxWidth:360, border:"1px solid rgba(251,191,36,.3)" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <p style={{ fontSize:40, marginBottom:8 }}>✅</p>
              <h3 style={{ color:"#fbbf24", fontSize:16, fontWeight:700 }}>Confirmar pago recibido</h3>
              <p style={{ color:"#8b949e", fontSize:12, marginTop:6, lineHeight:1.5 }}>
                Al confirmar, el alumno quedará <strong style={{ color:"#4ade80" }}>Activo</strong> y su ID Digital se activará.
              </p>
            </div>

            {/* Monto */}
            <div style={{ marginBottom:12 }}>
              <label style={{ color:"#8b949e", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, display:"block", marginBottom:5 }}>Monto recibido ($)</label>
              <input
                type="number" value={confirmarDatos.monto} inputMode="numeric"
                onChange={e => setConfirmarDatos(p => ({...p, monto: e.target.value}))}
                placeholder="0"
                style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", color:"var(--text-primary)", fontSize:15, fontFamily:"'DM Mono',monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }}
              />
            </div>

            {/* Plan */}
            <div style={{ marginBottom:12 }}>
              <label style={{ color:"#8b949e", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, display:"block", marginBottom:5 }}>Plan / Clase</label>
              <input
                type="text" value={confirmarDatos.plan}
                onChange={e => setConfirmarDatos(p => ({...p, plan: e.target.value}))}
                placeholder="Ej: Karate Adultos"
                style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
              />
            </div>

            {/* Fecha */}
            <div style={{ marginBottom:20 }}>
              <label style={{ color:"#8b949e", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, display:"block", marginBottom:5 }}>Fecha de pago</label>
              <input
                type="date" value={confirmarDatos.fecha}
                onChange={e => setConfirmarDatos(p => ({...p, fecha: e.target.value}))}
                style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
              />
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmarModal(false)}
                style={{ flex:1, padding:"13px", borderRadius:14, background:"var(--bg-elevated)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                Cancelar
              </button>
              <button onClick={handleConfirmarPago} disabled={confirmandoPago || !confirmarDatos.monto}
                style={{ flex:2, padding:"13px", borderRadius:14, border:"none",
                  background: confirmandoPago ? "rgba(74,222,128,.3)" : "linear-gradient(135deg,#22c55e,#4ade80)",
                  color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                  boxShadow:"0 4px 14px rgba(74,222,128,.35)", opacity: !confirmarDatos.monto ? 0.5 : 1 }}>
                {confirmandoPago ? "⏳ Guardando..." : "✅ Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--text-primary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.nombre}</p>
            <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{gymConfig?.termino_miembros?.replace(/s$/,"") || "Miembro"} · {isPagoPendiente ? "⏳ Pago pendiente" : memInfo.estado}</p>
          </div>
          {m.beca && <span style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.3)", borderRadius: 8, padding: "2px 10px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>🎓 BECA</span>}
          {esMenorDeEdad(m.fecha_nacimiento) && (
            <span style={{ background: "rgba(251,191,36,.12)", color: "#f59e0b", border: "1px solid rgba(251,191,36,.35)", borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              👶 {calcEdad(m.fecha_nacimiento)}a
            </span>
          )}
        </div>
      </div>
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
              alignItems: isDesktop ? "center" : "flex-end",
              justifyContent: isDesktop ? "center" : "flex-start",
              padding: isDesktop ? 24 : 0,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: isDesktop ? 520 : "100%",
                background: "var(--bg-card)",
                borderRadius: isDesktop ? 20 : "28px 28px 0 0",
                padding: "24px 24px 44px",
                animation: isDesktop ? "fadeUp .25s ease" : "slideUp .3s ease",
                maxHeight: isDesktop ? "85vh" : "90%",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ color: "var(--text-primary)", fontSize: 17, fontWeight: 700 }}>
                  💰 Cobrar a {m.nombre.split(" ")[0]}
                </h2>
                <button
                  onClick={() => setCobrarModal(false)}
                  style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#8b949e", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18 }}
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
                      background: cobro.tipo === t.val ? "rgba(74,222,128,.12)" : "var(--bg-elevated)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all .2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{t.icon}</span>
                    <span style={{ color: cobro.tipo === t.val ? "#4ade80" : "#8b949e", fontSize: 12, fontWeight: cobro.tipo === t.val ? 700 : 500 }}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>

              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Descripción <span style={{ color: "#8b949e", fontWeight: 400, fontSize: 10 }}>(opcional)</span>
              </p>
              <input
                value={cobro.desc}
                onChange={(e) => setCobro((p) => ({ ...p, desc: e.target.value }))}
                placeholder={tipoInfo?.placeholder}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Monto ($)
              </p>
              <input
                type="number"
                value={cobro.monto}
                onChange={(e) => setCobro((p) => ({ ...p, monto: e.target.value }))}
                placeholder="0.00"
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 16, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Fecha
              </p>
              <input
                type="date"
                value={cobro.fecha}
                onChange={(e) => setCobro((p) => ({ ...p, fecha: e.target.value }))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 14 }}
              />

              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
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
                      background: cobro.formaPago === op.val ? "rgba(167,139,250,.15)" : "var(--bg-elevated)",
                      transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{op.icon}</span>
                    <span style={{ color: cobro.formaPago === op.val ? "#a78bfa" : "#8b949e", fontSize: 10, fontWeight: 700 }}>
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
                  background: cobro.monto ? "linear-gradient(135deg,#4ade80,#22c55e)" : "var(--bg-elevated)",
                  color: cobro.monto ? "#000" : "#8b949e",
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

      {/* ── Renovar modal — Wizard 2 pasos ── */}
      {renovarModal && (() => {
        const esPrimeraMembresía = !txs.some(
          (t) => t.categoria === "Membresías" &&
            (String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id))
        );
        const fp = renovar.formaPago || "Efectivo";
        const esPendienteTransf = fp === "Transferencia";
        const montoPagado = m.beca ? 0 : (Number(renovar.monto) || 0);
        const MESES_S = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const vD = renovar.vence ? new Date(renovar.vence + "T00:00:00") : null;
        const venceFmt = vD ? `${vD.getDate()} ${MESES_S[vD.getMonth()]} ${vD.getFullYear()}` : "—";
        const tel = m.tel || m.tutor_telefono || "";
        const waNum = tel.replace(/\D/g,"");
        const waFull = waNum.startsWith("52") ? waNum : "52" + waNum;
        // ── Último pago del miembro ──
        const ultimaMemTx = txs
          .filter(t => t.categoria === "Membresías" && (String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)))
          .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
        const ultimoPagoFmt = ultimaMemTx ? fmtDate(ultimaMemTx.fecha) : null;

        // ── Calcular recargo por mora (usa formCfg que tiene el mapeo correcto desde polGlobal) ──
        const diasGracia    = Number(formCfg?.dias_gracia ?? gymConfig?.dias_gracia ?? 5);
        const tipoPenalidad = formCfg?.mora_tipo || gymConfig?.mora_tipo || "ninguna";
        const penalidad     = Number(formCfg?.mora_monto || gymConfig?.mora_monto || 0);
        const diasVencido = memInfo.vence ? (() => {
          const hoy = new Date();
          const venceDate = parseDate(memInfo.vence);
          if (!venceDate) return 0;
          const diff = Math.floor((hoy - venceDate) / 86400000);
          return diff > 0 ? diff : 0;
        })() : 0;
        const aplicaRecargo = !esPrimeraMembresía && !m.beca && diasVencido > diasGracia && tipoPenalidad !== "ninguna" && penalidad > 0;
        const montoRecargo = aplicaRecargo
          ? (tipoPenalidad === "porcentaje" ? Math.round((Number(renovar.monto) || 0) * penalidad / 100) : penalidad)
          : 0;

        // ── Clases disponibles para agregar ──
        const MESES_MAP_R = { mensual:1, trimestral:3, semestral:6, anual:12 };
        const clasesGym = (clases || []).filter(c => c.activo !== false);
        const clasesDisponibles = clasesGym.length > 0 ? clasesGym : [];
        const isExtraSelected = (claseId) => (renovar.planesExtra||[]).some(p => p.id === String(claseId));
        const toggleClaseRenovar = (clase) => {
          const id = String(clase.id);
          const planVinc = (planesMembresia||[]).find(p => (p.clases_vinculadas||[]).map(String).includes(id));
          const precio = Number(planVinc?.precio_publico ?? clase?.precio_membresia ?? 0);
          const ciclo  = planVinc?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";
          const meses  = planVinc?.meses ?? MESES_MAP_R[ciclo] ?? 1;
          setRenovar(prev => {
            const ya = (prev.planesExtra||[]).some(p => p.id === id);
            const extras = ya
              ? (prev.planesExtra||[]).filter(p => p.id !== id)
              : [...(prev.planesExtra||[]), { id, nombre: clase.nombre, monto: m.beca ? 0 : precio, planData: { id, nombre: clase.nombre, precio_publico: precio, ciclo_renovacion: ciclo, meses } }];
            return { ...prev, planesExtra: extras };
          });
        };

        const montoExtraTotal = (renovar.planesExtra||[]).reduce((s, pe) => s + (m.beca ? 0 : Number(pe.monto||0)), 0);
        const montoTotalRenovacion = montoPagado + montoExtraTotal + montoRecargo;

        const waMsgBanco = esPendienteTransf && gymConfig
          ? "PARA TRANSFERENCIAS:\n" +
            "CLABE: " + (gymConfig.transferencia_clabe || "—") + "\n" +
            "Beneficiario: " + (gymConfig.transferencia_titular || "—") + "\n" +
            (gymConfig.transferencia_banco ? "Banco: " + gymConfig.transferencia_banco + "\n" : "") +
            "\nALUMNO: " + (m.nombre||"").toUpperCase() + "\n" +
            "Plan: " + renovar.plan + "\n" +
            "Monto: $" + montoTotalRenovacion.toLocaleString("es-MX") + "\n" +
            "Vence: " + venceFmt + "\n\n" +
            "Favor de enviar comprobante de transferencia a este número."
          : null;

        const waMsgComp = tel
          ? "🧾 Hola " + m.nombre.split(" ")[0] + ", aquí está tu comprobante de renovación en *" + (gymConfig?.nombre || "el gym") + "*.\n\nPlan: " + renovar.plan + " · $" + montoTotalRenovacion.toLocaleString("es-MX") + "\nVence: " + venceFmt + "\n\n¡Gracias por tu pago! 💪"
          : null;

        const descargarImg = (dataUrl, prefix) => {
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = prefix + "_" + m.nombre.replace(/\s+/g,"_") + ".png";
          a.click();
        };
        const copiarImg = async (dataUrl) => {
          await copiarImagenAlPortapapeles(dataUrl);
          setRenovarCopiado(true);
          setTimeout(() => setRenovarCopiado(false), 2200);
        };
        const abrirWA = (msg) => {
          if (!tel || !msg) return;
          window.open("https://wa.me/" + waFull + "?text=" + encodeURIComponent(msg), "_blank");
        };
        const cerrarWizard = () => {
          setRenovarModal(false);
          setRenovarStep(1);
          setRenovarCompPNG(null);
          setRenovarInfoPNG(null);
          setRenovar(prev => ({ ...prev, planesExtra: [] }));
        };

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", backdropFilter:"blur(10px)", zIndex:200,
            display:"flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: isDesktop ? "center" : "flex-start",
            padding: isDesktop ? 24 : 0 }}>
            <div style={{ width:"100%", maxWidth: isDesktop ? 520 : "100%", background:"var(--bg-card)",
              borderRadius: isDesktop ? 20 : "28px 28px 0 0",
              maxHeight: isDesktop ? "90vh" : "93dvh", display:"flex", flexDirection:"column",
              animation: isDesktop ? "fadeUp .25s ease" : "slideUp .3s ease" }}>

              {/* ── Header fijo ── */}
              <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:18 }}>👤</span>
                    <h2 style={{ color:"var(--text-primary)", fontSize:17, fontWeight:800, margin:0 }}>
                      {esPrimeraMembresía ? "Registrar Membresía" : "Renovar Membresía"}
                    </h2>
                  </div>
                  <button onClick={cerrarWizard}
                    style={{ border:"none", background:"rgba(255,255,255,.1)", color:"#8b949e", width:34, height:34, borderRadius:10, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    ✕
                  </button>
                </div>
                {/* Stepper 3 pasos — estilo NuevoMiembro */}
                {(() => {
                  const STEPS = ["Membresía", "Pago", "Comprobante"];
                  return (
                    <div style={{ paddingBottom: 4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                        {STEPS.map((label, i) => {
                          const idx = i + 1;
                          const done = renovarStep > idx;
                          const active = renovarStep === idx;
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}>
                              <div style={{ display:"flex", flexDirection:"column", alignItems: i===0?"flex-start":i===STEPS.length-1?"flex-end":"center", flexShrink:0 }}>
                                <div style={{
                                  width:28, height:28, borderRadius:"50%",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  fontWeight:700, fontSize:12,
                                  background: done ? "#4ade80" : active ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
                                  color: done || active ? "#fff" : "#6b6b8a",
                                  border: active ? "none" : done ? "none" : "1.5px solid rgba(255,255,255,.15)",
                                  boxShadow: active ? "0 0 0 3px rgba(108,99,255,.25)" : "none",
                                  transition:"all .3s",
                                }}>
                                  {done ? "✓" : idx}
                                </div>
                                <p style={{
                                  fontSize:10, fontWeight: renovarStep === idx ? 700 : 400,
                                  color: renovarStep === idx ? "var(--text-primary)" : "#6b6b8a",
                                  margin:"4px 0 0", transition:"color .3s", whiteSpace:"nowrap",
                                }}>{label}</p>
                              </div>
                              {i < STEPS.length - 1 && (
                                <div style={{
                                  flex:1, height:2,
                                  background: done ? "#4ade80" : "rgba(255,255,255,.1)",
                                  margin:"0 6px", marginBottom:18, transition:"background .3s",
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Body scrollable ── */}
              <div style={{ flex:1, overflowY:"auto", padding:"18px 24px" }}>

                {/* ═══ PASO 1: Membresía ═══ */}
                {renovarStep === 1 && (
                  <>
                    {/* ── Selector unificado: Gym + Clases (igual que Nuevo Miembro) ── */}
                    {(() => {
                      const gymPlanes = (activePlanes || []).filter(p => p.activo !== false);
                      const clasesGym = (clasesDisponibles || []).filter(c => c.activo !== false);
                      const CICLO_LBL = { mensual:"mes", trimestral:"trimestre", semestral:"semestre", anual:"año" };
                      const MESES_MAP_G = { mensual:1, trimestral:3, semestral:6, anual:12 };
                      const DIAS_S = { lun:"L", mar:"M", mie:"X", jue:"J", vie:"V", sab:"S", dom:"D", lunes:"L", martes:"M", miercoles:"X", miércoles:"X", jueves:"J", viernes:"V", sabado:"S", sábado:"S", domingo:"D" };

                      return (
                        <div style={{ marginBottom:14 }}>
                          {/* ── Membresía del Gimnasio ── */}
                          {gymPlanes.length > 0 && (
                            <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>
                              🏋️ Membresía del Gimnasio
                            </p>
                          )}

                          {/* Planes del gym */}
                          {gymPlanes.map(plan => {
                            const isSel = renovar.plan === plan.nombre;
                            const precio = Number(plan.precio||0);
                            const ciclo = plan.ciclo_renovacion || "mensual";
                            const meses = plan.meses ?? MESES_MAP_G[ciclo] ?? 1;
                            return (
                              <button key={plan.nombre}
                                onClick={() => {
                                  setRenovar(p => ({ ...p, plan:plan.nombre, monto: m.beca?"0":String(precio), vence: p.venceManual?p.vence:calcVence(p.inicio,plan.nombre) }));
                                }}
                                style={{ width:"100%", padding:"12px 16px", marginBottom:8,
                                  border: isSel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                                  borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                                  background: isSel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                                  display:"flex", alignItems:"center", gap:12, transition:"all .2s", textAlign:"left" }}>
                                <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                                  background: isSel ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.05)",
                                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                                  {meses>=12?"🏆":meses>=6?"🔥":meses>=3?"⚡":"📅"}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ color: isSel?"#a78bfa":"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:13 }}>{plan.nombre}</p>
                                  <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:1 }}>Vigencia: {meses} {meses===1?"mes":"meses"}</p>
                                </div>
                                <div style={{ textAlign:"right", flexShrink:0 }}>
                                  {precio > 0 ? (
                                    <>
                                      <p style={{ background: isSel?"rgba(108,99,255,.2)":"rgba(255,255,255,.07)", color: isSel?"#a78bfa":"var(--text-secondary,#9999b3)", borderRadius:10, padding:"3px 10px", fontSize:13, fontWeight:700 }}>
                                        {m.beca&&isSel ? <span style={{ color:"#4ade80" }}>$0</span> : `$${precio.toLocaleString("es-MX")}`}
                                      </p>
                                      {!m.beca && <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:10, marginTop:2 }}>/ {CICLO_LBL[ciclo]||ciclo}</p>}
                                    </>
                                  ) : (
                                    <p style={{ background:"rgba(74,222,128,.1)", color:"#4ade80", borderRadius:10, padding:"3px 10px", fontSize:12, fontWeight:700 }}>Gratuito</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {/* ── Clases (selección múltiple) ── */}
                          {clasesGym.length > 0 && (
                            <>
                              <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0 8px" }}>
                                <div style={{ flex:1, height:1, background:"rgba(255,255,255,.07)" }} />
                                <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, flexShrink:0 }}>
                                  🗓️ Clases (selección múltiple)
                                </p>
                                <div style={{ flex:1, height:1, background:"rgba(255,255,255,.07)" }} />
                              </div>
                              {clasesGym.map(clase => {
                                const planVinc = (planesMembresia||[]).find(p =>
                                  (p.clases_vinculadas||[]).map(String).includes(String(clase.id)) ||
                                  p.clase_nombre === clase.nombre || p.nombre === clase.nombre
                                );
                                const precio = Number(planVinc?.precio_publico ?? clase?.precio_membresia ?? 0);
                                const ciclo  = planVinc?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";
                                const horClase = (horarios||[]).filter(h => h.clase_id === clase.id && h.activo !== false);
                                const diasStr = horClase.length > 0
                                  ? [...new Set(horClase.flatMap(h => h.dias_semana||[]))].map(d=>DIAS_S[d?.toLowerCase()]||d).join(" ")
                                  : null;
                                const horaStr = horClase.length > 0 && horClase[0].hora_inicio
                                  ? (() => { const t = horClase[0].hora_inicio.split(":"); const hr=parseInt(t[0]||0); return `${hr%12||12}:${t[1]||"00"} ${hr>=12?"p.m.":"a.m."}`; })()
                                  : null;
                                const isSel = isExtraSelected(clase.id);
                                return (
                                  <button key={clase.id} onClick={() => toggleClaseRenovar(clase)}
                                    style={{ width:"100%", padding:"12px 16px", marginBottom:8,
                                      border: isSel ? "2px solid #22d3ee" : "1.5px solid rgba(255,255,255,.08)",
                                      borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                                      background: isSel ? "rgba(34,211,238,.1)" : "var(--bg-elevated)",
                                      display:"flex", alignItems:"center", gap:12, transition:"all .2s", textAlign:"left" }}>
                                    <div style={{ width:22, height:22, borderRadius:7, flexShrink:0,
                                      border: isSel ? "none" : "2px solid rgba(255,255,255,.2)",
                                      background: isSel ? "#22d3ee" : "transparent",
                                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#1a1a2e" }}>
                                      {isSel && "✓"}
                                    </div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <p style={{ color: isSel?"#22d3ee":"var(--text-primary)", fontWeight:700, fontSize:13 }}>{clase.nombre}</p>
                                      {(diasStr||horaStr) && (
                                        <p style={{ color:"#8b949e", fontSize:11, marginTop:1 }}>
                                          {horaStr && `🕐 ${horaStr}`}{diasStr && `  ${diasStr}`}
                                        </p>
                                      )}
                                    </div>
                                    <div style={{ textAlign:"right", flexShrink:0 }}>
                                      <p style={{ background: isSel?"rgba(34,211,238,.2)":"rgba(255,255,255,.07)", color: isSel?"#22d3ee":"#8b949e", borderRadius:8, padding:"3px 10px", fontSize:13, fontWeight:700 }}>
                                        {m.beca ? <span style={{ color:"#4ade80" }}>$0</span> : `$${precio.toLocaleString("es-MX")}`}
                                      </p>
                                      {!m.beca && <p style={{ color:"#8b949e", fontSize:10, marginTop:2 }}>/ {CICLO_LBL[ciclo]||ciclo}</p>}
                                    </div>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })()}

                  </>
                )}

                {/* ═══ PASO 2: Pago ═══ */}
                {renovarStep === 2 && (
                  <>
                    {/* Resumen — igual que NuevoMiembro */}
                    <div style={{ background:"rgba(108,99,255,.08)", border:"1px solid rgba(108,99,255,.2)", borderRadius:14, padding:"12px 16px", marginBottom:16 }}>
                      <p style={{ color:"#a78bfa", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Resumen</p>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Alumno</span>
                        <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>{m.nombre}</span>
                      </div>
                      {renovar.plan && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>🏋️ {renovar.plan}</span>
                          <span style={{ color:"#a78bfa", fontSize:11, fontWeight:600 }}>${montoPagado.toLocaleString("es-MX")}</span>
                        </div>
                      )}
                      {(renovar.planesExtra||[]).map(pe => (
                        <div key={pe.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>🗓️ {pe.nombre}</span>
                          <span style={{ color:"#22d3ee", fontSize:11, fontWeight:600 }}>${(m.beca?0:Number(pe.monto||0)).toLocaleString("es-MX")}</span>
                        </div>
                      ))}
                      {aplicaRecargo && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ color:"#f87171", fontSize:11 }}>⚠️ Recargo mora</span>
                          <span style={{ color:"#f87171", fontSize:11, fontWeight:600 }}>${montoRecargo.toLocaleString("es-MX")}</span>
                        </div>
                      )}
                      <div style={{ borderTop:"1px solid rgba(255,255,255,.08)", marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Total</span>
                        <span style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>${montoTotalRenovacion.toLocaleString("es-MX")}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                        <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Vence</span>
                        <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>{venceFmt}</span>
                      </div>
                    </div>

                    {/* ── Último pago + política de mora ── */}
                    {!esPrimeraMembresía && (
                      <div style={{ background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border-strong,#2e2e42)", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                        {/* Último pago */}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: diasVencido > 0 ? 10 : 0 }}>
                          <span style={{ color:"#8b949e", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                            📅 Último pago
                          </span>
                          <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>
                            {ultimoPagoFmt || "—"}
                          </span>
                        </div>

                        {/* Días de atraso */}
                        {diasVencido > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: tipoPenalidad !== "ninguna" ? 10 : 0 }}>
                            <span style={{ color: diasVencido > diasGracia ? "#f87171" : "#f59e0b", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                              ⏰ Días vencido
                            </span>
                            <span style={{ color: diasVencido > diasGracia ? "#f87171" : "#f59e0b", fontSize:12, fontWeight:700 }}>
                              {diasVencido} días
                            </span>
                          </div>
                        )}

                        {/* Política de mora desde Configuración */}
                        {tipoPenalidad !== "ninguna" && penalidad > 0 && (
                          <div style={{ borderTop:"1px solid rgba(255,255,255,.06)", paddingTop:10 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <span style={{ color:"#8b949e", fontSize:11 }}>Días de gracia</span>
                              <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>{diasGracia} días</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <span style={{ color:"#8b949e", fontSize:11 }}>Penalidad por mora</span>
                              <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>
                                {tipoPenalidad === "porcentaje" ? `${penalidad}%` : `$${penalidad.toLocaleString("es-MX")}`}
                              </span>
                            </div>
                            {aplicaRecargo ? (
                              <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, padding:"8px 12px", marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <span style={{ color:"#f87171", fontSize:12, fontWeight:700 }}>⚠️ Recargo aplicado</span>
                                <span style={{ color:"#f87171", fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace" }}>
                                  +${montoRecargo.toLocaleString("es-MX")}
                                </span>
                              </div>
                            ) : diasVencido > 0 ? (
                              <div style={{ background:"rgba(74,222,128,.08)", border:"1px solid rgba(74,222,128,.2)", borderRadius:10, padding:"8px 12px", marginTop:6 }}>
                                <p style={{ color:"#4ade80", fontSize:11 }}>
                                  ✓ Dentro del período de gracia ({diasGracia - diasVencido} días restantes)
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Montos editables */}
                    {!m.beca && renovar.plan && (
                      <div style={{ marginBottom:10, padding:"12px 14px", background:"rgba(167,139,250,.07)", border:"1px solid rgba(167,139,250,.2)", borderRadius:14 }}>
                        <label style={{ color:"#a78bfa", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:6, display:"block" }}>
                          💰 Monto membresía gym (editable)
                        </label>
                        <input type="number" value={renovar.monto||""} min="0"
                          onChange={e => setRenovar(p => ({ ...p, monto:e.target.value }))}
                          placeholder="0" inputMode="numeric"
                          style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"10px 14px", color:"var(--text-primary)", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
                      </div>
                    )}
                    {!m.beca && (renovar.planesExtra||[]).length > 0 && (
                      <div style={{ marginBottom:10, padding:"12px 14px", background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.25)", borderRadius:14 }}>
                        <label style={{ color:"#22d3ee", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8, display:"block" }}>
                          🗓️ Monto clases (editable)
                        </label>
                        {(renovar.planesExtra||[]).map(pe => (
                          <div key={pe.id} style={{ marginBottom:8 }}>
                            <p style={{ color:"#8b949e", fontSize:11, marginBottom:4 }}>{pe.nombre}</p>
                            <input type="number" value={pe.monto||""} min="0"
                              onChange={e => setRenovar(prev => ({ ...prev, planesExtra:(prev.planesExtra||[]).map(x => x.id===pe.id?{...x,monto:e.target.value}:x) }))}
                              placeholder="0" inputMode="numeric"
                              style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"10px 14px", color:"var(--text-primary)", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fechas */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                      <div>
                        <p style={{ color:"#8b949e", fontSize:11, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:.5 }}>Inicio</p>
                        <input type="date" value={renovar.inicio}
                          onChange={e => { const v=e.target.value; setRenovar(p=>({...p,inicio:v,vence:p.venceManual?p.vence:calcVence(v,p.plan)})); }}
                          style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 10px", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                      </div>
                      <div>
                        <p style={{ color:"#8b949e", fontSize:11, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:.5 }}>Vencimiento</p>
                        <input type="date" value={renovar.vence} min={renovar.inicio}
                          onChange={e => { const v=e.target.value; if(v<renovar.inicio)return; setRenovar(p=>({...p,vence:v,venceManual:true})); }}
                          style={{ width:"100%", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 10px", color:"var(--text-primary)", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                      </div>
                    </div>

                    {/* Duración */}
                    <div style={{ background:"rgba(34,211,238,.08)", border:"1px solid rgba(34,211,238,.2)", borderRadius:14, padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <span style={{ color:"#8b949e", fontSize:12 }}>Duración</span>
                      <span style={{ color:"#22d3ee", fontSize:13, fontWeight:700 }}>
                        {(() => {
                          if (!renovar.inicio || !renovar.vence) return "—";
                          const diff = Math.round((new Date(renovar.vence+"T00:00:00") - new Date(renovar.inicio+"T00:00:00")) / 86400000);
                          return diff > 0 ? `${diff} días` : "Fecha inválida";
                        })()}
                      </span>
                    </div>

                    {/* Forma de pago — grid 3 columnas igual que NuevoMiembro */}
                    <p style={{ color:"#8b949e", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Forma de pago</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                      {[{id:"Efectivo",icon:"💵"},{id:"Transferencia",icon:"🏦"},{id:"Tarjeta",icon:"💳"}].map(op => {
                        const sel = renovar.formaPago === op.id;
                        return (
                          <button key={op.id} onClick={() => setRenovar(p => ({...p, formaPago:op.id}))}
                            style={{ padding:"13px 6px", borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                              border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                              background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                              display:"flex", flexDirection:"column", alignItems:"center", gap:5, transition:"all .2s" }}>
                            <span style={{ fontSize:22 }}>{op.icon}</span>
                            <span style={{ color: sel?"#c4b5fd":"var(--text-primary,#e8e8f0)", fontSize:12, fontWeight:sel?700:500 }}>{op.id}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Efectivo / Tarjeta → nota */}
                    {!esPendienteTransf && renovar.formaPago && (
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"rgba(108,99,255,.07)", border:"1px solid rgba(108,99,255,.2)", borderRadius:12 }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>🧾</span>
                        <p style={{ color:"var(--text-secondary,#9999b3)", fontSize:12, lineHeight:1.4 }}>
                          El <strong style={{ color:"var(--text-primary,#e8e8f0)" }}>comprobante de pago</strong> se generará automáticamente en el siguiente paso.
                        </p>
                      </div>
                    )}

                    {/* Transferencia → banner + info bancaria */}
                    {esPendienteTransf && (
                      <>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:"rgba(251,191,36,.08)", border:"1px solid rgba(251,191,36,.28)", borderRadius:12, marginBottom:12 }}>
                          <span style={{ fontSize:18, flexShrink:0 }}>⏳</span>
                          <div>
                            <p style={{ color:"#fbbf24", fontWeight:700, fontSize:13 }}>Pago por confirmar</p>
                            <p style={{ color:"rgba(251,191,36,.8)", fontSize:11, marginTop:3, lineHeight:1.4 }}>
                              El alumno se registrará como <strong>Pendiente</strong> hasta que confirmes el pago desde su perfil.
                            </p>
                          </div>
                        </div>

                        {/* Info para transferencia */}
                        <div style={{ background:"var(--bg-elevated,#1e1e2e)", border:`1.5px solid ${renovarInfoPNG?"#0ea5e955":"var(--border-strong,#2e2e42)"}`, borderRadius:16, padding:14, marginBottom:12 }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:36, height:36, borderRadius:10, background:"rgba(14,165,233,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏦</div>
                              <p style={{ color:"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:13 }}>Info para Transferencia</p>
                            </div>
                            <button onClick={async () => {
                                setRenovarSaving(true);
                                try {
                                  const png = await generarInfoTransferenciaPNG({ gymConfig, miembro:m, plan:renovar.plan, monto:montoTotalRenovacion, planesExtra:renovar.planesExtra||[], venceISO:renovar.vence });
                                  setRenovarInfoPNG(png);
                                } catch(e) { alert("No se pudo generar."); }
                                finally { setRenovarSaving(false); }
                              }}
                              disabled={renovarSaving}
                              style={{ padding:"8px 14px", borderRadius:10, border:"none", background: renovarSaving?"rgba(14,165,233,.3)":"#0ea5e9", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}>
                              {renovarSaving ? "⏳ Generando..." : renovarInfoPNG ? "✨ Regenerar" : "✨ Generar"}
                            </button>
                          </div>
                          {renovarInfoPNG && (
                            <>
                              <img src={renovarInfoPNG} alt="Info transferencia" style={{ width:"100%", borderRadius:10, border:"1px solid var(--border,#2a2a3e)", marginTop:12, boxShadow:"0 2px 12px rgba(0,0,0,.3)" }} />
                              <div style={{ display:"flex", gap:7, marginTop:9 }}>
                                <button onClick={() => { const a=document.createElement("a"); a.href=renovarInfoPNG; a.download=`transferencia-${m.nombre.replace(/\s+/g,"-").toLowerCase()}.png`; a.click(); }}
                                  style={{ flex:1, padding:"10px 8px", borderRadius:12, fontFamily:"inherit", background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border-strong,#2e2e42)", color:"var(--text-secondary,#9999b3)", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                                  📥 Descargar
                                </button>
                                <button onClick={() => copiarImg(renovarInfoPNG)}
                                  style={{ flex:1, padding:"10px 8px", borderRadius:12, fontFamily:"inherit", background:renovarCopiado?"rgba(74,222,128,.12)":"var(--bg-elevated,#1e1e2e)", border:`1px solid ${renovarCopiado?"rgba(74,222,128,.4)":"var(--border-strong,#2e2e42)"}`, color:renovarCopiado?"#4ade80":"var(--text-secondary,#9999b3)", fontWeight:600, fontSize:12, cursor:"pointer", transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                                  {renovarCopiado ? "✓ Copiado" : "📋 Copiar"}
                                </button>
                                {tel && waMsgBanco && (
                                  <button onClick={() => abrirWA(waMsgBanco)}
                                    style={{ flex:1, padding:"10px 8px", borderRadius:12, fontFamily:"inherit", background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.3)", color:"#25d366", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                                    📲 WhatsApp
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Datos bancarios rápidos */}
                        {(gymConfig?.transferencia_clabe || gymConfig?.transferencia_titular) && (
                          <div style={{ background:"rgba(14,165,233,.06)", border:"1px solid rgba(14,165,233,.2)", borderRadius:12, padding:"12px 14px" }}>
                            <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, marginBottom:8 }}>📋 Datos bancarios rápidos</p>
                            {[["CLABE", gymConfig.transferencia_clabe||"—"], ["Titular", gymConfig.transferencia_titular||"—"], ["Banco", gymConfig.transferencia_banco||""]].filter(([,v])=>v).map(([l,v]) => (
                              <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                                <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>{l}</span>
                                <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ═══ PASO 3: Comprobante ═══ */}
                {renovarStep === 3 && (
                  <>
                    {/* Resumen */}
                    <div style={{ background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.15)", borderRadius:14, padding:"12px 16px", marginBottom:16 }}>
                      <p style={{ color:"#8b949e", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Resumen</p>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#8b949e", fontSize:11 }}>Alumno</span>
                        <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>{m.nombre}</span>
                      </div>
                      {renovar.plan && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ color:"#8b949e", fontSize:11 }}>🏋️ {renovar.plan}</span>
                          <span style={{ color:"#a78bfa", fontSize:12, fontWeight:700 }}>${montoPagado.toLocaleString("es-MX")}</span>
                        </div>
                      )}
                      {(renovar.planesExtra||[]).map(pe => (
                        <div key={pe.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ color:"#8b949e", fontSize:11 }}>🗓️ {pe.nombre}</span>
                          <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>${Number(pe.monto||0).toLocaleString("es-MX")}</span>
                        </div>
                      ))}
                      {aplicaRecargo && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ color:"#f87171", fontSize:11 }}>⚠️ Recargo mora</span>
                          <span style={{ color:"#f87171", fontSize:12, fontWeight:700 }}>${montoRecargo.toLocaleString("es-MX")}</span>
                        </div>
                      )}
                      {montoTotalRenovacion !== montoPagado && (
                        <div style={{ borderTop:"1px solid rgba(255,255,255,.08)", marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
                          <span style={{ color:"#8b949e", fontSize:11 }}>Total</span>
                          <span style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>${montoTotalRenovacion.toLocaleString("es-MX")}</span>
                        </div>
                      )}
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                        <span style={{ color:"#8b949e", fontSize:11 }}>Vence</span>
                        <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>{venceFmt}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                        <span style={{ color:"#8b949e", fontSize:11 }}>Forma pago</span>
                        <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>{fp === "Transferencia" ? "📲 Transferencia" : fp === "Tarjeta" ? "💳 Tarjeta" : "💵 Efectivo"}</span>
                      </div>
                    </div>

                    {/* Imagen */}
                    {(renovarCompPNG || renovarInfoPNG) && (
                      <div style={{ marginBottom:12 }}>
                        <img src={renovarInfoPNG || renovarCompPNG} alt="Comprobante"
                          style={{ width:"100%", borderRadius:10, border:"1px solid rgba(255,255,255,.08)", boxShadow:"0 2px 12px rgba(0,0,0,.4)" }} />
                      </div>
                    )}

                    {/* Botones Descargar / Copiar / WhatsApp */}
                    <div style={{ display:"flex", gap:7, marginBottom:12 }}>
                      <button onClick={() => descargarImg(renovarInfoPNG || renovarCompPNG, renovarInfoPNG ? "transferencia" : "comprobante")}
                        style={{ flex:1, padding:"11px 8px", border:"1px solid rgba(255,255,255,.12)", borderRadius:12, background:"var(--bg-elevated)", color:"var(--text-primary)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        📥 Descargar
                      </button>
                      <button onClick={() => copiarImg(renovarInfoPNG || renovarCompPNG)}
                        style={{ flex:1, padding:"11px 8px", border:`1px solid ${renovarCopiado?"rgba(74,222,128,.4)":"rgba(255,255,255,.12)"}`, borderRadius:12, background:renovarCopiado?"rgba(74,222,128,.12)":"var(--bg-elevated)", color:renovarCopiado?"#4ade80":"var(--text-primary)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all .2s" }}>
                        {renovarCopiado ? "✅ Copiado" : "📋 Copiar"}
                      </button>
                      {tel && (
                        <button onClick={() => abrirWA(renovarInfoPNG ? waMsgBanco : waMsgComp)}
                          style={{ flex:1, padding:"11px 8px", border:"1px solid rgba(37,211,102,.3)", borderRadius:12, background:"rgba(37,211,102,.12)", color:"#25d366", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                          📲 WhatsApp
                        </button>
                      )}
                    </div>

                    {/* Confirmar pago si es transferencia pendiente */}
                    {esPendienteTransf && renovarInfoPNG && !renovarCompPNG && (
                      <button onClick={handleRenovarConfirmarPago} disabled={renovarSaving}
                        style={{ width:"100%", padding:"13px", border:"none", borderRadius:14, marginBottom:8,
                          background: renovarSaving ? "rgba(16,185,129,.4)" : "linear-gradient(135deg,#10b981,#059669)",
                          color:"#fff", fontWeight:700, fontSize:13, cursor: renovarSaving ? "not-allowed" : "pointer",
                          fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                          boxShadow:"0 4px 14px rgba(16,185,129,.3)", opacity: renovarSaving ? .6 : 1 }}>
                        {renovarSaving ? "⏳ Guardando..." : "✅ Confirmar pago recibido — activar miembro"}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── Footer fijo ── */}
              <div style={{ padding:"14px 24px 28px", borderTop:"1px solid rgba(255,255,255,.06)", flexShrink:0, display:"flex", flexDirection:"column", gap:0 }}>
                {renovarStep === 1 && !renovar.plan && !m.beca && (
                  <p style={{ color:"#f87171", fontSize:11, textAlign:"center", marginBottom:8 }}>
                    ⚠️ Selecciona una membresía para continuar
                  </p>
                )}
                <div style={{ display:"flex", gap:8 }}>
                {renovarStep === 1 && (
                  <>
                    <button onClick={cerrarWizard}
                      style={{ flex:"0 0 auto", padding:"13px 18px", borderRadius:14, background:"var(--bg-elevated)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      ← Anterior
                    </button>
                    <button onClick={() => {
                        if (m.beca) { handleRenovar(); }
                        else { setRenovarStep(2); }
                      }}
                      disabled={renovarSaving || (!m.beca && !renovar.plan)}
                      title={!renovar.plan ? "Selecciona una membresía para continuar" : ""}
                      style={{ flex:1, padding:"13px", border:"none", borderRadius:14,
                        cursor: (renovarSaving || (!m.beca && !renovar.plan)) ? "not-allowed" : "pointer",
                        fontFamily:"inherit", fontSize:13, fontWeight:700,
                        opacity: (renovarSaving || (!m.beca && !renovar.plan)) ? 0.4 : 1,
                        background:"linear-gradient(135deg,#6c63ff,#e040fb)",
                        color:"#fff", boxShadow:"0 4px 18px rgba(108,99,255,.35)",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                      {renovarSaving ? "Guardando..." :
                        m.beca
                          ? (esPrimeraMembresía ? "🎓 Registrar (Beca — $0)" : "🎓 Renovar (Beca — $0)")
                          : "Siguiente →"}
                    </button>
                  </>
                )}
                {renovarStep === 2 && (
                  <>
                    <button onClick={() => setRenovarStep(1)}
                      style={{ flex:"0 0 auto", padding:"13px 18px", borderRadius:14, background:"var(--bg-elevated)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      ← Anterior
                    </button>
                    <div style={{ display:"flex", gap:8, flex:1 }}>
                      {/* Botón verde "Pago recibido" — solo cuando es Transferencia */}
                      {esPendienteTransf && (
                        <button onClick={async () => {
                            // Guardar como Activo directamente
                            if (renovarSaving) return;
                            setRenovarSaving(true);
                            try {
                              const montoPagadoFinal = m.beca ? 0 : (Number(renovar.monto)||0);
                              const fechaISO = renovar.inicio;
                              const venceISO2 = renovar.vence;
                              const becaTag = m.beca?" [BECA]":"";
                              const descText = `Renovación ${renovar.plan||"Sin membresía"} - ${m.nombre} [Transferencia]${becaTag}${venceISO2?` (vence:${venceISO2})`:""}`
                              await onAddPago({ id:uid(), tipo:"ingreso", categoria:"Membresías", desc:descText, descripcion:descText, monto:montoPagadoFinal, fecha:fechaISO, miembroId:m.id, vence_manual:venceISO2||null });
                              for (const pe of (renovar.planesExtra||[]).filter(p=>p.nombre)) {
                                const montoExtra = m.beca?0:(Number(pe.monto)||0);
                                await onAddPago({ id:uid(), tipo:"ingreso", categoria:"Membresías", desc:`Renovación ${pe.nombre} - ${m.nombre} [Transferencia]${becaTag}`, descripcion:`Renovación ${pe.nombre} - ${m.nombre}`, monto:montoExtra, fecha:fechaISO, miembroId:m.id, vence_manual:null });
                              }
                              const qrToken = m.qr_token||("DZ-"+Math.random().toString(36).toUpperCase().slice(2,6)+Math.random().toString(36).toUpperCase().slice(2,4));
                              const updated = { ...m, estado:"Activo", qr_token:qrToken, pago_pendiente:false };
                              await onSave(updated);
                              if (onMemberUpdate) onMemberUpdate(updated);
                              try {
                                const montoTotal2 = montoPagadoFinal + (renovar.planesExtra||[]).reduce((s,pe)=>s+(m.beca?0:(Number(pe.monto)||0)),0);
                                const png = await generarComprobantePNG({ gymConfig, miembro:m, plan:renovar.plan, monto:montoTotal2, formaPago:"Transferencia", venceISO:venceISO2 });
                                setRenovarCompPNG(png);
                              } catch(e) {}
                              setRenovarStep(3);
                            } finally { setRenovarSaving(false); }
                          }}
                          disabled={renovarSaving || !renovar.inicio}
                          style={{ flex:1, padding:"13px 10px", borderRadius:14, border:"none", fontFamily:"inherit",
                            background: renovarSaving?"rgba(16,185,129,.4)":"linear-gradient(135deg,#10b981,#059669)",
                            color:"#fff", fontWeight:700, fontSize:13, cursor:renovarSaving?"not-allowed":"pointer",
                            opacity: renovarSaving?.6:1,
                            display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                            boxShadow:"0 2px 12px rgba(16,185,129,.3)" }}>
                          ✅ Pago recibido
                        </button>
                      )}
                      {/* Botón principal */}
                      <button onClick={handleRenovar}
                        disabled={!renovar.inicio || renovarSaving || (!m.beca && (renovar.plan||(renovar.planesExtra||[]).length>0) && montoTotalRenovacion<=0)}
                        style={{ flex:1, padding:"13px", border:"none", borderRadius:14,
                          cursor:(!renovar.inicio||renovarSaving)?"not-allowed":"pointer",
                          fontFamily:"inherit", fontSize:13, fontWeight:700,
                          opacity:(!renovar.inicio||renovarSaving||(!m.beca&&(renovar.plan||(renovar.planesExtra||[]).length>0)&&montoTotalRenovacion<=0))?.5:1,
                          background: m.beca ? "linear-gradient(135deg,#fbbf24,#f59e0b)"
                            : esPendienteTransf ? "linear-gradient(135deg,#f59e0b,#d97706)"
                            : "linear-gradient(135deg,#10b981,#059669)",
                          color: m.beca?"#1a1a2e":"#fff",
                          boxShadow: esPendienteTransf?"0 4px 18px rgba(245,158,11,.35)":"0 4px 18px rgba(16,185,129,.3)",
                          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        {renovarSaving ? "Guardando..." : m.beca
                          ? (esPrimeraMembresía?"🎓 Registrar (Beca — $0)":"🎓 Renovar (Beca — $0)")
                          : esPendienteTransf ? "⏳ Registrar — pago pendiente"
                          : "✅ Pago recibido"}
                      </button>
                    </div>
                  </>
                )}
                {renovarStep === 3 && (
                  <button onClick={cerrarWizard}
                    style={{ flex:1, padding:"13px", borderRadius:14, background:"var(--bg-elevated)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                    Cerrar
                  </button>
                )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ══════════ MAIN BODY (scrollable) ══════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 80px" }}>

      {/* ══════════ HERO CARD ══════════ */}
      {(() => {
        // ── Buscar plan vinculado en planesMembresia para obtener horario real
        // Si no tiene membresía activa, no mostrar horario del plan (evita mostrar datos de un plan anterior)
        const planNombreActual = (memInfo.estado === "Sin membresía") ? "" : (memInfo.plan || "");
        const planVinculado = (planesMembresia || []).find(p => {
          const pn = (p.nombre || "").toLowerCase().trim();
          const cn = (p.clase_nombre || "").toLowerCase().trim();
          const mn = planNombreActual.toLowerCase().trim();
          return pn === mn || cn === mn || pn.includes(mn) || mn.includes(pn) || cn.includes(mn) || mn.includes(cn);
        });
        const horasRaw = planVinculado?.hora_inicio || null;
        const horaFin  = planVinculado?.hora_fin || null;
        const diasPlan = planVinculado?.dias_semana || [];

        // Formatear hora: "16:00:00" → "4:00 pm"
        const fmtH = (t) => {
          if (!t) return null;
          const [h, m2] = t.split(":").map(Number);
          const suf = h >= 12 ? "pm" : "am";
          const h12 = h % 12 || 12;
          return `${h12}:${String(m2).padStart(2,"0")} ${suf}`;
        };
        const horarioStr = horasRaw
          ? horaFin ? `${fmtH(horasRaw)} – ${fmtH(horaFin)}` : fmtH(horasRaw)
          : null;
        const diasStr = diasPlan.length > 0 ? diasPlan.join(" · ") : null;

        // Fallback desde notas: SOLO si tiene membresía activa (evita mostrar datos viejos/confusos)
        const notas = m.notas || "";
        const tieneMembresia = memInfo.estado !== "Sin membresía" && memInfo.estado !== "Vencido";
        const horarioFallback = (!horarioStr && tieneMembresia)
          ? notas.match(/(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i)?.[1] || null
          : null;
        const diasFallback = (!diasStr && tieneMembresia)
          ? (notas.match(/(?:plan[:\s]+)([A-ZÁÉÍÓÚ/]+)/i)?.[1] || notas.match(/\b(MAR|LUN|MIÉ|JUE|VIE|SÁB|DOM)(?:\/[A-ZÁÉÍÓÚ]+)*/i)?.[0] || null)
          : null;

        const horarioFinal = horarioStr || horarioFallback;
        const diasFinal    = diasStr    || diasFallback;
        // Chip de clase: solo mostrar si hay membresía activa
        const claseFinal   = tieneMembresia ? (planVinculado?.clase_nombre || memInfo.plan) : null;

        // ── Estado
        const esActivo    = !isPagoPendiente && memInfo.estado === "Activo";
        const esVencido   = !isPagoPendiente && memInfo.estado === "Vencido";
        const esCongelado = memInfo.estado === "Congelado";
        const esSinMem    = memInfo.estado === "Sin membresía";

        const accentColor = isPagoPendiente ? "#f59e0b"
          : esActivo    ? "#22d3ee"
          : esCongelado ? "#60a5fa"
          : esVencido   ? "#f87171"
          : "var(--text-tertiary,#6b7280)";

        const estadoLabel = isPagoPendiente ? "⏳ Pago pendiente"
          : esCongelado ? "🧊 Congelado"
          : esVencido   ? "⚠️ Vencido"
          : esSinMem    ? "Sin membresía"
          : "● Activo";

        // ── Días restantes
        const diasR = diasParaVencer(memInfo.vence);
        const diasColor = diasR === null ? "var(--text-tertiary,#6b7280)"
          : diasR <= 0  ? "#f87171"
          : diasR <= 5  ? "#fb923c"
          : diasR <= 15 ? "#fbbf24"
          : "#4ade80";
        const diasLabel = diasR === null ? null
          : diasR === 0 ? "vence hoy"
          : diasR < 0   ? `venció hace ${Math.abs(diasR)}d`
          : `${diasR} días restantes`;

        const esMenor = esMenorDeEdad(m.fecha_nacimiento);
        const tieneTutor = m.tutor_nombre && m.tutor_nombre.trim();
        const waNumTutor  = (m.tutor_telefono || "").replace(/\D/g,"");
        const waFullTutor = waNumTutor.startsWith("52") ? waNumTutor : "52" + waNumTutor;

        const gradoInfo = isDojo && m.grado_actual ? (() => {
          try { return getGradoInfo(m.grado_actual); } catch { return null; }
        })() : null;

        return (
          <div style={{
            background: "var(--bg-card)",
            borderBottom: `2px solid ${accentColor}44`,
            padding: "20px 20px 0",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow de acento — sutil, funciona en dark y light */}
            <div style={{
              position: "absolute", top: -60, right: -60,
              width: 200, height: 200, borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor}14 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />

            {/* Fila superior: Avatar + Info principal */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: isPagoPendiente ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : esActivo   ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                    : esVencido  ? "linear-gradient(135deg,#f43f5e,#fb923c)"
                    : "linear-gradient(135deg,#374151,#4b5563)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, color: "#fff", fontWeight: 800, overflow: "hidden",
                  boxShadow: `0 0 0 2.5px ${accentColor}55, 0 6px 20px rgba(0,0,0,.25)`,
                }}>
                  {m.foto
                    ? <img src={m.foto} alt={m.nombre} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : m.nombre.charAt(0)}
                </div>
                <button onClick={() => setPhotoModal(true)} style={{
                  position:"absolute", bottom:-4, right:-4,
                  width:22, height:22, borderRadius:7,
                  background:"linear-gradient(135deg,#6c63ff,#e040fb)",
                  border:"2px solid var(--bg-card)", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:10, boxShadow:"0 2px 6px rgba(108,99,255,.5)",
                }}>📷</button>
              </div>

              {/* Nombre + chips */}
              <div style={{ flex:1, minWidth:0 }}>
                <h2 style={{
                  color: "var(--text-primary)", fontSize:16, fontWeight:800,
                  margin:"0 0 5px", lineHeight:1.2, letterSpacing:"-0.3px",
                  overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
                }}>
                  {m.nombre}
                </h2>

                {/* Chips fila 1: estado · plan · edad */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                  <span style={{
                    background: isPagoPendiente ? "rgba(245,158,11,.12)"
                      : esActivo    ? "rgba(22,163,74,.12)"
                      : esCongelado ? "rgba(37,99,235,.12)"
                      : esVencido   ? "rgba(220,38,38,.12)"
                      : "rgba(100,116,139,.12)",
                    color: isPagoPendiente ? "#b45309"
                      : esActivo    ? "#15803d"
                      : esCongelado ? "#1d4ed8"
                      : esVencido   ? "#b91c1c"
                      : "var(--text-secondary,#475569)",
                    border: "none",
                    borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                  }}>{estadoLabel}</span>

                  {claseFinal && (
                    <span style={{
                      background: "rgba(37,99,235,.08)",
                      color: "var(--brand-accent,#2563EB)",
                      border: "1px solid rgba(37,99,235,.2)",
                      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                    }}>{claseFinal}</span>
                  )}

                  {esMenor && edad !== null && (
                    <span style={{
                      background: "rgba(100,116,139,.08)",
                      color: "var(--text-secondary,#475569)",
                      border: "1px solid var(--border)",
                      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                    }}>{edad} años</span>
                  )}

                  {gradoInfo && (
                    <span style={{
                      background: "rgba(100,116,139,.08)",
                      color: "var(--text-secondary,#475569)",
                      border: "1px solid var(--border)",
                      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                    }}>{gradoInfo.emoji} {m.grado_actual}</span>
                  )}

                  {m.beca && (
                    <span style={{
                      background: "rgba(245,158,11,.1)",
                      color: "#b45309",
                      border: "1px solid rgba(245,158,11,.25)",
                      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600,
                    }}>Beca</span>
                  )}
                </div>

                {/* Chip de horario + días — datos estructurados del plan */}
                {(horarioFinal || diasFinal) && (
                  <div style={{
                    display:"inline-flex", alignItems:"center", gap:6,
                    background:"var(--bg-elevated)", border:"1px solid var(--border)",
                    borderRadius:8, padding:"4px 10px",
                  }}>
                    <span style={{ fontSize:11 }}>🗓️</span>
                    {diasFinal && (
                      <span style={{ color:"var(--text-primary)", fontSize:11, fontWeight:800 }}>
                        {diasFinal}
                      </span>
                    )}
                    {diasFinal && horarioFinal && (
                      <span style={{ color:"var(--text-tertiary,#64748b)", fontSize:10 }}>·</span>
                    )}
                    {horarioFinal && (
                      <span style={{ color:"var(--brand-accent,#2563EB)", fontSize:11, fontWeight:600 }}>
                        {horarioFinal}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Barra de urgencia — días restantes */}
            {diasLabel && (
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                background: diasR !== null && diasR <= 5 ? "rgba(220,38,38,.06)" : "rgba(37,99,235,.05)",
                border: `1px solid ${diasR !== null && diasR <= 5 ? "rgba(220,38,38,.18)" : "rgba(37,99,235,.15)"}`,
                borderRadius:10, padding:"8px 12px", marginBottom:10,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13 }}>
                    {diasR !== null && diasR <= 0 ? "🔴" : diasR !== null && diasR <= 5 ? "🟠" : diasR !== null && diasR <= 15 ? "🟡" : "🟢"}
                  </span>
                  <div>
                    <p style={{ color:"var(--text-tertiary,#64748b)", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, margin:0 }}>Membresía</p>
                    <p style={{ color:diasColor, fontSize:12, fontWeight:700, margin:0 }}>{diasLabel}</p>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ color:"var(--text-tertiary,#64748b)", fontSize:9, margin:0 }}>{diasR !== null && diasR < 0 ? "Venció" : "Vence"}</p>
                  <p style={{ color:"var(--text-primary,#0F172A)", fontSize:11, fontWeight:700, margin:0 }}>{fmtDate(memInfo.vence) || "—"}</p>
                </div>
              </div>
            )}

            {/* Mini-stats: Desde / Último pago (con fecha) / Forma de pago */}
            {memInfo.estado !== "Sin membresía" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
                {[
                  {
                    label: "Desde",
                    val: fmtDate(memInfo.inicio) || "—",
                  },
                  {
                    label: `Último pago · ${fmtDate(memInfo.inicio) || "—"}`,
                    val: memInfo.esGratis ? "Cortesía" : (memInfo.monto ? `$${Number(memInfo.monto).toLocaleString("es-MX")}` : "—"),
                    highlight: true,
                  },
                  {
                    label: "Forma de pago",
                    val: memInfo.formaPago === "Efectivo" ? "Efectivo"
                      : memInfo.formaPago === "Transferencia" ? "Transfer."
                      : memInfo.formaPago === "Tarjeta" ? "Tarjeta"
                      : "—",
                  },
                ].map((s,i) => (
                  <div key={i} style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10, padding: "7px 8px",
                  }}>
                    <p style={{ color: "var(--text-tertiary,#64748b)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2, lineHeight: 1.3 }}>{s.label}</p>
                    <p style={{ color: s.highlight ? "var(--text-primary,#0F172A)" : "var(--text-secondary,#475569)", fontSize: 11, fontWeight: s.highlight ? 800 : 600, margin: 0 }}>{s.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Botones de acción principales: WA alumno + WA tutor */}
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              {m.tel && onGoToMensajes && (
                <button onClick={() => onGoToMensajes(m)} style={{
                  flex:1, padding:"9px 8px", border:"none", borderRadius:8,
                  cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                  background:"#25d366", color:"#fff",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                }}>
                  💬 {waUmbral !== null ? `WA (${diasR === 0 ? "hoy" : diasR === 1 ? "mañana" : `${diasR}d`})` : "Mensaje WA"}
                </button>
              )}
              {esMenor && tieneTutor && waNumTutor.length >= 10 && (
                <button onClick={() => window.open(`https://wa.me/${waFullTutor}`, "_blank")} style={{
                  flex:1, padding:"9px 8px",
                  border:"1px solid var(--border)", borderRadius:8,
                  cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                  background:"var(--bg-elevated)", color:"var(--text-primary,#0F172A)",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                }}>👨‍👧 WA tutor</button>
              )}
              {esMenor && !tieneTutor && (
                <button onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }} style={{
                  flex:1, padding:"9px 8px",
                  border:"1px solid rgba(220,38,38,.3)", borderRadius:8,
                  cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600,
                  background:"rgba(220,38,38,.06)", color:"#b91c1c",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                }}>⚠️ Registrar tutor</button>
              )}
            </div>

            {/* Acciones: Editar · Renovar · Cobrar · Congelar */}
            <div style={{ display:"flex", gap:6, paddingBottom:14 }}>
              <button onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }} style={{
                flex:1, padding:"9px 4px", borderRadius:8,
                border:"1px solid var(--border)", background:"var(--bg-elevated)",
                color:"var(--text-primary,#0F172A)", fontSize:11, fontWeight:600,
                cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:4,
              }}>✏️ Editar</button>
              <button onClick={() => {
                const dias = diasParaVencer(memInfo.vence);
                const venceISO = (() => { const v = parseDate(memInfo.vence); if (!v) return todayISO(); v.setHours(0,0,0,0); return v.toISOString().split("T")[0]; })();
                const sugerido = dias !== null && dias > 0 ? venceISO : todayISO();
                const planesDisp = (activePlanes || []).filter(p => p.activo !== false);
                const planPresel = memInfo.plan
                  ? (planesDisp.find(p => p.nombre === memInfo.plan) || planesDisp[0] || null)
                  : (planesDisp.length === 1 ? planesDisp[0] : null);
                const planNombre = planPresel?.nombre || null;
                const planMonto  = m.beca ? "0" : String(Number(planPresel?.precio ?? 0));
                setRenovar({ plan: planNombre, monto: planMonto, inicio: sugerido, vence: calcVence(sugerido, planNombre), venceManual: false, formaPago: "Efectivo", planesExtra: [] });
                setPlanOriginal(memInfo.plan || defaultPlan);
                setPlanCambiado(false);
                setRenovarModal(true);
              }} style={{
                flex:2, padding:"9px 4px", borderRadius:8,
                border:"none", background:"var(--brand-accent,#2563EB)",
                color:"#fff", fontSize:11, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:4,
              }}>🔄 Renovar</button>
              <button onClick={() => { setCobro({ tipo:"libre", desc:"", monto:"", fecha:todayISO(), formaPago:"Efectivo" }); setCobrarModal(true); }} style={{
                flex:1, padding:"9px 4px", borderRadius:8,
                border:"1px solid var(--border)", background:"var(--bg-elevated)",
                color:"var(--text-primary,#0F172A)", fontSize:11, fontWeight:600,
                cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:4,
              }}>💰 Cobrar</button>
              {memInfo.estado === "Activo" && !memInfo.congelado && (
                <button onClick={() => setCongelarModal(true)} style={{
                  flex:1, padding:"9px 4px", borderRadius:8,
                  border:"1px solid var(--border)", background:"var(--bg-elevated)",
                  color:"var(--text-secondary,#475569)", fontSize:11, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                }}>🧊</button>
              )}
            </div>
          </div>
        );
      })()}


      {/* ── Tabs ── */}
      <div style={{ display: "flex", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
        {[
          { k: "perfil",    label: "Perfil" },
          { k: "historial", label: `Historial${historial.length > 0 ? ` (${historial.length})` : ""}` },
          { k: "qr",        label: "QR" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setDetTab(t.k)}
            style={{
              flex: 1, padding: "11px 0", border: "none", cursor: "pointer",
              fontFamily: "inherit", background: "transparent",
              color: detTab === t.k ? "var(--brand-accent,#2563EB)" : "var(--text-secondary,#475569)",
              fontSize: 12, fontWeight: detTab === t.k ? 700 : 500,
              borderBottom: detTab === t.k ? "2px solid var(--brand-accent,#2563EB)" : "2px solid transparent",
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: PERFIL ══════════ */}
      {detTab === "perfil" && (
        <div style={{ padding: "18px 20px 0" }}>
          {editing ? (
            <>
              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Datos personales
              </p>
              <Inp label="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Nombre completo" />
              <Inp label="Teléfono" value={form.tel} onChange={(v) => setForm((p) => ({ ...p, tel: v }))} placeholder="999 000 0000" type="tel" />

              <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Fecha de incorporación
              </p>
              <input
                type="date"
                value={form.fecha_incorporacion}
                onChange={(e) => setForm((p) => ({ ...p, fecha_incorporacion: e.target.value }))}
                style={{
                  width: "100%", background: "var(--bg-elevated)",
                  border: `1px solid ${form.fecha_incorporacion ? "var(--border)" : "rgba(245,158,11,.4)"}`,
                  borderRadius: 12, padding: "12px 14px",
                  color: form.fecha_incorporacion ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontSize: 14, fontFamily: "inherit", outline: "none",
                  marginBottom: form.fecha_incorporacion ? 12 : 6,
                }}
              />
              {!form.fecha_incorporacion && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>
                  ⚠️ Sin fecha de incorporación — agrégala para no confundir con otras fechas
                </p>
              )}

              <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Sexo
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { val: "Masculino", icon: "♂️", color: "#60a5fa" },
                  { val: "Femenino",  icon: "♀️", color: "#f472b6" },
                  { val: "",          icon: "—",  color: "#8b949e" },
                ].map((op) => (
                  <button
                    key={op.val}
                    onClick={() => setForm((p) => ({ ...p, sexo: op.val }))}
                    style={{
                      flex: 1, padding: "10px 0",
                      border: form.sexo === op.val ? `2px solid ${op.color}` : "1.5px solid rgba(255,255,255,.08)",
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      background: form.sexo === op.val ? `${op.color}20` : "var(--bg-elevated)",
                      color: form.sexo === op.val ? op.color : "#8b949e",
                      fontSize: 12, fontWeight: 700, transition: "all .2s",
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{op.icon}</div>
                    {op.val || "N/E"}
                  </button>
                ))}
              </div>

              <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Fecha de nacimiento
              </p>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm((p) => ({ ...p, fecha_nacimiento: e.target.value }))}
                style={{
                  width: "100%", background: "var(--bg-elevated)",
                  border: `1px solid ${form.fecha_nacimiento ? "var(--border)" : "rgba(245,158,11,.4)"}`,
                  borderRadius: 12, padding: "12px 14px",
                  color: form.fecha_nacimiento ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontSize: 14, fontFamily: "inherit", outline: "none",
                  marginBottom: form.fecha_nacimiento ? 12 : 6,
                }}
              />
              {!form.fecha_nacimiento && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>
                  ⚠️ Sin fecha de nacimiento — agrégala para ver cumpleaños
                </p>
              )}
              {form.fecha_nacimiento && (
                <p style={{
                  fontSize: 11,
                  color: esEdicionMenor ? "#fbbf24" : "var(--text-tertiary)",
                  marginTop: -8,
                  marginBottom: 12,
                  paddingLeft: 2,
                }}>
                  {esEdicionMenor
                    ? `⚠️ Edad detectada: ${calcEdad(form.fecha_nacimiento)} años — menor de edad`
                    : `Edad detectada: ${calcEdad(form.fecha_nacimiento)} años`
                  }
                </p>
              )}
              {esEdicionMenor && (
                <TutorFields
                  tutor={{
                    tutor_nombre:     form.tutor_nombre,
                    tutor_telefono:   form.tutor_telefono,
                    tutor_parentesco: form.tutor_parentesco,
                  }}
                  onChange={(campo, valor) => {
                    setForm(p => ({ ...p, [campo]: valor }));
                    setTutorErrores(p => ({ ...p, [campo]: undefined }));
                  }}
                  errores={tutorErrores}
                />
              )}

              {/* ── Beca ── */}
              <div
                onClick={() => setForm(p => ({ ...p, beca: !p.beca }))}
                style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "12px 14px", background: form.beca ? "rgba(251,191,36,.08)" : "rgba(255,255,255,.04)", borderRadius: 12, border: `1.5px solid ${form.beca ? "rgba(251,191,36,.4)" : "rgba(255,255,255,.08)"}`, cursor: "pointer", transition: "all .2s" }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${form.beca ? "#fbbf24" : "rgba(255,255,255,.2)"}`, background: form.beca ? "#fbbf24" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {form.beca && <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 700 }}>✓</span>}
                </div>
                <div>
                  <p style={{ color: form.beca ? "#fbbf24" : "#d1d5db", fontSize: 13, fontWeight: 600 }}>🎓 Beca — Membresía sin costo</p>
                  <p style={{ color: "#8b949e", fontSize: 11, marginTop: 2 }}>Las renovaciones se registrarán en $0 sin comprobante</p>
                </div>
              </div>

              {/* ── DOJO: Grado / Cinturón (solo en modo dojo) ── */}
              {isDojo && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    🥋 Grado y cinturón
                  </p>
                  {/* Selector visual de grado */}
                  <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 8 }}>Cinturón actual</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                    {GRADOS_KARATE.map(g => {
                      const active = form.grado_actual === g.nombre;
                      return (
                        <button
                          key={g.nombre}
                          onClick={() => setForm(p => ({ ...p, grado_actual: g.nombre }))}
                          style={{
                            padding: "8px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                            border: active ? `2px solid ${g.kyu < 0 ? "#a78bfa" : g.color}` : "1.5px solid rgba(255,255,255,.08)",
                            background: active ? `${g.color}22` : "var(--bg-elevated)",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{g.emoji}</span>
                          <span style={{ fontSize: 9, color: active ? "#e5e7eb" : "#6b7280", fontWeight: active ? 700 : 400, textAlign: "center", lineHeight: 1.3 }}>
                            {g.nombre.replace(" (", "\n(")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <Inp
                    label="Fecha del último examen"
                    type="date"
                    value={form.fecha_ultimo_examen || ""}
                    onChange={v => setForm(p => ({ ...p, fecha_ultimo_examen: v }))}
                  />
                  <Inp
                    label="Próximo objetivo (cinturón)"
                    value={form.proximo_objetivo || ""}
                    onChange={v => setForm(p => ({ ...p, proximo_objetivo: v }))}
                    options={GRADOS_NOMBRES}
                    placeholder="Ej: Verde"
                  />
                </div>
              )}

              {/* ── Clases asignadas (rediseño claro) ── */}
              {clases && clases.filter(c => c.activo !== false).length > 0 && (() => {
                const getPrecioClase = (c) => {
                  const planVinc = (planesMembresia||[]).find(p =>
                    (p.clases_vinculadas||[]).map(String).includes(String(c.id)) ||
                    p.clase_nombre === c.nombre || p.nombre === c.nombre
                  );
                  return Number(planVinc?.precio_publico ?? c?.precio_membresia ?? c?.costo ?? 0);
                };
                const todasLasClases = clases.filter(c => c.activo !== false);
                // Separar en dos grupos: las que ya tiene vs las que NO tiene
                const clasesActuales = todasLasClases.filter(c => clasesDelMiembro.includes(String(c.id)));
                const clasesDisponibles = todasLasClases.filter(c => !clasesDelMiembro.includes(String(c.id)));
                // De las disponibles, cuáles seleccionó para AGREGAR en esta sesión
                const clasesAAgregar = clasesDisponibles.filter(c => clasesEdit.map(String).includes(String(c.id)));
                // De las actuales, cuáles marcó para QUITAR
                const clasesAQuitar = clasesActuales.filter(c => !clasesEdit.map(String).includes(String(c.id)));
                const cargoTotal = m.beca ? 0 : clasesAAgregar.reduce((s, c) => s + getPrecioClase(c), 0);

                const getHorStr = (c) => {
                  const horClase = (horarios||[]).filter(h => h.clase_id === c.id && h.activo !== false);
                  return horClase.length > 0
                    ? horClase.map(h => `${(h.dias_semana||[]).join(", ")} ${h.hora_inicio||""}–${h.hora_fin||""}`.trim()).join(" | ")
                    : null;
                };

                return (
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      🏋️ Clases
                    </p>

                    {/* ── BLOQUE 1: Clases en las que YA ESTÁ inscrito ── */}
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        Actualmente inscrito
                      </p>
                      {clasesActuales.length === 0 ? (
                        <div style={{ background: "var(--bg-elevated)", border: "1px dashed rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 14px" }}>
                          <p style={{ color: "#6b7280", fontSize: 12 }}>Sin clases asignadas</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {clasesActuales.map(c => {
                            const precio = getPrecioClase(c);
                            const horStr = getHorStr(c);
                            const marcadoParaQuitar = clasesAQuitar.some(x => String(x.id) === String(c.id));
                            return (
                              <div key={c.id} style={{
                                padding: "10px 14px", borderRadius: 12,
                                border: marcadoParaQuitar ? "2px solid rgba(248,113,113,.5)" : "1.5px solid rgba(34,211,238,.3)",
                                background: marcadoParaQuitar ? "rgba(248,113,113,.06)" : "rgba(34,211,238,.06)",
                                display: "flex", alignItems: "center", gap: 10,
                                opacity: marcadoParaQuitar ? 0.7 : 1,
                                transition: "all .2s",
                              }}>
                                {/* Ícono de estado */}
                                <div style={{
                                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                  background: marcadoParaQuitar ? "rgba(248,113,113,.15)" : "rgba(34,211,238,.15)",
                                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                                }}>
                                  {marcadoParaQuitar ? "✕" : "✓"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <p style={{ color: marcadoParaQuitar ? "#f87171" : "#22d3ee", fontSize: 13, fontWeight: 700, margin: 0, textDecoration: marcadoParaQuitar ? "line-through" : "none" }}>
                                      {c.nombre}
                                    </p>
                                    {!marcadoParaQuitar && (
                                      <span style={{ background: "rgba(34,211,238,.15)", color: "#22d3ee", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                                        Inscrito
                                      </span>
                                    )}
                                    {marcadoParaQuitar && (
                                      <span style={{ background: "rgba(248,113,113,.15)", color: "#f87171", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                                        Se quitará al guardar
                                      </span>
                                    )}
                                  </div>
                                  {horStr && <p style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>🗓️ {horStr}</p>}
                                  {precio > 0 && <p style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>${precio.toLocaleString("es-MX")}/mes</p>}
                                </div>
                                {/* Botón quitar */}
                                <button
                                  onClick={() => setClasesEdit(prev =>
                                    prev.map(String).includes(String(c.id))
                                      ? prev.filter(id => String(id) !== String(c.id))
                                      : [...prev, String(c.id)]
                                  )}
                                  style={{
                                    flexShrink: 0, padding: "5px 10px", borderRadius: 8,
                                    border: marcadoParaQuitar ? "1px solid rgba(34,211,238,.3)" : "1px solid rgba(248,113,113,.3)",
                                    background: marcadoParaQuitar ? "rgba(34,211,238,.1)" : "rgba(248,113,113,.08)",
                                    color: marcadoParaQuitar ? "#22d3ee" : "#f87171",
                                    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                  }}
                                >
                                  {marcadoParaQuitar ? "Deshacer" : "Quitar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── BLOQUE 2: Clases disponibles para AGREGAR ── */}
                    {clasesDisponibles.length > 0 && (
                      <div>
                        <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                          Agregar clase
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {clasesDisponibles.map(c => {
                            const precio = getPrecioClase(c);
                            const horStr = getHorStr(c);
                            const seleccionada = clasesEdit.map(String).includes(String(c.id));
                            return (
                              <button
                                key={c.id}
                                onClick={() => setClasesEdit(prev =>
                                  prev.map(String).includes(String(c.id))
                                    ? prev.filter(id => String(id) !== String(c.id))
                                    : [...prev, String(c.id)]
                                )}
                                style={{
                                  padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                                  fontFamily: "inherit", textAlign: "left",
                                  border: seleccionada ? "2px solid #4ade80" : "1.5px solid rgba(255,255,255,.1)",
                                  background: seleccionada ? "rgba(74,222,128,.08)" : "var(--bg-elevated)",
                                  display: "flex", alignItems: "center", gap: 10, transition: "all .2s",
                                }}
                              >
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                  border: `2px solid ${seleccionada ? "#4ade80" : "rgba(255,255,255,.2)"}`,
                                  background: seleccionada ? "#4ade80" : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  {seleccionada
                                    ? <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 900 }}>✓</span>
                                    : <span style={{ color: "#6b7280", fontSize: 14, fontWeight: 400 }}>+</span>
                                  }
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ color: seleccionada ? "#4ade80" : "var(--text-primary)", fontSize: 13, fontWeight: seleccionada ? 700 : 500, margin: 0 }}>
                                    {c.nombre}
                                  </p>
                                  {horStr && <p style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>🗓️ {horStr}</p>}
                                </div>
                                {/* Precio — solo si tiene costo extra */}
                                {precio > 0 ? (
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <span style={{
                                      display: "block",
                                      background: seleccionada ? "rgba(74,222,128,.2)" : "rgba(255,255,255,.07)",
                                      color: seleccionada ? "#4ade80" : "#8b949e",
                                      borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 700,
                                    }}>
                                      +${precio.toLocaleString("es-MX")}/mes
                                    </span>
                                    <span style={{ color: "#6b7280", fontSize: 10 }}>costo extra</span>
                                  </div>
                                ) : (
                                  <span style={{ background: "rgba(74,222,128,.1)", color: "#4ade80", borderRadius: 8, padding: "3px 9px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                    Sin costo
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Aviso de cobro: solo aparece si se seleccionó agregar clases con costo ── */}
                    {!m.beca && cargoTotal > 0 && (
                      <div style={{
                        marginTop: 12, padding: "12px 14px", borderRadius: 12,
                        background: "rgba(251,191,36,.07)", border: "1.5px solid rgba(251,191,36,.35)",
                      }}>
                        <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                          ⚠️ Al guardar se registrará un cobro de:
                        </p>
                        {clasesAAgregar.filter(c => getPrecioClase(c) > 0).map(c => (
                          <p key={c.id} style={{ color: "#d97706", fontSize: 12, margin: "2px 0", paddingLeft: 4 }}>
                            · {c.nombre}: ${getPrecioClase(c).toLocaleString("es-MX")}
                          </p>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(251,191,36,.2)" }}>
                          <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 800 }}>Total: ${cargoTotal.toLocaleString("es-MX")}</span>
                          <span style={{ color: "#d97706", fontSize: 11 }}>Se pedirá forma de pago</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                📝 Notas internas{" "}
                <span style={{ color: "#8b949e", fontWeight: 400, fontSize: 10, textTransform: "none" }}>(opcional)</span>
              </p>
              <textarea
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                rows={3}
                placeholder="Ej: Tiene lesión de rodilla. Paga los viernes. Familiar del dueño."
                style={{
                  width: "100%", background: "var(--bg-elevated)",
                  border: "1px solid rgba(167,139,250,.2)", borderRadius: 12,
                  padding: "10px 14px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
                  outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 14,
                }}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <Btn full outline color="#8b949e" onClick={() => setEditing(false)}>Cancelar</Btn>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  style={{
                    flex: 1, padding: "13px 20px", border: "none", borderRadius: 14,
                    cursor: hasChanges ? "pointer" : "not-allowed", fontFamily: "inherit",
                    fontSize: 14, fontWeight: 700,
                    background: hasChanges ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
                    color: hasChanges ? "#fff" : "#8b949e",
                    boxShadow: hasChanges ? "0 4px 18px rgba(108,99,255,.4)" : "none",
                    transition: "all .3s",
                  }}
                >
                  {hasChanges ? "Guardar ✓" : "Sin cambios"}
                </button>
              </div>

              {/* ── Eliminar miembro ── */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
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
                    <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 12 }}>
                      Se borrarán también todas sus transacciones (
                      {txs.filter((t) => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length}{" "}
                      movimiento
                      {txs.filter((t) => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length !== 1 ? "s" : ""}
                      ). Esta acción no se puede deshacer.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ flex: 1, padding: "10px", border: "1px solid #30363d", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#8b949e" }}
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
                    <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 12 }}>
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

              {/* ── 1. MEMBRESÍA ACTUAL ── */}
              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Membresía actual
              </p>

              {/* ── Banner: Pago Pendiente ── */}
              {isPagoPendiente && (
                <div style={{
                  background:"rgba(251,191,36,.08)", border:"1.5px solid rgba(251,191,36,.35)",
                  borderRadius:16, padding:"16px", marginBottom:14,
                }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
                    <span style={{ fontSize:28, flexShrink:0 }}>⏳</span>
                    <div>
                      <p style={{ color:"#fbbf24", fontWeight:700, fontSize:14 }}>Pago por transferencia pendiente</p>
                      <p style={{ color:"rgba(251,191,36,.75)", fontSize:12, marginTop:4, lineHeight:1.5 }}>
                        Este alumno se registró pero aún no se ha confirmado la recepción de su transferencia bancaria. Confirma el pago para activar su membresía y su ID Digital.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmarDatos({ monto:"", plan:"", fecha:todayISO(), formaPago:"Transferencia" });
                      setConfirmarModal(true);
                    }}
                    style={{
                      width:"100%", padding:"13px", borderRadius:12, border:"none",
                      background:"linear-gradient(135deg,#22c55e,#4ade80)",
                      color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                      boxShadow:"0 4px 14px rgba(74,222,128,.35)",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    }}
                  >
                    ✅ Confirmar pago recibido
                  </button>
                </div>
              )}

              {memInfo.congelado && (
                <div style={{ background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 14, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🧊</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700 }}>Membresía congelada</p>
                    <p style={{ color: "#8b949e", fontSize: 11, marginTop: 2 }}>
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
                  borderRadius: 14, padding: "0 14px", marginBottom: 14,
                }}
              >
                {memInfo.estado !== "Sin membresía" ? (
                  [
                    { label: "📋 Plan", val: memInfo.plan || "—" },
                    { label: "📅 Inicio", val: fmtDate(memInfo.inicio) || "—" },
                    { label: (() => { const dR = diasParaVencer(memInfo.vence); return dR !== null && dR < 0 ? "⏰ Venció" : "⏰ Vence"; })(), val: memInfo.congelado ? `${fmtDate(memInfo.vence)} (+congelado)` : fmtDate(memInfo.vence) || "—" },
                    { label: "💰 Último pago", val: memInfo.esGratis ? "Cortesía 🎁" : (memInfo.monto ? `$${Number(memInfo.monto).toLocaleString("es-MX")}` : "—") },
                    ...(memInfo.formaPago
                      ? [{ label: "💳 Forma de pago", val: memInfo.formaPago === "Efectivo" ? "💵 Efectivo" : memInfo.formaPago === "Transferencia" ? "📲 Transferencia" : "💳 Tarjeta" }]
                      : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ color: "#8b949e", fontSize: 13 }}>{row.label}</span>
                      <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 600 }}>{row.val}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "18px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, marginBottom: 6 }}>📋</p>
                    <p style={{ color: "#8b949e", fontSize: 13, fontWeight: 600 }}>Sin membresía registrada</p>
                    <p style={{ color: "#8b949e", fontSize: 11, marginTop: 4 }}>Usa Renovar para registrar un nuevo pago</p>
                  </div>
                )}
              </div>

              {/* ── 3. DATOS PERSONALES ── */}
              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Datos personales
              </p>
              <div style={{ background: "var(--bg-elevated)", borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {[
                  { label: "📱 Teléfono", val: m.tel || "—" },
                  {
                    label: "📆 Incorporación",
                    custom: !m.fecha_incorporacion ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{fmtDate(m.fecha_incorporacion) || m.fecha_incorporacion}</span>
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
                      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>
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
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span style={{ color: "#8b949e", fontSize: 13 }}>{row.label}</span>
                    {row.custom || <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{row.val || "—"}</span>}
                  </div>
                ))}
              </div>

              {/* ── 4. TUTOR RESPONSABLE (solo menores) ── */}
              {esMenorDeEdad(m.fecha_nacimiento) && (() => {
                const tieneTutor = m.tutor_nombre && m.tutor_nombre.trim();
                const waNumTutor = (m.tutor_telefono || "").replace(/\D/g, "");
                const waFullTutor = waNumTutor.startsWith("52") ? waNumTutor : "52" + waNumTutor;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        👨‍👧 Tutor responsable
                      </p>
                      {tieneTutor && (
                        <button
                          onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }}
                          style={{ background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 8, padding: "3px 10px", color: "#f59e0b", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Editar
                        </button>
                      )}
                    </div>

                    {tieneTutor ? (
                      <div style={{ background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(251,191,36,.15)" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(251,191,36,.15)", border: "1.5px solid rgba(251,191,36,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                            👤
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                              {m.tutor_nombre}
                            </p>
                            {m.tutor_parentesco && (
                              <p style={{ color: "#92400e", fontSize: 11, margin: "1px 0 0" }}>{m.tutor_parentesco}</p>
                            )}
                          </div>
                        </div>
                        <div style={{ padding: "0 14px" }}>
                          {m.tutor_telefono && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(251,191,36,.1)" }}>
                              <span style={{ color: "#8b949e", fontSize: 12 }}>Teléfono</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 600 }}>{m.tutor_telefono}</span>
                                {waNumTutor.length >= 10 && (
                                  <button
                                    onClick={() => window.open(`https://wa.me/${waFullTutor}`, "_blank")}
                                    style={{ background: "#EAF3DE", border: "0.5px solid #C0DD97", borderRadius: 6, padding: "2px 8px", color: "#3B6D11", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                                  >
                                    WA
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {m.tutor_parentesco && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                              <span style={{ color: "#8b949e", fontSize: 12 }}>Parentesco</span>
                              <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 600 }}>{m.tutor_parentesco}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }}
                        style={{ background: "rgba(244,63,94,.06)", border: "1px dashed rgba(244,63,94,.4)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
                        <div>
                          <p style={{ color: "#f87171", fontSize: 13, fontWeight: 700, margin: 0 }}>Tutor no registrado</p>
                          <p style={{ color: "#8b949e", fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>
                            Este alumno es menor de edad. Toca para agregar datos del tutor responsable.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── 5. DOJO: Tarjeta de Grado (solo en modo dojo) ── */}
              {isDojo && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    🥋 Grado y cinturón
                  </p>
                  {m.grado_actual ? (() => {
                    const gInfo = getGradoInfo(m.grado_actual);
                    const esNegro = m.grado_actual.includes("Negro");
                    return (
                      <div style={{
                        background: esNegro ? "rgba(168,85,247,.08)" : "rgba(255,255,255,.04)",
                        border: `1px solid ${esNegro ? "rgba(168,85,247,.3)" : "rgba(255,255,255,.1)"}`,
                        borderRadius: 14, padding: "14px 16px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <div style={{
                            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                            background: gInfo.kyu < 0 ? "linear-gradient(135deg,#1a1a2e,#2d1b69)" : `${gInfo.color}22`,
                            border: `2px solid ${gInfo.kyu < 0 ? "#a855f7" : gInfo.color}`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                          }}>
                            {gInfo.emoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: "#e5e7eb", fontSize: 14, fontWeight: 700 }}>{m.grado_actual}</p>
                            <p style={{ color: "#8b949e", fontSize: 11, marginTop: 2 }}>
                              {gInfo.kyu > 0 ? `${gInfo.kyu}° Kyu` : `${Math.abs(gInfo.kyu)}er Dan`}
                            </p>
                          </div>
                          <button
                            onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }}
                            style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.25)", borderRadius: 10, padding: "6px 10px", color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Editar
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {m.fecha_ultimo_examen && (
                            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 10px" }}>
                              <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Último examen</p>
                              <p style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{fmtDate(m.fecha_ultimo_examen)}</p>
                            </div>
                          )}
                          {m.proximo_objetivo && (
                            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 10px" }}>
                              <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Próximo objetivo</p>
                              <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, marginTop: 2 }}>→ {m.proximo_objetivo}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div
                      onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }}
                      style={{ background: "var(--bg-elevated)", border: "1px dashed rgba(167,139,250,.3)", borderRadius: 12, padding: "16px", textAlign: "center", cursor: "pointer" }}
                    >
                      <p style={{ fontSize: 28, marginBottom: 6 }}>🥋</p>
                      <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 600 }}>Sin grado asignado</p>
                      <p style={{ color: "#8b949e", fontSize: 11, marginTop: 4 }}>Toca para asignar cinturón</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── 6. CLASES ASIGNADAS (solo lectura) ── */}
              {clases && clases.filter(c => c.activo !== false).length > 0 && clasesDelMiembro.length > 0 && (() => {
                const clasesAsignadas = clases.filter(c => c.activo !== false && clasesDelMiembro.includes(String(c.id)));
                if (clasesAsignadas.length === 0) return null;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                      🏋️ Clases asignadas
                    </p>
                    <div style={{ background: "var(--bg-elevated)", borderRadius: 14, padding: "0 14px" }}>
                      {clasesAsignadas.map((c, i) => {
                        const horClase = (horarios||[]).filter(h => h.clase_id === c.id && h.activo !== false);
                        const horStr = horClase.length > 0
                          ? horClase.map(h => {
                              const dias = (h.dias_semana||[]).join(", ");
                              return `${dias} ${h.hora_inicio||""}–${h.hora_fin||""}`.trim();
                            }).join(" | ")
                          : null;
                        return (
                          <div key={c.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "11px 0",
                            borderBottom: i < clasesAsignadas.length - 1 ? "1px solid var(--border)" : "none",
                          }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, margin: 0 }}>{c.nombre}</p>
                              {horStr && <p style={{ color: "#8b949e", fontSize: 11, marginTop: 2 }}>🗓️ {horStr}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── 7. NOTAS INTERNAS ── */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  📝 Notas internas
                </p>
                {m.notas ? (
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 12, padding: "10px 14px" }}>
                    <p style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.notas}</p>
                  </div>
                ) : (
                  <div
                    onClick={() => { setEditing(true); setClasesEdit(clasesDelMiembro); }}
                    style={{ background: "var(--bg-elevated)", border: "1px dashed var(--border)", borderRadius: 12, padding: "12px 14px", textAlign: "center", cursor: "pointer" }}
                  >
                    <p style={{ color: "#8b949e", fontSize: 12 }}>Sin notas — toca para agregar</p>
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      )}

      {/* ══════════ TAB: HISTORIAL ══════════ */}
      {detTab === "historial" && (
        <div style={{ padding: "0 20px" }}>
          {historial.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
              <p style={{ color: "#8b949e", fontSize: 13 }}>Sin movimientos registrados</p>
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
                          <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
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
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)", cursor: "pointer",
                              }}
                            >
                              <div style={{ width: 42, height: 42, borderRadius: "50%", fontSize: 18, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: `2px solid ${color}30` }}>
                                {isIngreso && m.foto
                                  ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : CAT_ICON[t.categoria] || (isIngreso ? "💰" : "💸")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                  {desc}
                                </p>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                  <span style={{ background: bgColor, color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                                    {t.categoria}
                                  </span>
                                  <span style={{ color: "#8b949e", fontSize: 10 }}>· {fmtDate(t.fecha)}</span>
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
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: isDesktop ? "center" : "flex-start", padding: isDesktop ? 24 : 0 }}>
              <div style={{ width: "100%", maxWidth: isDesktop ? 520 : "100%", background: "var(--bg-card)", borderRadius: isDesktop ? 20 : "28px 28px 0 0", padding: "24px 24px 44px", animation: isDesktop ? "fadeUp .25s ease" : "slideUp .3s ease", maxHeight: isDesktop ? "85vh" : "90%", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ color: "var(--text-primary)", fontSize: 17, fontWeight: 700 }}>💰 Registrar cobro extra</h2>
                  <button onClick={() => setPagoModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#8b949e", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <Inp label="Descripción" value={pago.desc} onChange={(v) => setPago((p) => ({ ...p, desc: v }))} placeholder="Ej: Clase extra, venta tienda, etc." />
                <Inp label="Monto ($)" type="number" value={pago.monto} onChange={(v) => setPago((p) => ({ ...p, monto: v }))} placeholder="0.00" />
                <Inp label="Fecha" type="date" value={pago.fecha} onChange={(v) => setPago((p) => ({ ...p, fecha: v }))} />
                <Btn full onClick={handleAddPago} color="#22d3ee">Guardar pago ✓</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: QR ══════════ */}
      {detTab === "qr" && (
        <MemberQRTab
          m={m}
          gymId={gymId}
          onMemberUpdate={onMemberUpdate}
          darkMode={!!gymConfig?.darkMode}
        />
      )}
      </div>{/* /main body scroll */}
    </div>
  );
}
