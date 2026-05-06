// ─────────────────────────────────────────────
//  components/PhotoModal.jsx
//  Modal para capturar o seleccionar la foto
//  de perfil de un miembro.
//
//  Props:
//    onClose   () => void
//    onCapture (dataUrl: string) => void
//
//  Uso:
//    import PhotoModal from "./components/PhotoModal";
//    {showFotoModal && (
//      <PhotoModal
//        onClose={() => setShowFotoModal(false)}
//        onCapture={(dataUrl) => setFM(p => ({ ...p, foto: dataUrl }))}
//      />
//    )}
// ─────────────────────────────────────────────

import { useState } from "react";

// ── Redimensiona y comprime imagen a máx 300×300 ──
async function resizeImage(dataUrl, maxSize = 300, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h) {
        if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
      } else {
        if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// ─────────────────────────────────────────────
export default function PhotoModal({ onClose, onCapture, titulo = "📸 Foto del miembro" }) {
  // "null" → menú inicial   "camera" → vista cámara   "preview" → confirmar foto
  const [mode,    setMode]    = useState(null);
  const [preview, setPreview] = useState(null);

  // streamRef no necesita ser un useRef real porque no re-renderiza —
  // usamos un objeto plano igual que en el original.
  const streamRef = { current: null };

  // ── Cámara ──────────────────────────────────
  const startCamera = async () => {
    setMode("camera");
    // Pequeño delay para que el DOM monte el <video>
    setTimeout(async () => {
      try {
        const vid = document.getElementById("gymfit-video");
        if (!vid) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        vid.srcObject = stream;
        vid.play();
      } catch {
        alert("No se pudo acceder a la cámara. Verifica los permisos.");
        setMode(null);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = async () => {
    const vid = document.getElementById("gymfit-video");
    if (!vid) return;
    const canvas    = document.createElement("canvas");
    canvas.width    = vid.videoWidth  || 320;
    canvas.height   = vid.videoHeight || 320;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    const raw    = canvas.toDataURL("image/jpeg", 1.0);
    const dataUrl = await resizeImage(raw, 300, 0.75);
    stopCamera();
    setPreview(dataUrl);
    setMode("preview");
  };

  // ── Galería ─────────────────────────────────
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const resized = await resizeImage(ev.target.result, 300, 0.75);
      setPreview(resized);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  };

  // ── Acciones ─────────────────────────────────
  const handleConfirm = () => { stopCamera(); onCapture(preview); };
  const handleClose   = () => { stopCamera(); onClose(); };

  // ── Estilos reutilizados ─────────────────────
  const btnSecondary = {
    padding: "11px 20px",
    border: "1.5px solid #6b7280",
    borderRadius: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    background: "transparent",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
  };
  const btnPrimary = {
    padding: "11px 28px",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    background: "linear-gradient(135deg,#6c63ff,#e040fb)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 4px 16px rgba(108,99,255,.4)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.88)",
      backdropFilter: "blur(12px)",
      zIndex: 300,
      display: "flex",
      alignItems: "flex-end",
    }}>
      <div style={{
        width: "100%",
        background: "#191928",
        borderRadius: "28px 28px 0 0",
        padding: "24px 24px 44px",
        animation: "slideUp .3s ease",
      }}>

        {/* ── Cabecera ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>{titulo}</h2>
          <button
            onClick={handleClose}
            style={{
              border: "none",
              background: "rgba(255,255,255,.1)",
              color: "#9ca3af",
              width: 34, height: 34,
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* ── Menú inicial: cámara o galería ── */}
        {mode === null && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Cámara */}
            <button
              onClick={startCamera}
              style={{
                background: "rgba(108,99,255,.15)",
                border: "1px solid rgba(108,99,255,.3)",
                borderRadius: 18,
                padding: "24px 0",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}
            >
              <span style={{ fontSize: 32 }}>📷</span>
              <span style={{ color: "#a78bfa",  fontSize: 13, fontWeight: 700 }}>Tomar foto</span>
              <span style={{ color: "#4b4b6a",  fontSize: 10 }}>Usar cámara</span>
            </button>

            {/* Galería */}
            <label style={{
              background: "rgba(34,211,238,.1)",
              border: "1px solid rgba(34,211,238,.25)",
              borderRadius: 18,
              padding: "24px 0",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: 32 }}>🖼️</span>
              <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 700 }}>Galería</span>
              <span style={{ color: "#4b4b6a", fontSize: 10 }}>Elegir imagen</span>
            </label>
          </div>
        )}

        {/* ── Vista de cámara ── */}
        {mode === "camera" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 260, height: 260,
              borderRadius: 20,
              overflow: "hidden",
              border: "2px solid rgba(108,99,255,.4)",
              background: "#000",
              position: "relative",
            }}>
              <video
                id="gymfit-video"
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {/* Marco decorativo */}
              <div style={{
                position: "absolute", inset: 0,
                border: "3px solid rgba(108,99,255,.5)",
                borderRadius: 18,
                pointerEvents: "none",
              }} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => { stopCamera(); setMode(null); }}
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button onClick={takePhoto} style={btnPrimary}>
                <span style={{ fontSize: 18 }}>⊙</span> Capturar
              </button>
            </div>
          </div>
        )}

        {/* ── Vista previa: confirmar o repetir ── */}
        {mode === "preview" && preview && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 200, height: 200,
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid rgba(108,99,255,.5)",
              boxShadow: "0 0 0 6px rgba(108,99,255,.12)",
            }}>
              <img
                src={preview}
                alt="preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <p style={{ color: "#4b4b6a", fontSize: 12 }}>¿Se ve bien la foto?</p>

            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <button
                onClick={() => { setPreview(null); setMode(null); }}
                style={{ ...btnSecondary, flex: 1, padding: "12px" }}
              >
                Repetir
              </button>
              <button
                onClick={handleConfirm}
                style={{ ...btnPrimary, flex: 1, padding: "12px", justifyContent: "center" }}
              >
                Guardar ✓
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
