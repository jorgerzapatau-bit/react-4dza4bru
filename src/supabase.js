// ══════════════════════════════════════════════
// src/supabase.js — Supabase client + Auth
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://wcyskoithxycvvnkctdv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjeXNrb2l0aHh5Y3Z2bmtjdGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDE5MjAsImV4cCI6MjA4ODQxNzkyMH0.y3DrstdyEAgycz86zELFYjaRhXgNbhbMmtHPjwf9cNM";

// ── Token de sesión activa (se actualiza al login/refresh) ──
let _accessToken = null;

function getAuthHeaders() {
  return {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${_accessToken || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
}

// ══════════════════════════════════════════════
// AUTH — email + password via Supabase Auth REST
// ══════════════════════════════════════════════
export const auth = {
  // ── Iniciar sesión ──
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      return { user: null, session: null, error: data.error_description || data.msg || "Credenciales incorrectas" };
    }
    _accessToken = data.access_token;
    _saveSession(data);
    return { user: data.user, session: data, error: null };
  },

  // ── Cerrar sesión ──
  async signOut() {
    const token = _accessToken;
    _accessToken = null;
    _clearSession();
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
      }).catch(() => {});
    }
  },

  // ── Recuperar sesión guardada en localStorage ──
  async getSession() {
    try {
      const raw = localStorage.getItem("gymfit_session");
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.access_token || !session?.expires_at) return null;

      // Verificar si el token sigue vigente (con 60s de margen)
      const expiresAt = session.expires_at * 1000;
      if (Date.now() > expiresAt - 60000) {
        // Intentar refresh
        const refreshed = await auth.refreshSession(session.refresh_token);
        return refreshed;
      }
      _accessToken = session.access_token;
      return session;
    } catch(e) {
      return null;
    }
  },

  // ── Refrescar token ──
  async refreshSession(refreshToken) {
    if (!refreshToken) return null;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!r.ok) {
        _clearSession();
        return null;
      }
      const data = await r.json();
      _accessToken = data.access_token;
      _saveSession(data);
      return data;
    } catch(e) {
      return null;
    }
  },

  // ── Enviar email de recuperación de contraseña ──
  async resetPassword(email) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return r.ok;
  },
};

function _saveSession(session) {
  try { localStorage.setItem("gymfit_session", JSON.stringify(session)); } catch(e) {}
}
function _clearSession() {
  try { localStorage.removeItem("gymfit_session"); } catch(e) {}
}

// ══════════════════════════════════════════════
// GYM_USERS — asociación usuario <-> gym
// ══════════════════════════════════════════════
export async function getUserGymId(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/gym_users?user_id=eq.${userId}&select=gym_id&limit=1`,
    { headers: getAuthHeaders() }
  );
  if (!r.ok) return null;
  const data = await r.json();
  return data[0]?.gym_id || null;
}

// ══════════════════════════════════════════════
// SUPABASE CLIENT — igual que antes, pero usando
// el token de sesión del usuario logueado
// ══════════════════════════════════════════════
export const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,

  async from(table) {
    const base = `${SUPABASE_URL}/rest/v1/${table}`;

    return {
      select: async (gymId, extra = "") => {
        const url = `${base}?gym_id=eq.${gymId}${extra}&order=created_at.asc`;
        const r = await fetch(url, { headers: getAuthHeaders() });
        return r.ok ? r.json() : [];
      },
      selectColumns: async (gymId, columns, extra = "") => {
        const url = `${base}?gym_id=eq.${gymId}${extra}&order=created_at.asc&select=${columns}`;
        const r = await fetch(url, { headers: { ...getAuthHeaders(), "Accept": "application/json" } });
        return r.ok ? r.json() : [];
      },
      selectOne: async (id) => {
        const url = `${base}?id=eq.${id}`;
        const r = await fetch(url, { headers: getAuthHeaders() });
        const data = await r.json();
        return data[0] || null;
      },
      insert: async (body) => {
        console.log("📤 INSERT", table, JSON.stringify(body));
        const r = await fetch(base, {
          method: "POST",
          headers: getAuthHeaders(),
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
      update: async (id, body) => {
        console.log("📤 UPDATE", table, id, JSON.stringify(body));
        const r = await fetch(`${base}?id=eq.${id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          console.error("❌ UPDATE FAILED", table, r.status, JSON.stringify(err));
        }
        return r.ok;
      },
      delete: async (id) => {
        const r = await fetch(`${base}?id=eq.${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        return r.ok;
      },
    };
  },

  async getGym(gymId) {
    const url = `${SUPABASE_URL}/rest/v1/gimnasios?id=eq.${gymId}`;
    const r = await fetch(url, { headers: getAuthHeaders() });
    const data = await r.json();
    return data[0] || null;
  },

  async saveGym(gym) {
    const url = `${SUPABASE_URL}/rest/v1/gimnasios?id=eq.${gym.id}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: getAuthHeaders(),
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
    try { localStorage.setItem("gymfit_gym_id", fromUrl); } catch(e) {}
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem("gymfit_gym_id");
    if (saved) return saved;
  } catch(e) {}
  return null;
}
