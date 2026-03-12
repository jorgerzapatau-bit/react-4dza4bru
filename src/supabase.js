// ══════════════════════════════════════════════
// src/supabase.js — Configuración de Supabase
// ══════════════════════════════════════════════
// INSTRUCCIONES:
// 1. Ve a supabase.com → tu proyecto → Settings → API
// 2. Copia "Project URL" y "anon public" key
// 3. Pégalos aquí abajo

const SUPABASE_URL = "https://wcyskoithxycvvnkctdv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjeXNrb2l0aHh5Y3Z2bmtjdGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDE5MjAsImV4cCI6MjA4ODQxNzkyMH0.y3DrstdyEAgycz86zELFYjaRhXgNbhbMmtHPjwf9cNM";

// ── Cliente Supabase (sin instalar paquete, usa fetch directo) ──
export const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,

  async from(table) {
    const base = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    return {
      // SELECT (all columns)
      select: async (gymId, extra = "") => {
        const url = `${base}?gym_id=eq.${gymId}${extra}&order=created_at.asc`;
        const r = await fetch(url, { headers });
        return r.ok ? r.json() : [];
      },
      // SELECT with specific columns (for large tables with photos)
      selectColumns: async (gymId, columns, extra = "") => {
        const url = `${base}?gym_id=eq.${gymId}${extra}&order=created_at.asc&select=${columns}`;
        const r = await fetch(url, { headers: { ...headers, "Accept": "application/json" } });
        return r.ok ? r.json() : [];
      },
      // SELECT single by id
      selectOne: async (id) => {
        const url = `${base}?id=eq.${id}`;
        const r = await fetch(url, { headers });
        const data = await r.json();
        return data[0] || null;
      },
      // INSERT
      insert: async (body) => {
        console.log("📤 INSERT", table, JSON.stringify(body));
        const r = await fetch(base, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok) {
          console.error("❌ INSERT FAILED", table, r.status, JSON.stringify(data));
          return null;
        }
        console.log("✅ INSERT OK", table, JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      },
      // UPDATE
      update: async (id, body) => {
        console.log("📤 UPDATE", table, id, JSON.stringify(body));
        const r = await fetch(`${base}?id=eq.${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          console.error("❌ UPDATE FAILED", table, r.status, JSON.stringify(err));
        }
        return r.ok;
      },
      // DELETE
      delete: async (id) => {
        const r = await fetch(`${base}?id=eq.${id}`, {
          method: "DELETE",
          headers,
        });
        return r.ok;
      },
    };
  },

  // Cargar config del gimnasio
  async getGym(gymId) {
    const url = `${SUPABASE_URL}/rest/v1/gimnasios?id=eq.${gymId}`;
    const r = await fetch(url, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    const data = await r.json();
    return data[0] || null;
  },

  // Guardar config del gimnasio (upsert)
  async saveGym(gym) {
    const url = `${SUPABASE_URL}/rest/v1/gimnasios?id=eq.${gym.id}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gym),
    });
    return r.ok;
  },
};

// ── GYM ID: lee desde URL ?gym=xxx, si no hay lo recupera de localStorage ──
export function getGymId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("gym");
  if (fromUrl) {
    // Guardar en localStorage para cuando abra como PWA sin parámetro
    try { localStorage.setItem("gymfit_gym_id", fromUrl); } catch(e) {}
    return fromUrl;
  }
  // Fallback: usar el gym guardado (útil cuando se abre desde ícono PWA)
  try {
    const saved = localStorage.getItem("gymfit_gym_id");
    if (saved) return saved;
  } catch(e) {}
  return null;
}
