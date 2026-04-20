import { useState, useMemo } from "react";
import { fmt, fmtDate, parseDate, CAT_ICON } from "../utils";
import EditTxModal from "../modals/EditTxModal";

function CajaScreen({ txs, miembros, gymConfig, onBack }) {
  const tz = gymConfig?.zona_horaria || "America/Merida";
  const ahora = new Date();
  const hoyISO = ahora.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD local

  // Períodos rápidos
  const PERIODOS = [
    { label: "Hoy", get: () => [hoyISO, hoyISO] },
    {
      label: "Ayer", get: () => {
        const d = new Date(ahora); d.setDate(d.getDate() - 1);
        const s = d.toLocaleDateString("en-CA", { timeZone: tz }); return [s, s];
      }
    },
    {
      label: "Esta semana", get: () => {
        const d = new Date(ahora);
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Lun=0
        d.setDate(d.getDate() - dow);
        return [d.toLocaleDateString("en-CA", { timeZone: tz }), hoyISO];
      }
    },
    {
      label: "Este mes", get: () => {
        const [y, m] = hoyISO.split("-");
        return [`${y}-${m}-01`, hoyISO];
      }
    },
    {
      label: "Mes anterior", get: () => {
        const d = new Date(ahora); d.setDate(1); d.setMonth(d.getMonth() - 1);
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
        const last = new Date(y, d.getMonth() + 1, 0).getDate();
        return [`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2, "0")}`];
      }
    },
  ];

  const [periodoActivo, setPeriodoActivo] = useState(0);
  const [desde, setDesde] = useState(hoyISO);
  const [hasta, setHasta] = useState(hoyISO);
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // "todos" | "ingreso" | "gasto"
  const [corte, setCorte] = useState(null); // snapshot del corte
  const [copiadoCorte, setCopiadoCorte] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const cargarScriptCaja = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  // Aplicar período rápido
  const aplicarPeriodo = (idx) => {
    setPeriodoActivo(idx);
    const [d, h] = PERIODOS[idx].get();
    setDesde(d); setHasta(h);
  };

  // Todo el cálculo del período en un solo useMemo para evitar dependencias inestables
  const cajaData = useMemo(() => {
    const dDesde = desde ? new Date(desde + "T00:00:00") : null;
    const dHasta = hasta ? new Date(hasta + "T23:59:59") : null;
    const filtradas = txs.filter(t => {
      const td = parseDate(t.fecha);
      if (!td) return false;
      if (dDesde && td < dDesde) return false;
      if (dHasta && td > dHasta) return false;
      return true;
    });

    const ing = filtradas.filter(t => t.tipo === "ingreso");
    const gas = filtradas.filter(t => t.tipo === "gasto");
    const totIng = ing.reduce((s, t) => s + Number(t.monto), 0);
    const totGas = gas.reduce((s, t) => s + Number(t.monto), 0);

    // Desglose categoría ingreso
    const mapaCat = {};
    ing.forEach(t => { const c = t.categoria || "Otro"; mapaCat[c] = (mapaCat[c] || 0) + Number(t.monto); });
    const catArr = Object.entries(mapaCat).sort((a, b) => b[1] - a[1]);

    // Desglose forma de pago
    const mapaPago = {};
    ing.forEach(t => {
      const desc = t.desc || t.descripcion || "";
      const match = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
      const fp = match ? match[1] : "Sin especificar";
      mapaPago[fp] = (mapaPago[fp] || 0) + Number(t.monto);
    });
    const pagoArr = Object.entries(mapaPago).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    // Desglose categoría gasto
    const mapaGas = {};
    gas.forEach(t => { const c = t.categoria || "Otro"; mapaGas[c] = (mapaGas[c] || 0) + Number(t.monto); });
    const gasArr = Object.entries(mapaGas).sort((a, b) => b[1] - a[1]);

    // Lista ordenada según filtro (calculada aquí para evitar re-render)
    const lista = [...filtradas].sort((a, b) => {
      const da = parseDate(a.fecha); const db2 = parseDate(b.fecha);
      if (da && db2) return db2 - da;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });

    return {
      txsFiltradas: filtradas,
      ingresos: ing,
      gastos: gas,
      totalIng: totIng,
      totalGas: totGas,
      utilidad: totIng - totGas,
      desgloseCat: catArr,
      desglosePago: pagoArr,
      desgloseGasto: gasArr,
      listaOrdenada: lista,
    };
  }, [txs, desde, hasta]);

  const txsFiltradas = cajaData.txsFiltradas;
  const ingresos = cajaData.ingresos;
  const gastos = cajaData.gastos;
  const totalIng = cajaData.totalIng;
  const totalGas = cajaData.totalGas;
  const utilidad = cajaData.utilidad;
  const desgloseCat = cajaData.desgloseCat;
  const desglosePago = cajaData.desglosePago;
  const desgloseGasto = cajaData.desgloseGasto;
  const listaOrdenada = tipoFiltro === "todos"
    ? cajaData.listaOrdenada
    : cajaData.listaOrdenada.filter(t => t.tipo === tipoFiltro);


  // Helper: extraer forma de pago de descripción
  const extraerFP = (t) => {
    const desc = t.desc || t.descripcion || "";
    const m = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
    return m ? m[1] : null;
  };

  // Helper: limpiar descripción para display en PDF
  const limpiarDesc = (desc) => (desc || "")
    .replace(/\s*\[(?:Efectivo|Transferencia|Tarjeta)\]/g, "")
    .replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "")
    .trim();

  // Generar corte
  const generarCorte = () => {
    const now = new Date();
    const horaCorte = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz });
    const fechaCorte = now.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: tz });

    const txsDetalle = [...txsFiltradas]
      .sort((a, b) => {
        const da = parseDate(a.fecha); const db2 = parseDate(b.fecha);
        if (da && db2) return db2 - da;
        return (b.fecha || "").localeCompare(a.fecha || "");
      })
      .map(t => {
        const mid = t.miembroId || t.miembro_id;
        const miembro = mid ? miembros.find(mb => String(mb.id) === String(mid)) : null;
        return {
          ...t,
          nombreMiembro: miembro?.nombre || null,
          formaPagoExtraida: extraerFP(t),
          descLimpia: limpiarDesc(t.desc || t.descripcion || ""),
        };
      });

    setCorte({
      horaCorte,
      fechaCorte,
      desde,
      hasta,
      totalIng,
      totalGas,
      utilidad,
      desgloseCat: [...desgloseCat],
      desglosePago: [...desglosePago],
      desgloseGasto: [...desgloseGasto],
      movimientos: txsFiltradas.length,
      txsDetalle,
    });
    setCopiadoCorte(false);
  };

  const descargarPDFCorte = async () => {
    if (!corte) return;
    setGenerandoPDF(true);
    try {
      await cargarScriptCaja("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await cargarScriptCaja("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const margin = 14;
      const gymNombre = gymConfig?.nombre || "GymFit Pro";
      const fmt$ = n => "$" + Number(n).toLocaleString("es-MX");
      const fpIcon = (fp) => fp === "Efectivo" ? "Efectivo" : fp === "Transferencia" ? "Transf." : fp === "Tarjeta" ? "Tarjeta" : "";

      // ── HEADER ──
      doc.setFillColor(108, 99, 255);
      doc.rect(0, 0, W, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17); doc.setFont("helvetica", "bold");
      doc.text(gymNombre, margin, 12);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("Corte de Caja", margin, 20);
      // Hora sin emoji — solo texto limpio
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(corte.horaCorte, W - margin, 13, { align: "right" });
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(corte.fechaCorte, W - margin, 21, { align: "right" });

      let y = 34;

      // ── PERÍODO ──
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(107, 114, 128);
      const periodoStr = corte.desde === corte.hasta
        ? "Periodo: " + fmtDate(corte.desde)
        : "Periodo: " + fmtDate(corte.desde) + "  ->  " + fmtDate(corte.hasta);
      doc.text(periodoStr.toUpperCase(), margin, y); y += 9;

      // ── TARJETAS RESUMEN ──
      const cards = [
        { label: "INGRESOS", value: fmt$(corte.totalIng), r: 22, g: 163, b: 74 },
        { label: "GASTOS", value: fmt$(corte.totalGas), r: 220, g: 38, b: 38 },
        { label: "UTILIDAD NETA", value: (corte.utilidad >= 0 ? "+" : "") + fmt$(corte.utilidad),
          r: corte.utilidad >= 0 ? 22 : 220, g: corte.utilidad >= 0 ? 163 : 38, b: corte.utilidad >= 0 ? 74 : 38 },
      ];
      const cardW = (W - margin * 2 - 8) / 3;
      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 4);
        doc.setDrawColor(230, 230, 240); doc.setLineWidth(0.4);
        doc.setFillColor(250, 250, 255);
        doc.roundedRect(x, y, cardW, 22, 3, 3, "FD");
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 140);
        doc.text(c.label, x + cardW / 2, y + 7, { align: "center" });
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.setTextColor(c.r, c.g, c.b);
        doc.text(c.value, x + cardW / 2, y + 17, { align: "center" });
      });
      y += 29;

      // ── RESUMEN POR FORMA DE PAGO (caja fisica) ──
      if (corte.desglosePago.length > 0) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 60, 180);
        doc.text("RESUMEN DE CAJA POR FORMA DE PAGO", margin, y); y += 5;
        doc.autoTable({
          startY: y,
          head: [["Forma de pago", "Total recibido"]],
          body: corte.desglosePago.map(([fp, val]) => [fp, fmt$(val)]),
          theme: "grid",
          headStyles: { fillColor: [108, 99, 255], fontSize: 9, fontStyle: "bold", halign: "left", textColor: [255,255,255] },
          bodyStyles: { fontSize: 11, fontStyle: "bold" },
          columnStyles: { 1: { halign: "right", textColor: [80, 60, 180], fontStyle: "bold" } },
          margin: { left: margin, right: margin },
          styles: { cellPadding: 4 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── INGRESOS — detalle por movimiento ──
      const ingDetalle = (corte.txsDetalle || []).filter(t => t.tipo === "ingreso");
      if (ingDetalle.length > 0) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74);
        doc.text("INGRESOS — DETALLE DE MOVIMIENTOS", margin, y); y += 5;
        doc.autoTable({
          startY: y,
          head: [["Fecha", "Concepto / Miembro", "Forma de pago", "Monto"]],
          body: ingDetalle.map(t => {
            const concepto = t.categoria || "Ingreso";
            const quien = t.nombreMiembro || t.descLimpia || "—";
            const fp = t.formaPagoExtraida || "—";
            return [fmtDate(t.fecha), `${concepto}
${quien}`, fp, fmt$(t.monto)];
          }),
          theme: "striped",
          headStyles: { fillColor: [22, 163, 74], fontSize: 8, fontStyle: "bold", textColor: [255,255,255] },
          bodyStyles: { fontSize: 8, valign: "middle" },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: "auto" },
            2: { cellWidth: 26, halign: "center" },
            3: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: [22, 163, 74] },
          },
          didDrawCell: (data) => {
            // Subtotal row styling handled via foot
          },
          foot: [[
            { content: "SUBTOTAL INGRESOS", colSpan: 3, styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: [240, 253, 244], textColor: [22, 163, 74] } },
            { content: fmt$(corte.totalIng), styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: [240, 253, 244], textColor: [22, 163, 74] } },
          ]],
          footStyles: { fillColor: [240, 253, 244] },
          margin: { left: margin, right: margin },
          styles: { cellPadding: 3, lineColor: [230, 230, 230], lineWidth: 0.2 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── GASTOS — detalle por movimiento ──
      const gasDetalle = (corte.txsDetalle || []).filter(t => t.tipo === "gasto");
      if (gasDetalle.length > 0) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text("GASTOS — DETALLE DE MOVIMIENTOS", margin, y); y += 5;
        doc.autoTable({
          startY: y,
          head: [["Fecha", "Concepto / Descripcion", "Categoria", "Monto"]],
          body: gasDetalle.map(t => [
            fmtDate(t.fecha),
            t.descLimpia || "—",
            t.categoria || "—",
            fmt$(t.monto),
          ]),
          theme: "striped",
          headStyles: { fillColor: [220, 38, 38], fontSize: 8, fontStyle: "bold", textColor: [255,255,255] },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: "auto" },
            2: { cellWidth: 28 },
            3: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: [220, 38, 38] },
          },
          foot: [[
            { content: "SUBTOTAL GASTOS", colSpan: 3, styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: [255, 241, 242], textColor: [220, 38, 38] } },
            { content: fmt$(corte.totalGas), styles: { halign: "right", fontStyle: "bold", fontSize: 9, fillColor: [255, 241, 242], textColor: [220, 38, 38] } },
          ]],
          footStyles: { fillColor: [255, 241, 242] },
          margin: { left: margin, right: margin },
          styles: { cellPadding: 3, lineColor: [230, 230, 230], lineWidth: 0.2 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── UTILIDAD FINAL ──
      doc.setFillColor(corte.utilidad >= 0 ? 240 : 255, corte.utilidad >= 0 ? 253 : 241, corte.utilidad >= 0 ? 244 : 242);
      doc.setDrawColor(corte.utilidad >= 0 ? 22 : 220, corte.utilidad >= 0 ? 163 : 38, corte.utilidad >= 0 ? 74 : 38);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, "FD");
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.setTextColor(corte.utilidad >= 0 ? 22 : 220, corte.utilidad >= 0 ? 163 : 38, corte.utilidad >= 0 ? 74 : 38);
      doc.text("UTILIDAD NETA DEL PERIODO", margin + 6, y + 7);
      doc.setFontSize(13);
      doc.text((corte.utilidad >= 0 ? "+" : "") + fmt$(corte.utilidad), W - margin - 4, y + 10, { align: "right" });
      y += 22;

      // ── FOOTER ──
      const pageH = doc.internal.pageSize.height;
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      doc.text(gymNombre + "  |  Corte generado el " + corte.fechaCorte + " a las " + corte.horaCorte, W / 2, pageH - 8, { align: "center" });

      const periodoFileName = corte.desde === corte.hasta ? corte.desde : corte.desde + "_" + corte.hasta;
      doc.save("corte-caja-" + gymNombre.replace(/\s+/g, "-").toLowerCase() + "-" + periodoFileName + ".pdf");
    } catch (err) {
      console.error("Error generando PDF corte:", err);
      alert("No se pudo generar el PDF. Verifica tu conexion.");
    } finally {
      setGenerandoPDF(false);
    }
  };

  const textoCorte = corte ? `🏋️ ${gymConfig?.nombre || "GymFit Pro"} — CORTE DE CAJA
📅 ${corte.fechaCorte}
⏰ Hora del corte: ${corte.horaCorte}
📆 Período: ${fmtDate(corte.desde)} → ${fmtDate(corte.hasta)}

💰 INGRESOS: $${Number(corte.totalIng).toLocaleString("es-MX")}
${corte.desgloseCat.map(([c, v]) => `  · ${CAT_ICON[c] || "📌"} ${c}: $${Number(v).toLocaleString("es-MX")}`).join("\n")}
${corte.desglosePago.length > 0 ? "\n💳 Por forma de pago:\n" + corte.desglosePago.map(([fp, v]) => `  · ${fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : fp === "Tarjeta" ? "💳" : "❓"} ${fp}: $${Number(v).toLocaleString("es-MX")}`).join("\n") : ""}

💸 GASTOS: $${Number(corte.totalGas).toLocaleString("es-MX")}
${corte.desgloseGasto.map(([c, v]) => `  · ${CAT_ICON[c] || "📌"} ${c}: $${Number(v).toLocaleString("es-MX")}`).join("\n")}

📊 UTILIDAD NETA: ${corte.utilidad >= 0 ? "+" : ""}$${Number(Math.abs(corte.utilidad)).toLocaleString("es-MX")}
📋 Total movimientos: ${corte.movimientos}` : "";

  const fmt$ = n => "$" + Number(n).toLocaleString("es-MX");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "#fff", fontSize: 19, fontWeight: 700 }}>💵 Caja</h1>
            <p style={{ color: "#4b4b6a", fontSize: 11 }}>Movimientos por fecha · Corte de caja</p>
          </div>
        </div>

        {/* Períodos rápidos */}
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
          {PERIODOS.map((p, i) => (
            <button key={i} onClick={() => aplicarPeriodo(i)}
              style={{ flexShrink: 0, padding: "6px 12px", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all .15s",
                background: periodoActivo === i ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.07)",
                color: periodoActivo === i ? "#fff" : "#9ca3af",
                boxShadow: periodoActivo === i ? "0 2px 10px rgba(108,99,255,.3)" : "none" }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
          <div>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Desde</p>
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPeriodoActivo(-1); }}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Hasta</p>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPeriodoActivo(-1); }}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
      </div>

      {/* ── Contenido scrollable ── */}
      <div className="gym-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "10px 20px 0" }}>

        {/* ── Resumen financiero ── */}
        <div style={{ background: "linear-gradient(135deg,#1e1e3a,#251e3a)", borderRadius: 22, padding: "18px 18px 14px", marginBottom: 14, border: "1px solid rgba(108,99,255,.25)", boxShadow: "0 6px 28px rgba(0,0,0,.3)" }}>
          <p style={{ color: "rgba(255,255,255,.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            {desde === hasta ? `📅 ${fmtDate(desde)}` : `📅 ${fmtDate(desde)} → ${fmtDate(hasta)}`}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Ingresos", val: totalIng, color: "#4ade80", bg: "rgba(74,222,128,.1)", border: "rgba(74,222,128,.2)" },
              { label: "Gastos", val: totalGas, color: "#f87171", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.2)" },
              { label: "Utilidad", val: utilidad, color: utilidad >= 0 ? "#4ade80" : "#f87171", bg: utilidad >= 0 ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: utilidad >= 0 ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)" },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{card.label}</p>
                <p style={{ color: card.color, fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{card.val < 0 ? "-" : card.label === "Utilidad" && card.val > 0 ? "+" : ""}{fmt$(Math.abs(card.val))}</p>
              </div>
            ))}
          </div>
          <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "center" }}>{txsFiltradas.length} movimiento{txsFiltradas.length !== 1 ? "s" : ""} en el período</p>
        </div>

        {/* ── Desglose ingresos por categoría ── */}
        {desgloseCat.length > 0 && (
          <div style={{ background: "rgba(74,222,128,.05)", border: "1px solid rgba(74,222,128,.15)", borderRadius: 18, padding: "14px 16px", marginBottom: 12 }}>
            <p style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>💰 Ingresos por concepto</p>
            {desgloseCat.map(([cat, val]) => {
              const pct = totalIng > 0 ? (val / totalIng * 100) : 0;
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📌"}</span>
                      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{cat}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "#4ade80", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{fmt$(val)}</span>
                      <span style={{ color: "#4b4b6a", fontSize: 10, marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#4ade80,#22d3ee)", borderRadius: 2, transition: "width .4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Desglose por forma de pago ── */}
        {desglosePago.length > 0 && (
          <div style={{ background: "rgba(167,139,250,.05)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 18, padding: "14px 16px", marginBottom: 12 }}>
            <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>💳 Por forma de pago</p>
            <div style={{ display: "flex", gap: 8 }}>
              {desglosePago.map(([fp, val]) => {
                const icon = fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : fp === "Tarjeta" ? "💳" : "❓";
                const pct = totalIng > 0 ? (val / totalIng * 100) : 0;
                return (
                  <div key={fp} style={{ flex: 1, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 20, marginBottom: 4 }}>{icon}</p>
                    <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt$(val)}</p>
                    <p style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>{fp}</p>
                    <p style={{ color: "#4b4b6a", fontSize: 9, marginTop: 1 }}>{pct.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Desglose gastos por categoría ── */}
        {desgloseGasto.length > 0 && (
          <div style={{ background: "rgba(248,113,113,.05)", border: "1px solid rgba(248,113,113,.12)", borderRadius: 18, padding: "14px 16px", marginBottom: 12 }}>
            <p style={{ color: "#f87171", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>💸 Gastos por categoría</p>
            {desgloseGasto.map(([cat, val]) => {
              const pct = totalGas > 0 ? (val / totalGas * 100) : 0;
              return (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📌"}</span>
                    <span style={{ color: "#d1d5db", fontSize: 13 }}>{cat}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(255,255,255,.06)" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#f87171", borderRadius: 2 }} />
                    </div>
                    <span style={{ color: "#f87171", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{fmt$(val)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Botón Corte de Caja ── */}
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "16px", marginBottom: 14 }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📸 Corte de caja</p>
          <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 14 }}>Genera un resumen sellado con la hora exacta del corte.</p>
          <button onClick={generarCorte}
            style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
              boxShadow: "0 4px 18px rgba(108,99,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📸</span> Hacer corte ahora
          </button>

          {/* Resultado del corte */}
          {corte && (
            <div style={{ marginTop: 14, background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 16, padding: "14px 16px", animation: "fadeUp .3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>⏰ {corte.horaCorte}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{corte.fechaCorte}</p>
                </div>
                <span style={{ background: "rgba(74,222,128,.15)", color: "#4ade80", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>✓ Cerrado</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Ingresos", val: corte.totalIng, color: "#4ade80" },
                  { label: "Gastos", val: corte.totalGas, color: "#f87171" },
                  { label: "Utilidad", val: corte.utilidad, color: corte.utilidad >= 0 ? "#4ade80" : "#f87171" },
                ].map(c => (
                  <div key={c.label} style={{ flex: 1, textAlign: "center" }}>
                    <p style={{ color: "#4b4b6a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{c.label}</p>
                    <p style={{ color: c.color, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{fmt$(c.val)}</p>
                  </div>
                ))}
              </div>
              {/* Desglose categorías en el corte */}
              {corte.desgloseCat.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10, marginBottom: 10 }}>
                  {corte.desgloseCat.map(([cat, val]) => (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: "#6b7280", fontSize: 11 }}>{CAT_ICON[cat] || "📌"} {cat}</span>
                      <span style={{ color: "#4ade80", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmt$(val)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Forma de pago en el corte */}
              {corte.desglosePago.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10, marginBottom: 10 }}>
                  <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>Forma de pago</p>
                  {corte.desglosePago.map(([fp, val]) => {
                    const icon = fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : fp === "Tarjeta" ? "💳" : "❓";
                    return (
                      <div key={fp} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{icon} {fp}</span>
                        <span style={{ color: "#a78bfa", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmt$(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Botones compartir */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={descargarPDFCorte} disabled={generandoPDF}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 12, cursor: generandoPDF ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                    background: generandoPDF ? "rgba(255,255,255,.06)" : "linear-gradient(135deg,#f43f5e,#e11d48)",
                    color: generandoPDF ? "#4b4b6a" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: generandoPDF ? "none" : "0 3px 12px rgba(244,63,94,.35)" }}>
                  <span style={{ fontSize: 14 }}>{generandoPDF ? "⏳" : "📄"}</span>
                  {generandoPDF ? "Generando..." : "Descargar PDF"}
                </button>
                <button onClick={() => { const url = `https://wa.me/?text=${encodeURIComponent(textoCorte)}`; window.open(url, "_blank"); }}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                    background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: "0 3px 12px rgba(37,211,102,.3)" }}>
                  <span style={{ fontSize: 14 }}>💬</span> WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Lista de movimientos ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[{ val: "todos", label: "Todos" }, { val: "ingreso", label: "💰 Ingresos" }, { val: "gasto", label: "💸 Gastos" }].map(f => (
              <button key={f.val} onClick={() => setTipoFiltro(f.val)}
                style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all .15s",
                  background: tipoFiltro === f.val ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.07)",
                  color: tipoFiltro === f.val ? "#fff" : "#6b7280" }}>
                {f.label}
              </button>
            ))}
          </div>

          {listaOrdenada.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
              <p style={{ color: "#4b4b6a", fontSize: 13 }}>Sin movimientos en este período</p>
            </div>
          ) : listaOrdenada.map(t => {
            const isIng = t.tipo === "ingreso";
            const color = isIng ? "#4ade80" : "#f87171";
            const mFoto = isIng && (t.miembroId || t.miembro_id)
              ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null)
              : null;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, marginBottom: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: isIng ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, overflow: "hidden", border: `2px solid ${color}30` }}>
                  {mFoto ? <img src={mFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || (isIng ? "💰" : "💸")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc || t.descripcion || "—"}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span style={{ background: isIng ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.12)", color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{t.categoria}</span>
                    <span style={{ color: "#4b4b6a", fontSize: 10 }}>· {fmtDate(t.fecha)}</span>
                  </div>
                </div>
                <p style={{ color, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {isIng ? "+" : "-"}{fmt$(t.monto)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CajaScreen;
