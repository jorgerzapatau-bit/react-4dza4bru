// src/utils/tutorUtils.js
// ─── Utilidades para detección de menores y validación de tutor ──────────
// Fase 1: Edad + Tutor (sin clases ni horarios)

import { calcEdad } from "./dateUtils";

export const EDAD_MAYORIA = 18;

/**
 * Determina si un miembro es menor de edad según su fecha de nacimiento.
 *
 * Regla de negocio:
 *  - Si fecha_nacimiento es null/vacío → asumir MAYOR (no rompe flujo actual)
 *  - Si fecha_nacimiento tiene valor   → calcular edad real
 *
 * @param {string|null} fechaNacimiento  ISO "YYYY-MM-DD" o null
 * @returns {boolean}
 */
export function esMenorDeEdad(fechaNacimiento) {
  if (!fechaNacimiento) return false;
  const edad = calcEdad(fechaNacimiento);
  if (edad === null) return false;
  return edad < EDAD_MAYORIA;
}

/**
 * Valida los datos de tutor cuando el miembro es menor de edad.
 *
 * @param {{ tutor_nombre: string, tutor_telefono: string, tutor_parentesco: string }} tutor
 * @returns {{ valido: boolean, errores: Record<string,string> }}
 */
export function validarTutor(tutor) {
  const errores = {};

  if (!tutor.tutor_nombre || tutor.tutor_nombre.trim() === "") {
    errores.tutor_nombre = "El nombre del tutor es obligatorio.";
  }

  if (!tutor.tutor_telefono || tutor.tutor_telefono.trim() === "") {
    errores.tutor_telefono = "El teléfono del tutor es obligatorio.";
  } else if (!validarFormatoTelefono(tutor.tutor_telefono)) {
    errores.tutor_telefono = "Ingresa un teléfono válido (10 dígitos).";
  }

  // tutor_parentesco es opcional → no genera error

  return { valido: Object.keys(errores).length === 0, errores };
}

/**
 * Valida formato básico de teléfono: 10 dígitos (con o sin espacios/guiones).
 */
export function validarFormatoTelefono(tel) {
  if (!tel) return false;
  const solo = tel.replace(/[\s\-().+]/g, "");
  return /^\d{10}$/.test(solo);
}

/**
 * Limpia los campos de tutor de un objeto (útil si el miembro pasa a mayor).
 *
 * @param {object} miembro
 * @returns {object}  copia con tutor_* en null
 */
export function limpiarTutor(miembro) {
  return {
    ...miembro,
    tutor_nombre: null,
    tutor_telefono: null,
    tutor_parentesco: null,
  };
}

/**
 * Extrae campos de tutor de un objeto miembro (para inicializar formularios).
 *
 * @param {object} miembro
 * @returns {{ tutor_nombre: string, tutor_telefono: string, tutor_parentesco: string }}
 */
export function extraerTutor(miembro = {}) {
  return {
    tutor_nombre: miembro.tutor_nombre || "",
    tutor_telefono: miembro.tutor_telefono || "",
    tutor_parentesco: miembro.tutor_parentesco || "",
  };
}
