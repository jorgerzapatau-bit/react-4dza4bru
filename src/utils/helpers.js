// src/utils/helpers.js
// ─── Utilidades generales ─────────────────────────────────────────────────

/**
 * Genera un ID único corto (7 caracteres base-36).
 */
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Copia texto al portapapeles de forma compatible con entornos sin
 * soporte completo de navigator.clipboard.
 */
export function copyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText =
    "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;background:transparent;opacity:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    console.warn("copy failed", e);
  }
  document.body.removeChild(ta);
}
