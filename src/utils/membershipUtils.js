// src/utils/membershipUtils.js
// ─── Lógica de membresías, WA y cálculo de vencimiento ────────────────────

import { parseDate, diasParaVencer, fmtDate } from "./dateUtils";
import { PLAN_MESES } from "./constants";

// ─── Template por defecto de recordatorio WA ──────────────────────────────
const DEFAULT_RECORDATORIO_TPL = `Estimado/a {nombre}:
Espero que estés bien. Te informamos que tu membresía, con vencimiento: {fecha}, ya se encuentra disponible para su pago.
Podrás pagarla directamente en Recepción o mediante transferencia ({clabe}, {titular}, {banco}).
Asimismo, queremos recordarte que contamos con un plazo de tolerancia de 2 días para completar el pago. A partir del día 3, se aplicará un 20% adicional. Realizando el pago en tiempo y forma, podrás conservar tu tarifa actual.
Si tienes alguna consulta o requieres más información, por favor responde a este mensaje y con gusto te ayudaremos.
Quedo atento/a. {propietario_titulo} {propietario}`;

// ─── Nombres de meses cortos para formatear vencimiento ───────────────────
const MESES_N = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/**
 * Calcula la fecha de vencimiento ISO a partir de una fecha de inicio ISO
 * y el nombre del plan (usa PLAN_MESES de constants).
 */
export function calcVence(inicioISO, plan) {
  if (!inicioISO) return "";
  const [y, mo, day] = inicioISO.split("-").map(Number);
  const d = new Date(y, mo - 1, day);
  d.setMonth(d.getMonth() + (PLAN_MESES[plan] || 1));
  const yr = d.getFullYear();
  const m2 = String(d.getMonth() + 1).padStart(2, "0");
  const d2 = String(d.getDate()).padStart(2, "0");
  return `${yr}-${m2}-${d2}`;
}

/**
 * Calcula el estado de membresía de un miembro a partir de sus transacciones.
 *
 * @param {string|number} miembroId
 * @param {Array} txs - array global de transacciones
 * @param {Object} miembro - objeto miembro (para congelado, dias_congelados)
 * @returns {{
 *   estado: "Activo"|"Vencido"|"Sin membresía"|"Congelado",
 *   vence: string|null,
 *   inicio: string|null,
 *   plan: string|null,
 *   monto: number|null,
 *   esGratis: boolean,
 *   congelado: boolean,
 *   fechaDescongelar: string|null,
 *   formaPago: string|null,
 * }}
 */
export function getMembershipInfo(miembroId, txs, miembro) {
  const memTxs = txs
    .filter(
      (t) =>
        t.categoria === "Membresías" &&
        (String(t.miembroId) === String(miembroId) ||
          String(t.miembro_id) === String(miembroId))
    )
    .sort((a, b) => {
      const da  = parseDate(a.fecha);
      const db2 = parseDate(b.fecha);
      if (da && db2) return db2 - da;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });

  if (memTxs.length === 0) {
    return {
      estado: "Sin membresía",
      vence: null,
      inicio: null,
      plan: null,
      monto: null,
      esGratis: false,
      congelado: false,
      fechaDescongelar: null,
      formaPago: null,
    };
  }

  const ultima   = memTxs[0];
  const descStr  = ultima.desc || ultima.descripcion || "";
  const esGratis = descStr.includes("Cortesía") || Number(ultima.monto) === 0;

  const planMatch =
    descStr.match(/Renovación (\w+)/) ||
    descStr.match(/(Mensual|Trimestral|Semestral|Anual)/);
  const plan = planMatch ? planMatch[1] : "Mensual";

  const diasCongelados = miembro?.dias_congelados || 0;

  // 1. Prioridad: vencimiento manual guardado en la tx o embebido en desc
  const venceManualISO =
    ultima.vence_manual ||
    (() => {
      const m = descStr.match(/\(vence:(\d{4}-\d{2}-\d{2})\)/);
      return m ? m[1] : null;
    })();

  let vence = null;
  if (venceManualISO) {
    const [vy, vm, vd] = venceManualISO.split("-").map(Number);
    const v = new Date(vy, vm - 1, vd);
    if (diasCongelados > 0) v.setDate(v.getDate() + diasCongelados);
    vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
  } else {
    // 2. Fallback: calcular desde fecha tx + meses del plan
    const v = parseDate(ultima.fecha);
    if (v) {
      const mesesPlan = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
      v.setMonth(v.getMonth() + (mesesPlan[plan] || 1));
      if (diasCongelados > 0) v.setDate(v.getDate() + diasCongelados);
      vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
    }
  }

  const congelado         = !!(miembro?.congelado);
  const fechaDescongelar  = miembro?.fecha_descongelar || null;
  const hoyISO            = new Date().toISOString().split("T")[0];
  const sigueCongelado    = congelado && (!fechaDescongelar || fechaDescongelar > hoyISO);
  const dias              = sigueCongelado ? 999 : (vence ? diasParaVencer(vence) : null);
  const estado            = sigueCongelado
    ? "Congelado"
    : dias !== null && dias >= 0
    ? "Activo"
    : "Vencido";

  // Extraer forma de pago embebida "[Efectivo|Transferencia|Tarjeta]"
  const fpMatch   = (ultima.desc || ultima.descripcion || "").match(
    /\[(Efectivo|Transferencia|Tarjeta)\]/
  );
  const formaPago = fpMatch ? fpMatch[1] : null;

  return {
    estado,
    vence,
    inicio: ultima.fecha,
    plan,
    monto: ultima.monto,
    esGratis,
    congelado: sigueCongelado,
    fechaDescongelar,
    formaPago,
  };
}

/**
 * Construye el mensaje de WhatsApp para recordatorio de membresía.
 * Si diasReales === 1 usa el template de gymConfig (o el default).
 */
export function buildWAMsg(miembro, diasReales, memInfo, gymNombre, gymConfig) {
  const nombre  = miembro.nombre.split(" ")[0];
  const plan    = memInfo?.plan  || "";
  const vence   = memInfo?.vence || "";
  const gym     = gymNombre || "el gimnasio";

  const tplRecordatorio  = gymConfig?.recordatorio_tpl  || DEFAULT_RECORDATORIO_TPL;
  const clabe            = gymConfig?.transferencia_clabe  || "CLABE Interbancaria";
  const titular          = gymConfig?.transferencia_titular || "Nombre del titular";
  const banco            = gymConfig?.transferencia_banco   || "Nombre del banco";
  const propietario      = gymConfig?.propietario_nombre    || gym;
  const propietarioTitulo = gymConfig?.propietario_titulo   || "";

  if (diasReales === 1) {
    return tplRecordatorio
      .replace(/\{nombre\}/gi,             nombre)
      .replace(/\{fecha\}/gi,              vence)
      .replace(/\{clabe\}/gi,              clabe)
      .replace(/\{titular\}/gi,            titular)
      .replace(/\{banco\}/gi,              banco)
      .replace(/\{propietario\}/gi,        propietario)
      .replace(/\{propietario_titulo\}/gi, propietarioTitulo)
      .replace(/\{gym\}/gi,                gym)
      .replace(/\{plan\}/gi,               plan);
  }

  const planStr = plan ? ` *${plan}*` : "";
  if (diasReales === 0)
    return `¡Hola ${nombre}! 🚨 Tu membresía${planStr} en *${gym}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`;
  if (diasReales <= 3)
    return `¡Hola ${nombre}! ⏰ Tu membresía${planStr} vence en *${diasReales} días* (${vence}). No pierdas tu acceso al gym 🔥`;
  return `¡Hola ${nombre}! 👋 Te recordamos que tu membresía${planStr} en *${gym}* vence en *${diasReales} días* (${vence}). ¿Deseas renovarla? 💪`;
}

/**
 * Construye la URL de WhatsApp con número y mensaje pre-llenado.
 */
export function buildWAUrl(tel, msg) {
  const clean = (tel || "").replace(/\D/g, "");
  const phone = clean.startsWith("52") ? clean : `52${clean}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
