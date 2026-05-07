// ─────────────────────────────────────────────
//  utils/constants.js
//  Constantes globales, funciones puras de fecha
//  y utilidades de membresía / WhatsApp.
//  No importa React — puede usarse en cualquier módulo.
// ─────────────────────────────────────────────

// ── Formateo de moneda ──
export function fmt(n) {
  return "$" + Number(n).toLocaleString("es-MX");
}

// ── Fecha de hoy en formato "DD Mes YYYY" ──
export function today() {
  const d = new Date();
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${String(d.getDate()).padStart(2,"0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Genera ID corto aleatorio ──
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Copia texto al portapapeles ──
export function copyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;background:transparent;opacity:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); } catch(e) { console.warn("copy failed", e); }
  document.body.removeChild(ta);
}

// ── Parse "DD Mes YYYY" o ISO "YYYY-MM-DD" → Date ──
export function parseDate(str) {
  if (!str || str === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T00:00:00");
  const meses = {
    "Ene": 0, "Feb": 1, "Mar": 2, "Abr": 3, "May": 4, "Jun": 5,
  // "Jul": 6, "Ago": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dic": 11, // duplicate removed
  };
  const parts = str.trim().split(" ");
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const mon = meses[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || mon === undefined || isNaN(year)) return null;
  return new Date(year, mon, day);
}

// ── Días hasta el próximo cumpleaños ──
export function diasParaCumple(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const nac = new Date(fechaNac + "T00:00:00");
  if (isNaN(nac)) return null;
  const cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (cumple < hoy) cumple.setFullYear(hoy.getFullYear() + 1);
  return Math.round((cumple - hoy) / (1000 * 60 * 60 * 24));
}

// ── Edad en años ──
export function calcEdad(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac + "T00:00:00");
  if (isNaN(nac)) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// ── Días hasta vencimiento (negativo = ya venció) ──
export function diasParaVencer(venceStr) {
  const vence = parseDate(venceStr);
  if (!vence) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  vence.setHours(0, 0, 0, 0);
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

// ── Fecha de hoy en ISO "YYYY-MM-DD" (hora local, no UTC) ──
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Calcula fecha de vencimiento según plan ──
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

// ── Convierte "9 Mar 2026" → "2026-03-09" ──
export function displayToISO(str) {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const MMAP = {
    Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
    Ene:1, Abr:4, Ago:8, Dic:12,
  };
  const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return "";
  const y = m[3], mo = String(MMAP[m[2]] || 1).padStart(2,"0"), d = String(m[1]).padStart(2,"0");
  return `${y}-${mo}-${d}`;
}

// ── Formatea ISO "2026-03-09" → "9 Mar 2026" ──
export function fmtDate(iso) {
  if (!iso || iso === "—") return "—";
  if (!/^\d{4}-\d{2}/.test(iso)) return iso; // Ya formateado
  const [y, m, day] = iso.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesNom = meses[parseInt(m) - 1];
  if (!mesNom) return iso;
  return `${parseInt(day)} ${mesNom} ${y}`;
}

// ─────────────────────────────────────────────
//  PLANES Y CATEGORÍAS
// ─────────────────────────────────────────────

export const DEFAULT_PLANES = [
  { nombre: "Mensual",    meses: 1,  precio: 850,  activo: true  },
  { nombre: "Trimestral", meses: 3,  precio: 2200, activo: false },
  { nombre: "Semestral",  meses: 6,  precio: 3900, activo: false },
  { nombre: "Anual",      meses: 12, precio: 7500, activo: false },
];

export const PLANES      = DEFAULT_PLANES.map(p => p.nombre);
export const PLAN_PRECIO = Object.fromEntries(DEFAULT_PLANES.map(p => [p.nombre, p.precio]));
export const PLAN_MESES  = Object.fromEntries(DEFAULT_PLANES.map(p => [p.nombre, p.meses]));

export const CAT_ING = ["Membresías", "Clases extras", "Tienda", "Personal trainer", "Otro"];
export const CAT_GAS = ["Nómina", "Renta", "Servicios", "Mantenimiento", "Insumos", "Otro"];
export const CAT_ICON = {
  "Membresías": "👥", "Clases extras": "🏋️", "Tienda": "🛍️", "Personal trainer": "💪",
  "Nómina": "👔", "Renta": "🏢", "Servicios": "⚡", "Mantenimiento": "🔧",
  "Insumos": "📦", "Otro": "📝",
};

export const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ─────────────────────────────────────────────
//  MEMBRESÍAS
// ─────────────────────────────────────────────

/**
 * Calcula la info de membresía activa de un miembro
 * a partir de sus transacciones.
 */
export function getMembershipInfo(miembroId, txs, miembro) {
  const memTxs = txs
    .filter(t =>
      t.categoria === "Membresías" &&
      (String(t.miembroId) === String(miembroId) || String(t.miembro_id) === String(miembroId))
    )
    .sort((a, b) => {
      const da = parseDate(a.fecha);
      const db = parseDate(b.fecha);
      if (da && db) return db - da;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });

  if (memTxs.length === 0) {
    return { estado: "Sin membresía", vence: null, inicio: null, plan: null, monto: null, esGratis: false, congelado: false };
  }

  const ultima    = memTxs[0];
  const descStr   = ultima.desc || ultima.descripcion || "";
  const esGratis  = descStr.includes("Cortesía") || Number(ultima.monto) === 0;
  const planMatch =
    descStr.match(/Renovaci[oó]n ([^-[]+?)(?:\s+-|\s+\[)/) ||
    descStr.match(/Renovaci[oó]n ([\w][\w\s]*)/) ||
    descStr.match(/(Mensual|Trimestral|Semestral|Anual)/);
  const plan = planMatch ? planMatch[1].trim() : null;
  const MESES_N   = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const diasCongelados = miembro?.dias_congelados || 0;

  let vence = null;

  // 1. Prioridad: fecha manual guardada en la transacción
  const venceManualISO = ultima.vence_manual || (() => {
    const m = descStr.match(/\(vence:(\d{4}-\d{2}-\d{2})\)/);
    return m ? m[1] : null;
  })();

  if (venceManualISO) {
    const [vy, vm, vd] = venceManualISO.split("-").map(Number);
    const v = new Date(vy, vm - 1, vd);
    if (diasCongelados > 0) v.setDate(v.getDate() + diasCongelados);
    vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
  } else {
    // 2. Fallback: fecha de tx + meses del plan
    const v = parseDate(ultima.fecha);
    if (v) {
      const mesesPlan = { "Mensual": 1, "Trimestral": 3, "Semestral": 6, "Anual": 12 };
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
  const estado            = sigueCongelado ? "Congelado" : (dias !== null && dias >= 0 ? "Activo" : "Vencido");

  const fpMatch    = (ultima.desc || ultima.descripcion || "").match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
  const formaPago  = fpMatch ? fpMatch[1] : null;

  return { estado, vence, inicio: ultima.fecha, plan, monto: ultima.monto, esGratis, congelado: sigueCongelado, fechaDescongelar, formaPago };
}

// ─────────────────────────────────────────────
//  WHATSAPP
// ─────────────────────────────────────────────

export const DEFAULT_RECORDATORIO_TPL =
`Estimado/a {nombre}:
Espero que estés bien. Te informamos que tu membresía, con vencimiento: {fecha}, ya se encuentra disponible para su pago.
Podrás pagarla directamente en Recepción o mediante transferencia ({clabe}, {titular}, {banco}).
Asimismo, queremos recordarte que contamos con un plazo de tolerancia de 2 días para completar el pago. A partir del día 3, se aplicará un 20% adicional. Realizando el pago en tiempo y forma, podrás conservar tu tarifa actual.
Si tienes alguna consulta o requieres más información, por favor responde a este mensaje y con gusto te ayudaremos.
Quedo atento/a. {propietario_titulo} {propietario}`;

export function buildWAMsg(miembro, diasReales, memInfo, gymNombre, gymConfig) {
  const nombre  = miembro.nombre.split(" ")[0];
  const plan    = memInfo?.plan  || "";
  const vence   = memInfo?.vence || "";
  const gym     = gymNombre || "el gimnasio";

  const tplRecordatorio  = gymConfig?.recordatorio_tpl    || DEFAULT_RECORDATORIO_TPL;
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
  if (diasReales === 0) return `¡Hola ${nombre}! 🚨 Tu membresía${planStr} en *${gym}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`;
  if (diasReales <= 3)  return `¡Hola ${nombre}! ⏰ Tu membresía${planStr} vence en *${diasReales} días* (${vence}). No pierdas tu acceso al gym 🔥`;
  return `¡Hola ${nombre}! 👋 Te recordamos que tu membresía${planStr} en *${gym}* vence en *${diasReales} días* (${vence}). ¿Deseas renovarla? 💪`;
}

export function buildWAUrl(tel, msg) {
  const clean = (tel || "").replace(/\D/g, "");
  const phone = clean.startsWith("52") ? clean : `52${clean}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ─────────────────────────────────────────────
//  MODO DOJO — Categorías y helpers
// ─────────────────────────────────────────────

export const CAT_ING_DOJO = [
  "Mensualidades",
  "Exámenes de cinturón",
  "Torneos",
  "Equipamiento",
  "Clases especiales",
  "Otro",
];

export const CAT_GAS_DOJO = [
  "Nómina",
  "Renta",
  "Servicios",
  "Mantenimiento",
  "Insumos",
  "Equipamiento",
  "Otro",
];

export const CAT_ICON_DOJO = {
  "Mensualidades":        "🥋",
  "Exámenes de cinturón": "🏅",
  "Torneos":              "🏆",
  "Equipamiento":         "👊",
  "Clases especiales":    "⭐",
  "Nómina":               "👔",
  "Renta":                "🏢",
  "Servicios":            "⚡",
  "Mantenimiento":        "🔧",
  "Insumos":              "📦",
  "Otro":                 "📝",
};

// Grados del karate (orden ascendente de blanco a negro)
export const GRADOS_KARATE = [
  { nombre: "Blanco",           kyu: 9,  color: "var(--text-inverse)", emoji: "⬜" },
  { nombre: "Amarillo",         kyu: 8,  color: "var(--col-warning)", emoji: "🟨" },
  { nombre: "Naranja",          kyu: 7,  color: "var(--col-warning)", emoji: "🟧" },
  { nombre: "Verde",            kyu: 6,  color: "var(--col-success)", emoji: "🟩" },
  { nombre: "Azul",             kyu: 5,  color: "var(--col-accent)", emoji: "🟦" },
  { nombre: "Morado",           kyu: 4,  color: "#a855f7", emoji: "🟪" },
  { nombre: "Café (3er kyu)",   kyu: 3,  color: "var(--col-warning)", emoji: "🟫" },
  { nombre: "Café (2do kyu)",   kyu: 2,  color: "var(--col-warning)", emoji: "🟫" },
  { nombre: "Café (1er kyu)",   kyu: 1,  color: "var(--col-danger)", emoji: "🟫" },
  { nombre: "Negro (1er dan)",  kyu: -1, color: "var(--bg-card)", emoji: "⬛" },
  { nombre: "Negro (2do dan)",  kyu: -2, color: "var(--bg-card)", emoji: "⬛" },
  { nombre: "Negro (3er dan)",  kyu: -3, color: "var(--bg-card)", emoji: "⬛" },
  { nombre: "Negro (4to dan)",  kyu: -4, color: "var(--bg-card)", emoji: "⬛" },
  { nombre: "Negro (5to dan)",  kyu: -5, color: "var(--bg-card)", emoji: "⬛" },
];

export const GRADOS_NOMBRES = GRADOS_KARATE.map(g => g.nombre);

export function getGradoInfo(gradoNombre) {
  return GRADOS_KARATE.find(g => g.nombre === gradoNombre) || GRADOS_KARATE[0];
}

// Helper para saber si el negocio es un DOJO
export function getIsDojo(gymConfig) {
  return gymConfig?.tipo_negocio === "dojo";
}

// Retorna las categorías correctas según el tipo de negocio
export function getCatIng(gymConfig) {
  return getIsDojo(gymConfig) ? CAT_ING_DOJO : CAT_ING;
}
export function getCatGas(gymConfig) {
  return getIsDojo(gymConfig) ? CAT_GAS_DOJO : CAT_GAS;
}
export function getCatIcon(gymConfig) {
  return getIsDojo(gymConfig) ? CAT_ICON_DOJO : CAT_ICON;
}

// Template de recordatorio para DOJO
export const DEFAULT_RECORDATORIO_DOJO_TPL =
`Estimado/a {nombre}:\nEspero que estés bien. Te informamos que tu membresía en el Dojo *{gym}*, con vencimiento: {fecha}, está disponible para pago.\nPodrás pagar directamente en el Dojo o mediante transferencia ({clabe}, {titular}, {banco}).\nSeguir entrenando sin interrupciones es importante para tu progreso en el camino del Karate 🥋\nSi tienes alguna duda, responde a este mensaje.\n{propietario_titulo} {propietario}`;
