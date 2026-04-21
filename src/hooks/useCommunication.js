// ─────────────────────────────────────────────
//  src/hooks/useCommunication.js  —  v2
//
//  CAMBIO PRINCIPAL: si la tabla no existe o hay
//  cualquier error de red/DB, carga los textos
//  DEFAULT_BODIES embebidos y continúa funcionando
//  sin quedarse cargando infinitamente.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// ─── Textos predeterminados (fuente de verdad offline) ───────────
export const DEFAULT_BODIES = {
  membership_due_soon:
    `Estimado/a {student_name}:\nEspero que estés bien. Te informamos que tu membresía, con vencimiento: {due_date}, ya se encuentra disponible para su pago.\nPodrás pagarla directamente en Recepción o mediante transferencia ({clabe}, {titular}, {bank}).\nAsimismo, queremos recordarte que contamos con un plazo de tolerancia de 2 días para completar el pago. A partir del día 3, se aplicará un 20% adicional. Realizando el pago en tiempo y forma, podrás conservar tu tarifa actual.\nSi tienes alguna consulta o requieres más información, por favor responde a este mensaje y con gusto te ayudaremos.\nQuedo atento/a. {propietario_titulo} {propietario}`,

  membership_due_today:
    `¡Hola {student_name}! 🚨 Tu membresía en *{concept}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`,

  membership_overdue:
    `¡Hola {student_name}! ⚠️ Tu membresía en *{concept}* venció el {due_date}. Contáctanos para regularizar tu situación y seguir disfrutando del gym 🏋️`,

  membership_last_grace_day:
    `¡Hola {student_name}! 🛑 Este es tu último aviso — hoy es el último día de tolerancia para renovar tu membresía. Después de hoy se aplicará el recargo correspondiente. ¡Renueva hoy! 💪`,

  welcome_member:
    `¡Bienvenido/a {student_name}! 🎉\nEstamos muy contentos de tenerte con nosotros en *{concept}*. Tu membresía está activa y lista para que comiences a entrenar.\n¡Cualquier duda, aquí estamos! 💪`,

  birthday:
    `🎂 ¡Feliz cumpleaños {student_name}!\nEn *{concept}* te deseamos un día increíble lleno de salud, fuerza y motivación. ¡Sigue siendo una inspiración para todos! 💪🎉`,

  payment_received:
    `¡Hola {student_name}! ✅ Hemos recibido tu pago de *{amount}* correspondiente a *{concept}*. Tu membresía está al corriente hasta el {due_date}. ¡Gracias! 🏋️`,

  attendance_absence_alert:
    `¡Hola {student_name}! 👋 Te extrañamos en *{concept}*. Hemos notado que no has asistido últimamente. Si necesitas ayuda o tienes alguna situación especial, con gusto te apoyamos. ¡Esperamos verte pronto! 💪`,
};

const DEFAULT_NAMES = {
  membership_due_soon:       "Recordatorio de pago próximo",
  membership_due_today:      "Hoy vence tu mensualidad",
  membership_overdue:        "Pago vencido",
  membership_last_grace_day: "Último aviso",
  welcome_member:            "Bienvenida a la academia",
  birthday:                  "Feliz cumpleaños",
  payment_received:          "Recibo de colegiatura",
  attendance_absence_alert:  "Inasistencia",
};

// Genera templates "virtuales" desde DEFAULT_BODIES
// para que el hook devuelva datos aunque la DB no exista
function buildOfflineTemplates(gymId) {
  return Object.entries(DEFAULT_BODIES).map(([key, body]) => ({
    id:                `offline-${key}`,
    gym_id:            gymId || "offline",
    scope:             "system",
    template_key:      key,
    name:              DEFAULT_NAMES[key] || key,
    body_text:         body,
    is_active:         true,
    is_editable:       true,
    is_quick_template: false,
  }));
}

function buildOfflineAutomations(gymId) {
  const defaults = {
    membership_due_soon:       { is_active: true,  offset: 1 },
    membership_due_today:      { is_active: true,  offset: 0 },
    membership_overdue:        { is_active: false, offset: -1 },
    membership_last_grace_day: { is_active: false, offset: -2 },
    welcome_member:            { is_active: false, offset: 0 },
    birthday:                  { is_active: false, offset: 0 },
    payment_received:          { is_active: false, offset: 0 },
    attendance_absence_alert:  { is_active: false, offset: 0 },
  };
  return Object.entries(defaults).map(([key, cfg]) => ({
    id:                  `offline-auto-${key}`,
    gym_id:              gymId || "offline",
    event_key:           key,
    name:                DEFAULT_NAMES[key] || key,
    is_active:           cfg.is_active,
    trigger_offset_days: cfg.offset,
    template_id:         `offline-${key}`,
  }));
}

// ─── Supabase REST helpers ────────────────────────────────────────
function sbUrl(path) {
  return `${supabase.url}/rest/v1/${path}`;
}

function sbHeaders(extra = {}) {
  return {
    apikey:         supabase.key,
    Authorization:  `Bearer ${supabase.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet(path) {
  const res = await fetch(sbUrl(path), { headers: sbHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(sbUrl(path), {
    method:  "PATCH",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

// ─── Hook principal ───────────────────────────────────────────────
export function useCommunication(gymId) {
  const [templates,   setTemplates]   = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);

  useEffect(() => {
    // Sin gymId: cargar defaults inmediatamente, sin esperar
    if (!gymId) {
      setTemplates(buildOfflineTemplates(null));
      setAutomations(buildOfflineAutomations(null));
      setDbAvailable(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [tpls, autos] = await Promise.all([
          sbGet(`communication_templates?gym_id=eq.${gymId}&order=created_at.asc`),
          sbGet(`communication_automations?gym_id=eq.${gymId}&order=created_at.asc`),
        ]);

        if (cancelled) return;

        if (!tpls || tpls.length === 0) {
          // Tablas existen pero vacías → usar defaults
          console.warn("[useCommunication] Sin datos en DB — usando defaults. Ejecuta: SELECT seed_communication_templates('" + gymId + "');");
          setTemplates(buildOfflineTemplates(gymId));
          setAutomations(buildOfflineAutomations(gymId));
          setDbAvailable(false);
        } else {
          setTemplates(tpls);
          setAutomations(autos || []);
          setDbAvailable(true);
        }
      } catch (err) {
        // Error de red o tabla inexistente → modo offline con defaults
        console.warn("[useCommunication] Error (tabla no creada o sin red) — modo offline:", err.message);
        if (!cancelled) {
          setTemplates(buildOfflineTemplates(gymId));
          setAutomations(buildOfflineAutomations(gymId));
          setDbAvailable(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [gymId]);

  // ── getTemplate ───────────────────────────────────────────────
  const getTemplate = useCallback((templateKey) => {
    return templates.find(t => t.template_key === templateKey) || null;
  }, [templates]);

  const getSystemTemplates = useCallback(() => {
    return templates.filter(t => t.scope === "system");
  }, [templates]);

  const getQuickTemplates = useCallback(() => {
    return templates.filter(t => t.is_quick_template);
  }, [templates]);

  // ── saveTemplate: guarda en DB si disponible, siempre en local ─
  const saveTemplate = useCallback(async (templateId, newBodyText) => {
    // Optimistic local update
    setTemplates(prev =>
      prev.map(t => t.id === templateId ? { ...t, body_text: newBodyText } : t)
    );

    const isOffline = !dbAvailable || String(templateId).startsWith("offline-");
    if (isOffline) return true; // cambio solo local

    try {
      await sbPatch(
        `communication_templates?id=eq.${templateId}&gym_id=eq.${gymId}`,
        { body_text: newBodyText }
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] saveTemplate error:", err);
      return false;
    }
  }, [gymId, dbAvailable]);

  // ── resetTemplate ─────────────────────────────────────────────
  const resetTemplate = useCallback(async (templateKey) => {
    const tpl         = getTemplate(templateKey);
    const defaultBody = DEFAULT_BODIES[templateKey];
    if (!defaultBody) return false;

    // Optimistic
    setTemplates(prev =>
      prev.map(t => t.template_key === templateKey ? { ...t, body_text: defaultBody } : t)
    );

    if (!tpl || !dbAvailable || String(tpl.id).startsWith("offline-")) return true;

    try {
      await sbPatch(
        `communication_templates?id=eq.${tpl.id}&gym_id=eq.${gymId}`,
        { body_text: defaultBody }
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] resetTemplate error:", err);
      return false;
    }
  }, [getTemplate, gymId, dbAvailable]);

  // ── toggleAutomation ──────────────────────────────────────────
  const toggleAutomation = useCallback(async (eventKey, isActive) => {
    // Optimistic
    setAutomations(prev =>
      prev.map(a => a.event_key === eventKey ? { ...a, is_active: isActive } : a)
    );

    const auto = automations.find(a => a.event_key === eventKey);
    if (!auto || !dbAvailable || String(auto.id).startsWith("offline-")) return true;

    try {
      await sbPatch(
        `communication_automations?id=eq.${auto.id}&gym_id=eq.${gymId}`,
        { is_active: isActive }
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] toggleAutomation error:", err);
      return false;
    }
  }, [automations, gymId, dbAvailable]);

  // ── updateOffset ──────────────────────────────────────────────
  const updateOffset = useCallback(async (eventKey, days) => {
    // Optimistic
    setAutomations(prev =>
      prev.map(a => a.event_key === eventKey ? { ...a, trigger_offset_days: days } : a)
    );

    const auto = automations.find(a => a.event_key === eventKey);
    if (!auto || !dbAvailable || String(auto.id).startsWith("offline-")) return true;

    try {
      await sbPatch(
        `communication_automations?id=eq.${auto.id}&gym_id=eq.${gymId}`,
        { trigger_offset_days: days }
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] updateOffset error:", err);
      return false;
    }
  }, [automations, gymId, dbAvailable]);

  return {
    templates,
    automations,
    loading,
    dbAvailable,       // true = datos de Supabase, false = modo offline con defaults
    getTemplate,
    getSystemTemplates,
    getQuickTemplates,
    saveTemplate,
    resetTemplate,
    toggleAutomation,
    updateOffset,
    DEFAULT_BODIES,
  };
}
