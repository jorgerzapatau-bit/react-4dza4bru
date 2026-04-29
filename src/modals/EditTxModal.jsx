// src/modals/EditTxModal.jsx
import { useState } from "react";
import { Modal, Btn, Inp } from "../components/UI";
import { CAT_GAS, CAT_ING, getCatIng, getCatGas } from "../utils/constants";
import { parseDate, displayToISO, fmtDate } from "../utils/dateUtils";

/* ─── EDIT TRANSACTION MODAL ─── */
export default function EditTxModal({ tx, onClose, onSave, onDelete, miembros = [], gymConfig }) {
  const isGasto = tx.tipo === "gasto";
  const isMembresía = tx.categoria === "Membresías" || tx.categoria === "Mensualidades";
  const cats = isGasto ? getCatGas(gymConfig) : getCatIng(gymConfig);
  const color = isGasto ? "#f43f5e" : "#22d3ee";
  const desc = tx.desc || tx.descripcion || "";

  // Extraer info del miembro vinculado
  const miembro = (tx.miembroId || tx.miembro_id)
    ? miembros.find(mb => String(mb.id) === String(tx.miembroId || tx.miembro_id))
    : null;

  // Extraer plan y forma de pago de la descripción
  const planMatch = desc.match(/Renovaci[oó]n (.+?) - /);
  const fpagoMatch = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
  const planNombre = planMatch ? planMatch[1] : null;
  const formaPago = fpagoMatch ? fpagoMatch[1] : null;

  // Extraer vencimiento — SOLO si es una membresía real (tiene plan o vence explícito)
  const tienePlanEnDesc = /(Mensual|Trimestral|Semestral|Anual)/i.test(desc);
  const esMembresíaReal = isMembresía && (tienePlanEnDesc || !!tx.vence_manual);

  const venceManualDelDesc = (() => {
    // 1. Buscar patrón embebido en descripción
    const m = desc.match(/\(vence:(\d{4}-\d{2}-\d{2})\)/);
    if (m) return m[1];
    // 2. Campo vence_manual explícito en la tx
    if (tx.vence_manual) return tx.vence_manual;
    // 3. Calcular desde fecha + plan SOLO si tiene plan en descripción
    if (isMembresía && tienePlanEnDesc && tx.fecha) {
      const fechaD = parseDate(tx.fecha);
      if (fechaD) {
        const planMatch = desc.match(/(Mensual|Trimestral|Semestral|Anual)/i);
        const plan = planMatch ? planMatch[1] : "Mensual";
        const MESES_PLAN = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
        const v = new Date(fechaD);
        v.setMonth(v.getMonth() + (MESES_PLAN[plan] || 1));
        return v.toISOString().split("T")[0];
      }
    }
    return "";
  })();

  const txDate = parseDate(tx.fecha);
  const hoy = new Date();

  const [editing, setEditing] = useState(false);
  const [confirmMesPasado, setConfirmMesPasado] = useState(false);
  const [form, setForm] = useState({
    cat: tx.categoria,
    desc: desc.replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "").trim(),
    monto: String(tx.monto),
    fecha: displayToISO(tx.fecha),
    vence: venceManualDelDesc,
  });
  const [confirmDel, setConfirmDel] = useState(false);

  // Detectar si la fecha ACTUAL del form es mes pasado
  const formDate = form.fecha ? new Date(form.fecha + "T12:00:00") : txDate;
  const esMesPasado =
    formDate &&
    (formDate.getFullYear() < hoy.getFullYear() ||
      (formDate.getFullYear() === hoy.getFullYear() &&
        formDate.getMonth() < hoy.getMonth()));
  const mesNombre = formDate
    ? formDate.toLocaleString("es-MX", { month: "long", year: "numeric" })
    : "";

  // Duración calculada entre inicio y vence
  const duracionDias = (() => {
    if (!form.fecha || !form.vence) return null;
    const [vy, vm, vd] = form.vence.split("-").map(Number);
    const [iy, im, id2] = form.fecha.split("-").map(Number);
    const diff = Math.round(
      (new Date(vy, vm - 1, vd) - new Date(iy, im - 1, id2)) / 86400000
    );
    return diff > 0 ? diff : null;
  })();

  const handleSave = () => {
    if (!form.monto) return;
    const baseDesc = form.desc.trim() || desc.replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "").trim();
    const newDesc = form.vence ? `${baseDesc} (vence:${form.vence})` : baseDesc;
    onSave({
      ...tx,
      categoria: form.cat,
      desc: newDesc,
      descripcion: newDesc,
      monto: Number(form.monto),
      fecha: fmtDate(form.fecha) || form.fecha,
      vence_manual: form.vence || null,
    });
  };

  const handleEditClick = () => {
    if (esMesPasado) setConfirmMesPasado(true);
    else setEditing(true);
  };

  const Row = ({ label, value, accent }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "11px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          color: "#8b949e",
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent || "var(--text-primary)",
          fontSize: 14,
          fontWeight: accent ? 700 : 500,
          fontFamily: accent ? "'DM Mono',monospace" : "inherit",
        }}
      >
        {value}
      </span>
    </div>
  );

  const titleEditing = esMembresíaReal
    ? "✏️ Editar Membresía"
    : isGasto
    ? "✏️ Editar Gasto"
    : "✏️ Editar Ingreso";
  const titleView = esMembresíaReal
    ? "🏋️ Detalle Membresía"
    : isGasto
    ? "💸 Detalle Gasto"
    : "💰 Detalle Cobro";

  return (
    <Modal title={editing ? titleEditing : titleView} onClose={onClose}>

      {/* ── Confirmación mes pasado ── */}
      {confirmMesPasado && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.85)",
            backdropFilter: "blur(8px)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 24,
              padding: 24,
              width: "100%",
              maxWidth: 340,
              border: "1px solid rgba(245,158,11,.3)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>⚠️</p>
              <h3
                style={{
                  color: "#fbbf24",
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Modificando mes pasado
              </h3>
              <p style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.6 }}>
                Estás por editar un movimiento de{" "}
                <strong style={{ color: "var(--text-primary)" }}>{mesNombre}</strong>. Esto
                afectará los totales y estadísticas de ese mes.
              </p>
            </div>
            <div
              style={{
                background: "rgba(245,158,11,.08)",
                border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 18,
              }}
            >
              <p style={{ color: "#f59e0b", fontSize: 11, lineHeight: 1.6 }}>
                💡 Si es un error de captura, edítalo. Si es información nueva,
                considera un movimiento nuevo.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn
                full
                outline
                color="#8b949e"
                onClick={() => setConfirmMesPasado(false)}
              >
                Cancelar
              </Btn>
              <Btn
                full
                color="#f59e0b"
                onClick={() => {
                  setConfirmMesPasado(false);
                  setEditing(true);
                }}
              >
                Sí, editar
              </Btn>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        // ── VIEW MODE ──
        <>
          {esMesPasado && (
            <div
              style={{
                background: "rgba(245,158,11,.08)",
                border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 12,
                padding: "8px 14px",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>📅</span>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>
                Movimiento de {mesNombre}
              </p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span
              style={{
                background: esMembresíaReal
                  ? "rgba(167,139,250,.12)"
                  : isGasto
                  ? "rgba(244,63,94,.12)"
                  : "rgba(34,211,238,.12)",
                color: esMembresíaReal ? "#a78bfa" : color,
                borderRadius: 20,
                padding: "6px 20px",
                fontSize: 13,
                fontWeight: 700,
                border: `1px solid ${
                  esMembresíaReal
                    ? "rgba(167,139,250,.25)"
                    : isGasto
                    ? "rgba(244,63,94,.25)"
                    : "rgba(34,211,238,.25)"
                }`,
              }}
            >
              {esMembresíaReal ? "🏋️ Membresía" : isGasto ? "💸 Gasto" : "💰 Cobro extra"}
            </span>
          </div>

          <div
            style={{
              textAlign: "center",
              marginBottom: 20,
              background: esMembresíaReal
                ? "rgba(167,139,250,.07)"
                : isGasto
                ? "rgba(244,63,94,.07)"
                : "rgba(34,211,238,.07)",
              borderRadius: 18,
              padding: "16px 0",
              border: `1px solid ${
                esMembresíaReal
                  ? "rgba(167,139,250,.15)"
                  : isGasto
                  ? "rgba(244,63,94,.15)"
                  : "rgba(34,211,238,.15)"
              }`,
            }}
          >
            <p
              style={{
                color: "#8b949e",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Monto
            </p>
            <p
              style={{
                color: esMembresíaReal ? "#a78bfa" : color,
                fontSize: 32,
                fontWeight: 700,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              ${Number(tx.monto).toLocaleString("es-MX")}
            </p>
          </div>

          {/* Member header */}
          {miembro && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-elevated)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#6c63ff33,#e040fb33)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontWeight: 700, fontSize: 16 }}>
                {miembro.foto ? <img src={miembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : miembro.nombre.charAt(0)}
              </div>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>{miembro.nombre}</p>
                {miembro.tel && <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>📱 {miembro.tel}</p>}
              </div>
            </div>
          )}

          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 16,
              padding: "0 14px",
            }}
          >
            {planNombre && <Row label="Plan" value={planNombre} />}
            {formaPago && <Row label="Forma de pago" value={`${formaPago === "Efectivo" ? "💵" : formaPago === "Transferencia" ? "🏦" : "💳"} ${formaPago}`} />}
            <Row label="Categoría" value={tx.categoria} />
            <Row label={esMembresíaReal ? "Inicio" : "Fecha"} value={fmtDate(tx.fecha)} />
            {venceManualDelDesc && (
              <Row label="Vencimiento" value={fmtDate(venceManualDelDesc)} accent="#22d3ee" />
            )}
            {duracionDias && <Row label="Duración" value={`${duracionDias} días`} />}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn full outline color="#8b949e" onClick={onClose}>
              Cerrar
            </Btn>
            <Btn
              full
              color={esMembresíaReal ? "#a78bfa" : color}
              onClick={handleEditClick}
            >
              ✏️ Editar
            </Btn>
          </div>
        </>
      ) : (
        // ── EDIT MODE ──
        <>
          {esMesPasado && (
            <div
              style={{
                background: "rgba(245,158,11,.08)",
                border: "1px solid rgba(245,158,11,.25)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 14,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>⚠️</span>
              <p style={{ color: "#f59e0b", fontSize: 11 }}>
                Editando movimiento de <strong>{mesNombre}</strong> — los
                cambios afectarán ese mes.
              </p>
            </div>
          )}

          {/* Monto siempre editable */}
          <Inp
            label="Monto ($)"
            type="number"
            value={form.monto}
            onChange={(v) => setForm((p) => ({ ...p, monto: v }))}
            placeholder="0.00"
          />

          {/* Fechas de membresía: inicio + vencimiento en grid */}
          {isMembresía ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <div>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Inicio
                  </p>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => {
                      const v = e.target.value;
                      const d = new Date(v + "T12:00:00");
                      const nuevoEsMesPasado =
                        d.getFullYear() < hoy.getFullYear() ||
                        (d.getFullYear() === hoy.getFullYear() &&
                          d.getMonth() < hoy.getMonth());
                      setForm((p) => ({ ...p, fecha: v }));
                      if (nuevoEsMesPasado && !esMesPasado)
                        setConfirmMesPasado(true);
                    }}
                    style={{
                      width: "100%",
                      background: "var(--bg-elevated)",
                      border: `1px solid ${
                        esMesPasado
                          ? "rgba(245,158,11,.4)"
                          : "var(--border)"
                      }`,
                      borderRadius: 12,
                      padding: "12px 10px",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Vencimiento
                  </p>
                  <input
                    type="date"
                    value={form.vence}
                    min={form.fecha}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, vence: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      background: "var(--bg-elevated)",
                      border: "1px solid rgba(34,211,238,.3)",
                      borderRadius: 12,
                      padding: "12px 10px",
                      color: "#22d3ee",
                      fontSize: 13,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
              {duracionDias && (
                <div style={{ textAlign: "right", marginBottom: 12 }}>
                  <span style={{ color: "#22d3ee", fontSize: 12, fontWeight: 700 }}>
                    {duracionDias} días
                  </span>
                </div>
              )}
            </>
          ) : (
            <Inp
              label="Fecha"
              type="date"
              value={form.fecha}
              onChange={(v) => setForm((p) => ({ ...p, fecha: v }))}
            />
          )}

          {!isMembresía && (
            <Inp
              label="Categoría"
              value={form.cat}
              onChange={(v) => setForm((p) => ({ ...p, cat: v }))}
              options={cats}
            />
          )}
          <Inp
            label="Descripción"
            value={form.desc}
            onChange={(v) => setForm((p) => ({ ...p, desc: v }))}
            placeholder="Descripción"
          />

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn
              full
              outline
              color="#8b949e"
              onClick={() => {
                setEditing(false);
                setConfirmDel(false);
              }}
            >
              ← Volver
            </Btn>
            <Btn
              full
              color={esMembresíaReal ? "#a78bfa" : color}
              onClick={handleSave}
            >
              Guardar ✓
            </Btn>
          </div>

          <div style={{ marginTop: 12 }}>
            {!confirmDel ? (
              <Btn
                full
                outline
                color="#f43f5e"
                onClick={() => setConfirmDel(true)}
              >
                🗑 Eliminar movimiento
              </Btn>
            ) : (
              <div
                style={{
                  background: "rgba(244,63,94,.1)",
                  border: "1px solid rgba(244,63,94,.3)",
                  borderRadius: 14,
                  padding: 14,
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>
                  ¿Eliminar este movimiento?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn
                    full
                    outline
                    color="#8b949e"
                    onClick={() => setConfirmDel(false)}
                  >
                    Cancelar
                  </Btn>
                  <Btn full color="#f43f5e" onClick={() => onDelete(tx.id)}>
                    Sí, eliminar
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
