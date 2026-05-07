// src/modals/MemberQRTab.jsx

import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

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

/* ─── Genera o recupera el qr_token ─── */
async function ensureQrToken(miembro, onUpdate) {
  if (miembro.qr_token) return miembro.qr_token;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const tb = await supabase.from("miembros");
  const ok = await tb.update(miembro.id, { qr_token: token });
  if (!ok) console.error("No se pudo guardar qr_token");
  onUpdate?.({ ...miembro, qr_token: token });
  return token;
}

/* ─── Genera canvas de la tarjeta completa (QR + nombre + ID corto) ─── */
async function buildCardCanvas(qrWrapEl, memberName, shortId) {
  const qrCanvas = qrWrapEl.querySelector("canvas");
  if (!qrCanvas) return null;

  const W = 400, PAD = 32;
  const qrSize = 260;
  const headerH = 56;
  const footerH = 110;
  const H = headerH + qrSize + footerH + PAD * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo blanco con bordes redondeados
  ctx.fillStyle = "var(--text-inverse)";
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fill();

  // Sombra exterior (solo en descarga, no importa)
  ctx.shadowColor = "rgba(0,0,0,0.10)";
  ctx.shadowBlur = 0;

  // ── Header: nombre del gimnasio / branding ──
  ctx.fillStyle = "var(--col-accent)";
  roundRect(ctx, 0, 0, W, headerH, { tl: 24, tr: 24, br: 0, bl: 0 });
  ctx.fill();

  ctx.fillStyle = "var(--text-inverse)";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🏋️  IDENTIFICACIÓN DIGITAL", W / 2, 34);

  // ── QR centrado ──
  const qrX = (W - qrSize) / 2;
  const qrY = headerH + PAD;

  // Marco blanco con sombra suave
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "var(--text-inverse)";
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dibuja el QR
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // ── Footer: nombre + ID corto ──
  const footerY = headerH + PAD + qrSize + PAD;

  // Nombre del miembro
  ctx.fillStyle = "var(--bg-elevated)";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  // Truncar nombre si es muy largo
  const maxNameW = W - PAD * 2;
  let name = memberName;
  while (ctx.measureText(name).width > maxNameW && name.length > 3) {
    name = name.slice(0, -1);
  }
  if (name !== memberName) name += "…";
  ctx.fillText(name, W / 2, footerY + 22);

  // Separador
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD * 2, footerY + 38);
  ctx.lineTo(W - PAD * 2, footerY + 38);
  ctx.stroke();

  // Etiqueta "ID"
  ctx.fillStyle = "var(--text-secondary)";
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("CÓDIGO DE ACCESO", W / 2, footerY + 58);

  // ID corto con punto verde
  const dotR = 5;
  const idText = shortId;
  ctx.font = "bold 22px 'Courier New', monospace";
  const idW = ctx.measureText(idText).width;
  const totalW = dotR * 2 + 8 + idW;
  const startX = (W - totalW) / 2;

  ctx.fillStyle = "var(--col-success)";
  ctx.beginPath();
  ctx.arc(startX + dotR, footerY + 88, dotR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "var(--bg-elevated)";
  ctx.textAlign = "left";
  ctx.fillText(idText, startX + dotR * 2 + 8, footerY + 94);

  return canvas;
}

// Utilidad: rectángulo redondeado compatible
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/* ─── QR Canvas ─── */
function QRCanvas({ url }) {
  const ref = useRef(null);
  const [scriptReady, setScriptReady] = useState(!!window.QRCode);

  useEffect(() => {
    if (scriptReady) return;
    loadQRScript().then(setScriptReady);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scriptReady || !ref.current || !url) return;
    ref.current.innerHTML = "";
    try {
      new window.QRCode(ref.current, {
        text: url,
        width: 240,
        height: 240,
        colorDark: "var(--bg-base)",
        colorLight: "var(--text-inverse)",
        correctLevel: window.QRCode.CorrectLevel.H,
      });
    } catch (e) {
      console.error("QRCode render error:", e);
    }
  }, [scriptReady, url]);

  if (!scriptReady) return (
    <div style={{ width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 12 }}>
      Cargando…
    </div>
  );

  return (
    <div ref={ref} style={{ background: "#fff", padding: 12, borderRadius: 16, display: "inline-flex", boxShadow: "0 8px 32px rgba(0,0,0,.15)" }} />
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function MemberQRTab({ m, gymId, onMemberUpdate, darkMode }) {
  const [token, setToken]     = useState(m.qr_token || null);
  const [loading, setLoading] = useState(!m.qr_token);
  const [error, setError]     = useState(null);
  const [copied, setCopied]   = useState(false);
  const [copying, setCopying] = useState(false);
  const [regenerating, setReg] = useState(false);
  const qrWrapRef = useRef(null);

  const memberUrl = token ? `${MEMBER_PAGE_BASE}?token=${token}&gym=${gymId}` : null;
  // ID corto: "DZ-" + primeros 8 chars del token
  const shortId = token ? `DZ-${token.slice(0, 4).toUpperCase()}` : "";

  const runEnsure = () => {
    setError(null);
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const t = await ensureQrToken(m, onMemberUpdate);
        if (!cancelled) { setToken(t); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError("No se pudo generar el QR: " + (e?.message || e)); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  };

  useEffect(() => {
    if (token) { setLoading(false); return; }
    return runEnsure();
  }, []); // eslint-disable-line

  /* ── Descargar tarjeta completa ── */
  const handleDownload = async () => {
    if (!qrWrapRef.current) return;
    const card = await buildCardCanvas(qrWrapRef.current, m.nombre, shortId);
    if (!card) { alert("El QR aún no está listo."); return; }
    const link = document.createElement("a");
    link.download = `Tarjeta_${m.nombre.replace(/\s+/g, "_")}.png`;
    link.href = card.toDataURL("image/png");
    link.click();
  };

  /* ── Copiar tarjeta como imagen al portapapeles ── */
  const handleCopyImage = async () => {
    if (!qrWrapRef.current || copying) return;
    setCopying(true);
    try {
      const card = await buildCardCanvas(qrWrapRef.current, m.nombre, shortId);
      if (!card) throw new Error("Canvas vacío");
      card.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch (e) {
          // Fallback: si el navegador no soporta clipboard images, descarga
          console.warn("Clipboard image not supported, downloading instead:", e);
          const link = document.createElement("a");
          link.download = `Tarjeta_${m.nombre.replace(/\s+/g, "_")}.png`;
          link.href = card.toDataURL("image/png");
          link.click();
          alert("Tu navegador no permite copiar imágenes directamente. Se descargó la tarjeta en su lugar.");
        }
        setCopying(false);
      }, "image/png");
    } catch (e) {
      console.error(e);
      setCopying(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm("¿Regenerar el QR? El código anterior dejará de funcionar.")) return;
    setReg(true);
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const tb = await supabase.from("miembros");
    await tb.update(m.id, { qr_token: newToken });
    setToken(newToken);
    onMemberUpdate?.({ ...m, qr_token: newToken });
    setReg(false);
  };

  const bg     = darkMode ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)";
  const border = darkMode ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)";
  const muted  = darkMode ? "var(--text-secondary)" : "var(--text-secondary)";
  const text   = darkMode ? "var(--border)" : "var(--bg-elevated)";
  const cardBg = darkMode ? "var(--bg-card)427" : "var(--bg-elevated)";

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid var(--col-accent-border)", borderTopColor: "var(--col-accent)", animation: "spin .8s linear infinite", margin: "0 auto 14px" }} />
      <p style={{ color: muted, fontSize: 13 }}>Generando código QR…</p>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      <p style={{ fontSize: 32, marginBottom: 10 }}>⚠️</p>
      <p style={{ color: "var(--col-danger)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</p>
      <button onClick={runEnsure} style={{ marginTop: 16, padding: "10px 20px", border: "none", borderRadius: 12, background: "var(--col-accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Reintentar
      </button>
    </div>
  );

  return (
    <div style={{ paddingBottom: 8 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── QR Card ── */}
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 24, padding: "28px 24px", textAlign: "center", marginBottom: 16 }}>

        {/* QR visible */}
        <div ref={qrWrapRef} id="qr-wrap" style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          {memberUrl ? <QRCanvas url={memberUrl} /> : (
            <div style={{ width: 240, height: 240, background: cardBg, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 13 }}>Sin token</div>
          )}
        </div>

        {/* ID corto visible */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: muted, textTransform: "uppercase", marginBottom: 6 }}>Código de acceso</p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 20, fontWeight: 800, color: text, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--col-success)", display: "inline-block", boxShadow: "0 0 8px var(--col-success)", flexShrink: 0 }} />
            {shortId}
          </p>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
          {/* Descargar tarjeta */}
          <button onClick={handleDownload} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px", border: "none", borderRadius: 14, cursor: "pointer",
            background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))",
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            boxShadow: "0 4px 18px var(--col-accent-border)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Descargar
          </button>

          {/* Copiar imagen */}
          <button onClick={handleCopyImage} disabled={copying} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px", border: `1.5px solid ${border}`, borderRadius: 14, cursor: copying ? "wait" : "pointer",
            background: copied ? "rgba(34,197,94,.08)" : "transparent",
            color: copied ? "var(--col-success)" : text,
            borderColor: copied ? "var(--col-success-border)" : border,
            fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .2s",
          }}>
            {copied ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--col-success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiada!</>
            ) : copying ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin .8s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Copiando…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2"/></svg> Copiar imagen</>
            )}
          </button>
        </div>

        <p style={{ color: muted, fontSize: 11, lineHeight: 1.6 }}>
          💡 <strong style={{ color: text }}>Copiar imagen</strong> guarda la tarjeta en el portapapeles para pegarla directo en WhatsApp.
        </p>

        {/* Separador */}
        <div style={{ borderTop: `1px solid ${border}`, marginTop: 20, paddingTop: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: muted, textTransform: "uppercase", marginBottom: 6 }}>Identificación</p>
          <p style={{ color: muted, fontSize: 12, lineHeight: 1.6 }}>
            QR permanente y único para <strong style={{ color: text }}>{m.nombre}</strong>.
          </p>
        </div>
      </div>

      {/* ── Cómo funciona ── */}
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
        <p style={{ color: muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>¿Cómo funciona?</p>
        {[
          { icon: "📲", title: "Enviar por WhatsApp", desc: 'Presiona "Copiar imagen" y pégala directo en el chat del miembro. La muestra al llegar al gym.' },
          { icon: "🏠", title: "Desde casa", desc: "El miembro escanea su QR con la cámara del celular y ve su estado de cuenta, plan y vencimiento." },
          { icon: "🏋️", title: "En el gimnasio", desc: `Si el scanner falla, el miembro puede dar su código corto (${shortId}) para buscarle manualmente.` },
        ].map(item => (
          <div key={item.icon} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <p style={{ color: text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{item.title}</p>
              <p style={{ color: muted, fontSize: 12, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Regenerar ── */}
      <div style={{ textAlign: "center" }}>
        <button onClick={handleRegenerate} disabled={regenerating} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--col-danger)", fontSize: 12, fontFamily: "inherit",
          opacity: regenerating ? .5 : .7, textDecoration: "underline",
        }}>
          {regenerating ? "Regenerando…" : "🔄 Regenerar código QR"}
        </button>
      </div>
    </div>
  );
}
