// src/utils/dateUtils.js
// ─── Todas las utilidades de fecha y formato ───────────────────────────────

/**
 * Formatea un número como moneda MXN: $1,234
 */
export function fmt(n) {
  return "$" + Number(n).toLocaleString("es-MX");
}

/**
 * Retorna la fecha actual como string display: "05 Abr 2026"
 */
export function today() {
  const d = new Date();
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${String(d.getDate()).padStart(2,"0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Retorna la fecha actual como ISO local: "2026-04-05"
 * Usa fecha local (no UTC) para evitar el bug de timezone off-by-one.
 */
export function todayISO() {
  const d = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parsea "DD Mes YYYY" o ISO "YYYY-MM-DD" → Date | null
 */
export function parseDate(str) {
  if (!str || str === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T00:00:00");
  const meses = {
    Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5,
    Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11,
  };
  const parts = str.trim().split(" ");
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const mon = meses[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || mon === undefined || isNaN(year)) return null;
  return new Date(year, mon, day);
}

/**
 * Convierte display "9 Mar 2026" o "06 Mar 2026" → ISO "2026-03-09"
 * Si ya es ISO lo devuelve tal cual.
 */
export function displayToISO(str) {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const MMAP = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    Ene: 1, Abr: 4, Ago: 8, Dic: 12,
  };
  const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return "";
  const y  = m[3];
  const mo = String(MMAP[m[2]] || 1).padStart(2, "0");
  const d  = String(m[1]).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/**
 * Convierte ISO "2026-03-09" → display "9 Mar 2026"
 * Si el string ya tiene formato display lo devuelve tal cual.
 */
export function fmtDate(iso) {
  if (!iso || iso === "—") return "—";
  if (!/^\d{4}-\d{2}/.test(iso)) return iso; // ya es display
  const [y, m, day] = iso.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesNom = meses[parseInt(m) - 1];
  if (!mesNom) return iso;
  return `${parseInt(day)} ${mesNom} ${y}`;
}

/**
 * Días hasta el próximo cumpleaños (0 = hoy, negativo imposible).
 */
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

/**
 * Calcula la edad en años cumplidos a partir de fecha ISO.
 */
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

/**
 * Días hasta el vencimiento de una membresía.
 * Retorna negativo si ya venció, null si no hay fecha.
 */
export function diasParaVencer(venceStr) {
  const vence = parseDate(venceStr);
  if (!vence) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  vence.setHours(0, 0, 0, 0);
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}
