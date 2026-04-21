// ─────────────────────────────────────────────
//  src/utils/communicationHelpers.js
//
//  Utilidades centralizadas para el Centro de Comunicación.
//  Sin dependencias de React — usable en cualquier módulo.
//
//  Exports:
//    replaceTemplateVars(template, vars) → string
//    resolveRecipient(member)            → { name, phone, firstName }
//    buildWhatsappLink(phone, text)      → string
//    copyToClipboard(text)               → Promise<boolean>
//    buildVarsFromMember(member, memInfo, gymConfig) → object
//    mapDiasToTemplateKey(diasReales)    → string
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  replaceTemplateVars
//  Reemplaza {variable} en un template con los valores dados.
//  Case-insensitive, soporta guiones bajos.
//
//  Ejemplo:
//    replaceTemplateVars("Hola {student_name}!", { student_name: "Juan" })
//    → "Hola Juan!"
// ─────────────────────────────────────────────
export function replaceTemplateVars(template, vars = {}) {
  if (!template) return "";
  return template.replace(/\{([a-zA-Z_]+)\}/g, (match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return match; // dejar sin reemplazar si no hay valor
    return String(value);
  });
}

// ─────────────────────────────────────────────
//  resolveRecipient
//  Extrae datos de contacto de un miembro.
//  Busca teléfono en: member.tel → member.tutor_tel → null
// ─────────────────────────────────────────────
export function resolveRecipient(member) {
  if (!member) return { name: "", phone: null, firstName: "" };

  const name      = member.nombre || "";
  const firstName = name.split(" ")[0];

  // Prioridad: teléfono directo → tutor → null
  const phone =
    member.tel          ||
    member.tutor_tel    ||
    member.guardian_tel ||
    null;

  return { name, phone, firstName };
}

// ─────────────────────────────────────────────
//  buildWhatsappLink
//  Genera el link wa.me con número y mensaje codificado.
//  Agrega prefijo 52 (México) si no lo tiene.
// ─────────────────────────────────────────────
export function buildWhatsappLink(phone, text) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, "");
  const withCountry = clean.startsWith("52") ? clean : `52${clean}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text || "")}`;
}

// ─────────────────────────────────────────────
//  copyToClipboard
//  Copia texto al portapapeles.
//  Devuelve Promise<boolean> (true = éxito).
//  Compatible con contextos no-HTTPS (usa fallback).
// ─────────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback para PWA / webview sin clipboard API
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;background:transparent;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.warn("[copyToClipboard] error:", err);
    return false;
  }
}

// ─────────────────────────────────────────────
//  buildVarsFromMember
//  Construye el objeto de variables a partir de un miembro,
//  su info de membresía y la configuración del gimnasio.
//
//  Cubre todas las variables documentadas:
//    {student_name}  {guardian_name}  {amount}     {concept}
//    {due_date}      {event_name}     {event_date} {new_grade}
//    {checkin_time}  {bank}           {clabe}      {titular}
//    {propietario}   {propietario_titulo}
// ─────────────────────────────────────────────
export function buildVarsFromMember(member = {}, memInfo = {}, gymConfig = {}) {
  const firstName = (member.nombre || "").split(" ")[0];

  return {
    // Miembro
    student_name:      firstName,
    guardian_name:     member.tutor_nombre || member.guardian_name || "",

    // Membresía
    amount:            memInfo.monto    || memInfo.amount   || "",
    concept:           memInfo.plan     || memInfo.concept  || "",
    due_date:          memInfo.vence    || memInfo.due_date || "",

    // Eventos / graduaciones (para uso futuro)
    event_name:        "",
    event_date:        "",
    new_grade:         "",
    checkin_time:      "",

    // Datos bancarios del gimnasio
    bank:              gymConfig.transferencia_banco   || "",
    clabe:             gymConfig.transferencia_clabe   || "",
    titular:           gymConfig.transferencia_titular || "",

    // Propietario / firmante
    propietario:       gymConfig.propietario_nombre   || gymConfig.nombre || "",
    propietario_titulo: gymConfig.propietario_titulo  || "",
  };
}

// ─────────────────────────────────────────────
//  mapDiasToTemplateKey
//  Dado el número de días hasta el vencimiento,
//  retorna el template_key apropiado.
//
//  Lógica de negocio centralizada aquí:
//    > 1  → membership_due_soon
//    1    → membership_due_soon  (usa la plantilla larga personalizable)
//    0    → membership_due_today
//    < 0  → membership_overdue
// ─────────────────────────────────────────────
export function mapDiasToTemplateKey(diasReales) {
  if (diasReales === null || diasReales === undefined) return "membership_due_soon";
  if (diasReales > 1)  return "membership_due_soon";
  if (diasReales === 1) return "membership_due_soon";
  if (diasReales === 0) return "membership_due_today";
  if (diasReales === -1 || diasReales === -2) return "membership_last_grace_day";
  return "membership_overdue";
}

// ─────────────────────────────────────────────
//  SYSTEM_TEMPLATE_KEYS
//  Mapa canónico de template_key → metadata UI.
//  Útil para renderizar la lista en "Mensajes del sistema".
// ─────────────────────────────────────────────
export const SYSTEM_TEMPLATE_KEYS = [
  {
    key:          "membership_due_soon",
    name:         "Recordatorio de pago próximo",
    category:     "pagos",
    icon:         "⏰",
    when:         "Días antes del vencimiento (configurable)",
    hasOffset:    true,
  },
  {
    key:          "membership_due_today",
    name:         "Hoy vence tu mensualidad",
    category:     "pagos",
    icon:         "🚨",
    when:         "El día del vencimiento",
    hasOffset:    false,
  },
  {
    key:          "membership_overdue",
    name:         "Pago vencido",
    category:     "pagos",
    icon:         "⚠️",
    when:         "Días después del vencimiento",
    hasOffset:    true,
  },
  {
    key:          "membership_last_grace_day",
    name:         "Último aviso",
    category:     "pagos",
    icon:         "🛑",
    when:         "Último día de gracia",
    hasOffset:    false,
  },
  {
    key:          "welcome_member",
    name:         "Bienvenida a la academia",
    category:     "general",
    icon:         "🎉",
    when:         "Al registrar un nuevo miembro",
    hasOffset:    false,
  },
  {
    key:          "birthday",
    name:         "Feliz cumpleaños",
    category:     "general",
    icon:         "🎂",
    when:         "El día del cumpleaños",
    hasOffset:    false,
  },
  {
    key:          "payment_received",
    name:         "Recibo de colegiatura",
    category:     "pagos",
    icon:         "✅",
    when:         "Al registrar un pago",
    hasOffset:    false,
  },
  {
    key:          "attendance_absence_alert",
    name:         "Inasistencia",
    category:     "asistencia",
    icon:         "👋",
    when:         "Días sin asistencia (configurable)",
    hasOffset:    true,
  },
];
