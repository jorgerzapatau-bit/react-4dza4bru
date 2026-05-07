// src/screens/ScannerScreen.jsx
// ── Pantalla de control de acceso con escáner QR ──────────────────────────
// Usa la cámara del dispositivo (jsQR vía CDN en index.html) para leer
// el QR de cada miembro e inmediatamente mostrar si puede entrar o no.
//
// Dependencias externas (agregar a public/index.html):
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js"></script>

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import { getMembershipInfo } from "../utils/membershipUtils";

/* ═══════════════════════════════════════════════════════════════
   RESULT OVERLAY
   Aparece durante ~3 s tras cada escaneo
═══════════════════════════════════════════════════════════════ */
function ResultOverlay({ result, onDismiss }) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  const isOk   = result.resultado === "permitido";
  const isWarn = result.resultado === "vencido";

  const bg      = isOk ? "rgba(22,101,52,.97)"  : isWarn ? "rgba(120,53,15,.97)" : "rgba(127,29,29,.97)";
  const border  = isOk ? "var(--col-success)" : isWarn ? "var(--col-warning)" : "var(--col-danger)";
  const icon    = isOk ? "✅" : isWarn ? "⏰" : "🚫";
  const title   = isOk ? "ACCESO PERMITIDO" : isWarn ? "MEMBRESÍA VENCIDA" : "ACCESO DENEGADO";

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: bg, padding: 32,
        animation: "fadeIn .25s ease",
      }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}`}</style>
      <div style={{
        background: "rgba(0,0,0,.35)", borderRadius: 28,
        border: `2px solid ${border}`,
        padding: "36px 28px", textAlign: "center",
        maxWidth: 340, width: "100%",
        boxShadow: `0 0 60px ${border}55`,
      }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 16 }}>{icon}</div>
        <div style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 22, fontWeight: 800, color: "#fff",
          letterSpacing: ".06em", marginBottom: 12,
        }}>{title}</div>

        {result.miembro && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 12 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "rgba(255,255,255,.1)",
                overflow: "hidden", flexShrink: 0,
                border: `2px solid ${border}55`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>
                {result.miembro.foto
                  ? <img src={result.miembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : "🏋️"}
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'Syne',sans-serif" }}>
                  {result.miembro.nombre}
                </p>
                <p style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginTop: 2 }}>
                  {result.miembro.plan || "Sin plan"}
                </p>
              </div>
            </div>
          </>
        )}

        <p style={{ color: "rgba(255,255,255,.75)", fontSize: 13, lineHeight: 1.6 }}>
          {result.motivo}
        </p>

        <p style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 16 }}>
          Toca para continuar
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECENT LOG ITEM
═══════════════════════════════════════════════════════════════ */
function LogItem({ entry }) {
  const isOk   = entry.resultado === "permitido";
  const isWarn = entry.resultado === "vencido";
  const color  = isOk ? "var(--col-success)" : isWarn ? "var(--col-warning)" : "var(--col-danger)";
  const icon   = isOk ? "✓" : isWarn ? "⏰" : "✕";
  const label  = isOk ? "Permitido" : isWarn ? "Vencido" : "Denegado";
  const time   = new Date(entry.at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "var(--border)", fontSize: 13, fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.nombre || "Desconocido"}
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 1 }}>{label} · {time}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SCANNER SCREEN
═══════════════════════════════════════════════════════════════ */
export default function ScannerScreen({ gymId, miembros, txs, darkMode }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const cooldownRef = useRef(false);     // evita escaneos duplicados

  const [scanning, setScanning]   = useState(false);
  const [camError, setCamError]   = useState(null);
  const [result, setResult]       = useState(null);
  const [log, setLog]             = useState([]);
  const [stats, setStats]         = useState({ total: 0, ok: 0, denied: 0 });
  const [manualId, setManualId]   = useState("");
  const [searching, setSearching] = useState(false);

  // ── Start camera ──────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scan();
      }
    } catch (e) {
      setCamError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, []); // eslint-disable-line

  // ── Stop camera ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── QR scan loop ──────────────────────────────────────────────
  const scan = useCallback(() => {
    const tick = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext("2d");
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (window.jsQR) {
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data && !cooldownRef.current) {
          handleQRData(code.data);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []); // eslint-disable-line

  // ── Parse QR URL and process ──────────────────────────────────
  const handleQRData = useCallback(async (rawData) => {
    // Expected format: https://yourdomain.com/member?token=xxx&gym=yyy
    let token = null;
    try {
      const url    = new URL(rawData);
      token = url.searchParams.get("token");
    } catch {
      // Maybe it's just the token directly
      token = rawData.length === 32 ? rawData : null;
    }
    if (!token) return;
    await processToken(token);
  }, [gymId, miembros, txs]); // eslint-disable-line

  const processToken = useCallback(async (token) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    try {
      // Buscar miembro por token (en el array local primero)
      const miembro = miembros.find(m => m.qr_token === token);

      if (!miembro) {
        const r = { resultado: "denegado", motivo: "QR no reconocido en este gimnasio", miembro: null };
        showResult(r, null);
        return;
      }

      // Evaluar membresía
      const info = getMembershipInfo(miembro.id, txs, miembro);
      let resultado, motivo;

      if (!info || info.estado === "sin membresía") {
        resultado = "denegado"; motivo = "Sin membresía registrada";
      } else if (info.estado === "vencida") {
        resultado = "vencido";  motivo = `Membresía vencida el ${info.vence || "—"}`;
      } else {
        resultado = "permitido"; motivo = info.vence ? `Vigente hasta ${info.vence}` : "Membresía activa";
      }

      const res = { resultado, motivo, miembro };

      // Guardar en Supabase
      const tb = await supabase.from("accesos");
      await tb.insert({ gym_id: gymId, miembro_id: miembro.id, resultado, motivo });

      showResult(res, miembro);
    } finally {
      setTimeout(() => { cooldownRef.current = false; }, 4000);
    }
  }, [gymId, miembros, txs]); // eslint-disable-line

  const showResult = (res, miembro) => {
    setResult(res);
    setLog(prev => [{ ...res, nombre: miembro?.nombre, at: new Date().toISOString() }, ...prev.slice(0, 29)]);
    setStats(prev => ({
      total: prev.total + 1,
      ok:     prev.ok     + (res.resultado === "permitido" ? 1 : 0),
      denied: prev.denied + (res.resultado !== "permitido" ? 1 : 0),
    }));
  };

  // ── Manual search ─────────────────────────────────────────────
  const handleManual = async (e) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    setSearching(true);
    const miembro = miembros.find(m =>
      m.nombre.toLowerCase().includes(manualId.toLowerCase()) ||
      String(m.id) === manualId.trim()
    );
    if (miembro) {
      await processToken(miembro.qr_token);
    } else {
      showResult({ resultado: "denegado", motivo: "Miembro no encontrado", miembro: null }, null);
    }
    setManualId("");
    setSearching(false);
  };

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []); // eslint-disable-line

  // eslint-disable-next-line no-unused-vars
  const bg     = darkMode ? "var(--bg-base)" : "var(--bg-elevated)";
  const cardBg = darkMode ? "var(--bg-base)" : "var(--text-inverse)";
  const border = darkMode ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)";
  const text   = darkMode ? "var(--border)" : "var(--bg-elevated)";
  const muted  = darkMode ? "var(--text-secondary)" : "var(--text-secondary)";

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 560, margin: "0 auto", fontFamily: "inherit" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        .scan-input { background: ${darkMode?"var(--bg-card)427":"var(--bg-elevated)"}; border: 1.5px solid ${border};
          border-radius: 12px; padding: 10px 14px; color: ${text}; font-size: 14px;
          font-family: inherit; outline: none; width: 100%; }
        .scan-input:focus { border-color: var(--col-accent); }
        .scan-btn { background: linear-gradient(135deg,var(--col-accent),var(--col-accent)); border: none;
          border-radius: 12px; padding: 10px 20px; color: #fff; font-weight: 700;
          font-size: 14px; cursor: pointer; white-space: nowrap; font-family: inherit; }
      `}</style>

      {/* Result overlay */}
      <ResultOverlay result={result} onDismiss={() => setResult(null)} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: text }}>
          Control de Acceso
        </h1>
        <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>
          Escanea el QR del miembro para validar su acceso
        </p>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total hoy", value: stats.total, color: "var(--col-accent-text)" },
          { label: "Permitidos", value: stats.ok, color: "var(--col-success)" },
          { label: "Denegados", value: stats.denied, color: "var(--col-danger)" },
        ].map(s => (
          <div key={s.label} style={{ background: cardBg, border: `1px solid ${border}`,
            borderRadius: 16, padding: "12px 14px", textAlign: "center" }}>
            <p style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 10, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Camera viewfinder */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 24,
        overflow: "hidden", marginBottom: 16, position: "relative" }}>

        {/* Camera area */}
        <div style={{ position: "relative", background: "#000", aspectRatio: "4/3", maxHeight: 280 }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* QR frame overlay */}
          {scanning && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 180, height: 180, position: "relative",
              }}>
                {/* Corners */}
                {[["0","0","",""],["0","","","0"],["","","0","0"],["","0","0",""]].map(([t,r,b,l], i) => (
                  <div key={i} style={{
                    position: "absolute",
                    top: t !== "" ? t : undefined, right: r !== "" ? r : undefined,
                    bottom: b !== "" ? b : undefined, left: l !== "" ? l : undefined,
                    width: 28, height: 28,
                    borderTop:    (t !== "" && l !== "") || (t !== "" && r !== "") ? "3px solid var(--col-accent)" : "none",
                    borderBottom: (b !== "" && l !== "") || (b !== "" && r !== "") ? "3px solid var(--col-accent)" : "none",
                    borderLeft:   (t !== "" && l !== "") || (b !== "" && l !== "") ? "3px solid var(--col-accent)" : "none",
                    borderRight:  (t !== "" && r !== "") || (b !== "" && r !== "") ? "3px solid var(--col-accent)" : "none",
                    borderRadius: (t !== "" && l !== "") ? "4px 0 0 0" : (t !== "" && r !== "") ? "0 4px 0 0"
                      : (b !== "" && r !== "") ? "0 0 4px 0" : "0 0 0 4px",
                  }} />
                ))}
                {/* Scan line */}
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg,transparent,var(--col-accent),var(--col-accent),transparent)",
                  animation: "scanline 2s ease-in-out infinite",
                }} />
                <style>{`@keyframes scanline{0%,100%{top:0}50%{top:100%}}`}</style>
              </div>
            </div>
          )}

          {/* Placeholder when camera off */}
          {!scanning && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
              <p style={{ fontSize: 13 }}>Cámara inactiva</p>
            </div>
          )}

          {camError && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", padding: 24, textAlign: "center" }}>
              <p style={{ color: "var(--col-danger)", fontSize: 13 }}>{camError}</p>
            </div>
          )}
        </div>

        {/* Camera controls */}
        <div style={{ padding: "14px 16px" }}>
          {!scanning ? (
            <button onClick={startCamera} style={{
              width: "100%", padding: "13px", border: "none", borderRadius: 14, cursor: "pointer",
              background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", color: "#fff",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit",
              boxShadow: "0 4px 20px rgba(108,99,255,.35)",
            }}>
              📷 Activar cámara
            </button>
          ) : (
            <button onClick={stopCamera} style={{
              width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer",
              background: "var(--col-danger-soft)", color: "var(--col-danger)", border: "1px solid var(--col-danger-border)",
              fontWeight: 700, fontSize: 14, fontFamily: "inherit",
            }}>
              ⏹ Detener cámara
            </button>
          )}
        </div>
      </div>

      {/* Manual lookup */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: 16, marginBottom: 20 }}>
        <p style={{ color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", marginBottom: 10 }}>Búsqueda manual</p>
        <form onSubmit={handleManual} style={{ display: "flex", gap: 8 }}>
          <input
            className="scan-input"
            placeholder="Nombre o ID del miembro…"
            value={manualId}
            onChange={e => setManualId(e.target.value)}
          />
          <button type="submit" className="scan-btn" disabled={searching}>
            {searching ? "…" : "Buscar"}
          </button>
        </form>
      </div>

      {/* Log */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 20, padding: 16 }}>
        <p style={{ color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".08em", marginBottom: 4 }}>Últimos accesos</p>
        {log.length === 0
          ? <p style={{ color: muted, fontSize: 13, padding: "16px 0", textAlign: "center" }}>Sin registros todavía</p>
          : log.map((entry, i) => <LogItem key={i} entry={entry} />)
        }
      </div>
    </div>
  );
}
