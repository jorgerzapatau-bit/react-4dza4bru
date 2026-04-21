// src/modals/MemberQRTab.jsx

import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { copyToClipboard } from "../utils/helpers";

const MEMBER_PAGE_BASE = `${window.location.origin}/member`;

// ── Carga qrcodejs desde CDN de forma segura ──
function loadQRScript() {
  return new Promise((resolve) => {
    if (window.QRCode) { resolve(true); return; }
    const existing = document.querySelector('script[data-qrcode]');
    if (existing) {
      const check = setInterval(() => {
        if (window.QRCode) { clearInterval(check); resolve(true); }
      }, 50);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.setAttribute("data-qrcode", "1");
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

/* ─── Genera o recupera el qr_token del miembro ─── */
async function ensureQrToken(miembro, onUpdate) {
  if (miembro.qr_token) return miembro.qr_token;

  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  // ⚠️ Tu supabase.from() es async — hay que hacer await primero
  const tb = await supabase.from("miembros");
  const ok = await tb.update(miembro.id, { qr_token: token });
  if (!ok) console.error("No se pudo guardar qr_token en Supabase");

  onUpdate?.({ ...miembro, qr_token: token });
  return token;
}

/* ─── QR Canvas ─── */
function QRCanvas({ url }) {
  const ref = useRef(null);
  const [scriptReady, setScriptReady] = useState(!!window.QRCode);

  useEffect(() => {
    if (scriptReady) return;
    loadQRScript().then((ok) => setScriptReady(ok));
  }, []);

  useEffect(() => {
    if (!scriptReady || !ref.current || !url) return;
    ref.current.innerHTML = "";
    try {
      new window.QRCode(ref.current, {
        text: url,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H,
      });
    } catch (e) {
      console.error("QRCode render error:", e);
    }
  }, [scriptReady, url]);

  if (!scriptReady) {
    return (
      <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>
        Cargando…
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        padding: 14,
        borderRadius: 18,
        display: "inline-flex",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
      }}
    />
  );
}

/* ─── Descarga el QR como PNG ─── */
function downloadQR(memberName) {
  const canvas = document.querySelector("#qr-wrap canvas");
  if (!canvas) { alert("El QR aún no está listo, espera un momento."); return; }
  const link = document.createElement("a");
  link.download = `QR_${memberName.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function MemberQRTab({ m, gymId, onMemberUpdate, darkMode }) {
  const [token, setToken]         = useState(m.qr_token || null);
  const [loading, setLoading]     = useState(!m.qr_token);
  const [error, setError]         = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [regenerating, setReg]    = useState(false);

  const memberUrl = token
    ? `${MEMBER_PAGE_BASE}?token=${token}&gym=${gymId}`
    : null;

  const runEnsure = () => {
    setError(null);
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const t = await ensureQrToken(m, onMemberUpdate);
        if (!cancelled) { setToken(t); setLoading(false); }
      } catch (e) {
        console.error("ensureQrToken error:", e);
        if (!cancelled) {
          setError("No se pudo generar el QR: " + (e?.message || String(e)));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  };

  useEffect(() => {
    if (token) { setLoading(false); return; }
    return runEnsure();
  }, []); // eslint-disable-line

  const handleCopyUrl = () => {
    if (!memberUrl) return;
    copyToClipboard(memberUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownload = () => downloadQR(m.nombre);

  const handleRegenerate = async () => {
    if (!window.confirm("¿Regenerar el QR? El código anterior dejará de funcionar.")) return;
    setReg(true);
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    try {
      const tb = await supabase.from("miembros");
      await tb.update(m.id, { qr_token: newToken });
    } catch (e) {
      console.error("Regenerate error:", e);
    }
    setToken(newToken);
    onMemberUpdate?.({ ...m, qr_token: newToken });
    setReg(false);
  };

  const bg     = darkMode ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)";
  const border = darkMode ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)";
  const muted  = darkMode ? "#64748b" : "#94a3b8";
  const text   = darkMode ? "#e2e8f0" : "#1e293b";
  const cardBg = darkMode ? "#111427" : "#f8fafc";

  /* ── Loading ── */
  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        border: "3px solid rgba(108,99,255,.2)", borderTopColor: "#6c63ff",
        animation: "spin .8s linear infinite", margin: "0 auto 14px",
      }} />
      <p style={{ color: muted, fontSize: 13 }}>Generando código QR…</p>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      <p style={{ fontSize: 32, marginBottom: 10 }}>⚠️</p>
      <p style={{ color: "#f43f5e", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</p>
      <button
        onClick={runEnsure}
        style={{
          marginTop: 16, padding: "10px 20px", border: "none", borderRadius: 12,
          background: "#6c63ff", color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Reintentar
      </button>
    </div>
  );

  const displayId = `DZ-${String(m.id).padStart(4, "0")}`;

  return (
    <div style={{ paddingBottom: 8 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── QR Card ── */}
      <div style={{
        background: bg, border: `1px solid ${border}`,
        borderRadius: 24, padding: "28px 24px", textAlign: "center", marginBottom: 16,
      }}>
        <div id="qr-wrap" style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          {memberUrl
            ? <QRCanvas url={memberUrl} />
            : (
              <div style={{
                width: 220, height: 220, background: cardBg, borderRadius: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: muted, fontSize: 13,
              }}>Sin token</div>
            )
          }
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
          <button onClick={handleDownload} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px", border: "none", borderRadius: 14, cursor: "pointer",
            background: "linear-gradient(135deg,#6c63ff,#e040fb)",
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            boxShadow: "0 4px 18px rgba(108,99,255,.3)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descargar
          </button>
          <button onClick={handleCopyUrl} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px", border: `1.5px solid ${border}`, borderRadius: 14, cursor: "pointer",
            background: "transparent", color: text, fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", transition: "all .15s",
          }}>
            {copiedUrl
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar enlace</>
            }
          </button>
        </div>

        {/* ID Digital */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 20 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".18em",
            color: muted, textTransform: "uppercase", marginBottom: 8,
          }}>Identificación Digital</p>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: text,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }} />
            {displayId}
          </p>
          <p style={{ color: muted, fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            Este código QR es permanente y único para <strong style={{ color: text }}>{m.nombre}</strong>.{" "}
            Úsalo para check-in y evaluaciones.
          </p>
        </div>
      </div>

      {/* ── Cómo funciona ── */}
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
        <p style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>¿Cómo funciona?</p>
        {[
          { icon: "🏠", title: "Desde casa", desc: "El miembro escanea su QR con la cámara del celular y ve su estado de cuenta, plan y vencimiento." },
          { icon: "🏋️", title: "En el gimnasio", desc: "El staff usa la pantalla de Scanner para leer el QR y validar el acceso en tiempo real." },
        ].map(item => (
          <div key={item.icon} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <p style={{ color: text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{item.title}</p>
              <p style={{ color: muted, fontSize: 12, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── URL preview ── */}
      <div style={{
        background: cardBg, border: `1px solid ${border}`,
        borderRadius: 14, padding: "10px 14px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
        <p style={{ color: muted, fontSize: 11, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {memberUrl || "—"}
        </p>
      </div>

      {/* ── Regenerar ── */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#f43f5e", fontSize: 12, fontFamily: "inherit",
            opacity: regenerating ? .5 : .7, textDecoration: "underline",
          }}
        >
          {regenerating ? "Regenerando…" : "🔄 Regenerar código QR"}
        </button>
      </div>
    </div>
  );
}
