// ─────────────────────────────────────────────
//  src/hooks/useCommunication.js
//
//  Hook centralizado para leer y actualizar
//  communication_templates y communication_automations
//  desde Supabase.
//
//  Uso:
//    const {
//      templates,       // [] de todos los templates del gym
//      automations,     // [] de las automations del gym
//      loading,
//      getTemplate,     // (template_key) => template | null
//      saveTemplate,    // (id, body_text) => Promise
//      toggleAutomation,// (event_key, is_active) => Promise
//      updateOffset,    // (event_key, days) => Promise
//      resetTemplate,   // (template_key) => Promise  (restaura texto default)
//    } = useCommunication(gymId)
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// Textos predeterminados embebidos para poder hacer "Restaurar"
// sin depender de red. Deben coincidir con el seed SQL.
const DEFAULT_BODIES = {
  membership_due_soon: `Estimado/a {student_name}:\nEspero que estés bien. Te informamos que tu membresía, con vencimiento: {due_date}, ya se encuentra disponible para su pago.\nPodrás pagarla directamente en Recepción o mediante transferencia ({clabe}, {titular}, {bank}).\nAsimismo, queremos recordarte que contamos con un plazo de tolerancia de 2 días para completar el pago. A partir del día 3, se aplicará un 20% adicional. Realizando el pago en tiempo y forma, podrás conservar tu tarifa actual.\nSi tienes alguna consulta o requieres más información, por favor responde a este mensaje y con gusto te ayudaremos.\nQuedo atento/a. {propietario_titulo} {propietario}`,

  membership_due_today: `¡Hola {student_name}! 🚨 Tu membresía en *{concept}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`,

  membership_overdue: `¡Hola {student_name}! ⚠️ Tu membresía en *{concept}* venció el {due_date}. Contáctanos para regularizar tu situación y seguir disfrutando del gym 🏋️`,

  membership_last_grace_day: `¡Hola {student_name}! 🛑 Este es tu último aviso — hoy es el último día de tolerancia para renovar tu membresía. Después de hoy se aplicará el recargo correspondiente. ¡Renueva hoy! 💪`,

  welcome_member: `¡Bienvenido/a {student_name}! 🎉\nEstamos muy contentos de tenerte con nosotros en *{concept}*. Tu membresía está activa y lista para que comiences a entrenar.\n¡Cualquier duda, aquí estamos! 💪`,

  birthday: `🎂 ¡Feliz cumpleaños {student_name}!\nEn *{concept}* te deseamos un día increíble lleno de salud, fuerza y motivación. ¡Sigue siendo una inspiración para todos! 💪🎉`,

  payment_received: `¡Hola {student_name}! ✅ Hemos recibido tu pago de *{amount}* correspondiente a *{concept}*. Tu membresía está al corriente hasta el {due_date}. ¡Gracias! 🏋️`,

  attendance_absence_alert: `¡Hola {student_name}! 👋 Te extrañamos en *{concept}*. Hemos notado que no has asistido últimamente. Si necesitas ayuda o tienes alguna situación especial, con gusto te apoyamos. ¡Esperamos verte pronto! 💪`,
};

// ─────────────────────────────────────────────
//  Supabase REST helpers (sin SDK)
//  Reutiliza el patrón ya existente en el proyecto.
// ─────────────────────────────────────────────
function sbUrl(path) {
  return `${supabase.url}/rest/v1/${path}`;
}

function sbHeaders(extra = {}) {
  return {
    apikey:        supabase.key,
    Authorization: `Bearer ${supabase.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbGet(path) {
  const res = await fetch(sbUrl(path), { headers: sbHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
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

// ─────────────────────────────────────────────
//  Hook principal
// ─────────────────────────────────────────────
export function useCommunication(gymId) {
  const [templates,   setTemplates]   = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // ── Carga inicial ──
  useEffect(() => {
    if (!gymId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [tpls, autos] = await Promise.all([
          sbGet(`communication_templates?gym_id=eq.${gymId}&order=created_at.asc`),
          sbGet(`communication_automations?gym_id=eq.${gymId}&order=created_at.asc`),
        ]);
        if (!cancelled) {
          setTemplates(tpls  || []);
          setAutomations(autos || []);
        }
      } catch (err) {
        console.error("[useCommunication] load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [gymId]);

  // ── getTemplate: busca por template_key ──
  const getTemplate = useCallback((templateKey) => {
    return templates.find(t => t.template_key === templateKey) || null;
  }, [templates]);

  // ── getSystemTemplates: solo scope='system' ──
  const getSystemTemplates = useCallback(() => {
    return templates.filter(t => t.scope === "system");
  }, [templates]);

  // ── getQuickTemplates: plantillas rápidas ──
  const getQuickTemplates = useCallback(() => {
    return templates.filter(t => t.is_quick_template);
  }, [templates]);

  // ── saveTemplate: actualiza body_text de un template ──
  const saveTemplate = useCallback(async (templateId, newBodyText) => {
    try {
      await sbPatch(
        `communication_templates?id=eq.${templateId}&gym_id=eq.${gymId}`,
        { body_text: newBodyText }
      );
      setTemplates(prev =>
        prev.map(t => t.id === templateId ? { ...t, body_text: newBodyText } : t)
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] saveTemplate error:", err);
      return false;
    }
  }, [gymId]);

  // ── resetTemplate: restaura texto predeterminado ──
  const resetTemplate = useCallback(async (templateKey) => {
    const tpl = getTemplate(templateKey);
    if (!tpl) return false;
    const defaultBody = DEFAULT_BODIES[templateKey];
    if (!defaultBody) return false;
    return saveTemplate(tpl.id, defaultBody);
  }, [getTemplate, saveTemplate]);

  // ── toggleAutomation: activa/desactiva una automation ──
  const toggleAutomation = useCallback(async (eventKey, isActive) => {
    const auto = automations.find(a => a.event_key === eventKey);
    if (!auto) return false;
    try {
      await sbPatch(
        `communication_automations?id=eq.${auto.id}&gym_id=eq.${gymId}`,
        { is_active: isActive }
      );
      setAutomations(prev =>
        prev.map(a => a.event_key === eventKey ? { ...a, is_active: isActive } : a)
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] toggleAutomation error:", err);
      return false;
    }
  }, [automations, gymId]);

  // ── updateOffset: cambia días antes del evento ──
  const updateOffset = useCallback(async (eventKey, days) => {
    const auto = automations.find(a => a.event_key === eventKey);
    if (!auto) return false;
    try {
      await sbPatch(
        `communication_automations?id=eq.${auto.id}&gym_id=eq.${gymId}`,
        { trigger_offset_days: days }
      );
      setAutomations(prev =>
        prev.map(a => a.event_key === eventKey ? { ...a, trigger_offset_days: days } : a)
      );
      return true;
    } catch (err) {
      console.error("[useCommunication] updateOffset error:", err);
      return false;
    }
  }, [automations, gymId]);

  return {
    templates,
    automations,
    loading,
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
