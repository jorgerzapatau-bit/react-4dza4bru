// ─────────────────────────────────────────────
//  src/hooks/useReservations.js
//
//  Hook de datos para Catálogo + Reservas.
//  Usa el mismo patrón REST que useCommunication.js
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// ── Helpers REST (mismo patrón que useCommunication) ──────────────
function sbUrl(path) {
  return `${supabase.url}/rest/v1/${path}`;
}

function sbHeaders(extra = {}) {
  return {
    apikey:         supabase.key,
    Authorization:  `Bearer ${supabase.key}`,
    "Content-Type": "application/json",
    Prefer:         "return=representation",
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

async function sbPost(path, body) {
  const res = await fetch(sbUrl(path), {
    method:  "POST",
    headers: sbHeaders(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(path, body) {
  const res = await fetch(sbUrl(path), {
    method:  "PATCH",
    headers: sbHeaders(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbDelete(path) {
  const res = await fetch(sbUrl(path), {
    method:  "DELETE",
    headers: sbHeaders(),
  });
  return res.ok;
}

// ─────────────────────────────────────────────
//  Hook principal
// ─────────────────────────────────────────────
export function useReservations(gymId) {
  const [products,     setProducts]     = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments,     setPayments]     = useState([]); // todos los pagos del gym
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // ── Carga inicial ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!gymId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [prods, res] = await Promise.all([
        sbGet(`products?gym_id=eq.${gymId}&order=created_at.asc`),
        sbGet(`product_reservations?gym_id=eq.${gymId}&order=created_at.desc`),
      ]);

      setProducts(prods || []);
      setReservations(res || []);

      // Cargar pagos solo si hay reservas
      if (res && res.length > 0) {
        const pays = await sbGet(`reservation_payments?gym_id=eq.${gymId}&order=created_at.asc`);
        setPayments(pays || []);
      }
    } catch (err) {
      console.error("[useReservations] load error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── PRODUCTOS ─────────────────────────────────────────────────

  const saveProduct = useCallback(async (productData) => {
    const body = { ...productData, gym_id: gymId, updated_at: new Date().toISOString() };
    if (productData.id) {
      // update
      const updated = await sbPatch(`products?id=eq.${productData.id}&gym_id=eq.${gymId}`, body);
      setProducts(prev => prev.map(p => p.id === productData.id ? { ...p, ...body } : p));
      return updated || body;
    } else {
      // insert
      const { id: _skip, ...insertBody } = body;
      const created = await sbPost("products", insertBody);
      setProducts(prev => [...prev, created]);
      return created;
    }
  }, [gymId]);

  const deleteProduct = useCallback(async (productId) => {
    await sbDelete(`products?id=eq.${productId}&gym_id=eq.${gymId}`);
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, [gymId]);

  const toggleProductActive = useCallback(async (productId, isActive) => {
    await sbPatch(`products?id=eq.${productId}&gym_id=eq.${gymId}`, { is_active: isActive, updated_at: new Date().toISOString() });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: isActive } : p));
  }, [gymId]);

  // ── RESERVAS ──────────────────────────────────────────────────

  const createReservation = useCallback(async (data) => {
    // data: { member_id, product_id, quantity, unit_price, deposit_amount, expected_arrival_date, notes }
    const total = data.unit_price * data.quantity;
    const body = {
      gym_id:               gymId,
      member_id:            data.member_id,
      product_id:           data.product_id,
      quantity:             data.quantity || 1,
      unit_price:           data.unit_price,
      total_amount:         total,
      deposit_amount:       data.deposit_amount || 0,
      balance_due:          total - (data.deposit_amount || 0),
      status:               data.deposit_amount > 0 ? "partially_paid" : "reserved",
      expected_arrival_date: data.expected_arrival_date || null,
      notes:                data.notes || null,
    };
    const created = await sbPost("product_reservations", body);
    setReservations(prev => [created, ...prev]);

    // Registrar anticipo inicial como primer pago si > 0
    if (data.deposit_amount > 0) {
      await addPayment({
        reservation_id: created.id,
        amount:         data.deposit_amount,
        payment_method: data.payment_method || "Efectivo",
        notes:          "Anticipo inicial",
      });
    }
    return created;
  }, [gymId, addPayment]); // addPayment is stable (useCallback)

  const updateReservationStatus = useCallback(async (reservationId, newStatus, extra = {}) => {
    const body = { status: newStatus, updated_at: new Date().toISOString(), ...extra };
    await sbPatch(`product_reservations?id=eq.${reservationId}&gym_id=eq.${gymId}`, body);
    setReservations(prev => prev.map(r =>
      r.id === reservationId ? { ...r, ...body } : r
    ));
  }, [gymId]);

  const cancelReservation = useCallback(async (reservationId) => {
    await updateReservationStatus(reservationId, "cancelled");
  }, [updateReservationStatus]);

  // ── PAGOS ─────────────────────────────────────────────────────

  const addPayment = useCallback(async (data) => {
    // data: { reservation_id, amount, payment_method, notes }
    const body = {
      gym_id:         gymId,
      reservation_id: data.reservation_id,
      amount:         data.amount,
      payment_method: data.payment_method || "Efectivo",
      notes:          data.notes || null,
    };
    const created = await sbPost("reservation_payments", body);
    setPayments(prev => [...prev, created]);

    // Recargar la reserva actualizada (el trigger ya recalculó en DB)
    const updated = await sbGet(
      `product_reservations?id=eq.${data.reservation_id}&gym_id=eq.${gymId}`
    );
    if (updated && updated[0]) {
      setReservations(prev => prev.map(r =>
        r.id === data.reservation_id ? updated[0] : r
      ));
    }
    return created;
  }, [gymId]);

  // ── Helpers derivados ─────────────────────────────────────────

  const getPaymentsForReservation = useCallback((reservationId) => {
    return payments.filter(p => p.reservation_id === reservationId);
  }, [payments]);

  const getReservationsForMember = useCallback((memberId) => {
    return reservations.filter(r => r.member_id === memberId);
  }, [reservations]);

  const getProductById = useCallback((productId) => {
    return products.find(p => p.id === productId) || null;
  }, [products]);

  return {
    // estado
    products,
    reservations,
    payments,
    loading,
    error,
    // productos
    saveProduct,
    deleteProduct,
    toggleProductActive,
    // reservas
    createReservation,
    updateReservationStatus,
    cancelReservation,
    // pagos
    addPayment,
    // helpers
    getPaymentsForReservation,
    getReservationsForMember,
    getProductById,
    reload: loadAll,
  };
}
