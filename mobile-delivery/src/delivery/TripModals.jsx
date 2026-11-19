/**
 * Ports of DeliveryV2/components/modals/{NewOrderModal, PickupActionModal, DeliveryVerificationModal, OrderSummaryModal,
 * PhotoUploadModal} + the PICKED_UP / REACHED_DROP drop panel from DeliveryHomeV2.jsx.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  ChevronDown, ChevronUp, MapPin, Store, Phone, Navigation, CheckCircle2, Banknote, CreditCard, Package, ShieldCheck, RefreshCw, X, DollarSign, QrCode, Clock, FastForward, ChefHat, Camera,
} from "lucide-react-native";
import Txt from "../components/ui/Txt";
import ActionSlider from "./ActionSlider";
import { deliveryAPI, locationAPI } from "../api";
import { toast } from "../utils/toast";
import { useDeliveryStore } from "./store";
import { getCustomerDisplayInfo, getHaversineDistance, getOrderDisplayId, getOrderMongoId, getOrderPaymentInfo, getRestaurantDisplayInfo, isSameOrder, parseLatLng } from "./orderUtils";
import { fonts, palette, dv } from "../theme";

const GRAD_DARK = "#15498b";
const call = (num) => num && Linking.openURL(`tel:${String(num).replace(/[^\d+]/g, "")}`);
const openMaps = (coords, query) =>
  Linking.openURL(
    coords ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "")}`,
  );

function Sheet({ children, onClose, bottomOffset = 0 }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 12) + bottomOffset }]} pointerEvents="box-none">
      <View style={styles.sheet}>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.grabber} hitSlop={10}>
            <ChevronDown size={24} color={palette.gray400} strokeWidth={3} />
          </Pressable>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ NEW ORDER OFFER */
export function NewOrderModal({ order, queuedOrders = [], onSelectOrder, onAccept, onReject, onMinimize }) {
  const insets = useSafeAreaInsets();
  const riderLocation = useDeliveryStore((s) => s.riderLocation);
  const [timeLeft, setTimeLeft] = useState(60);
  const orderKey = getOrderMongoId(order) || getOrderDisplayId(order);
  const rest = useMemo(() => getRestaurantDisplayInfo(order), [order]);
  const cust = useMemo(() => getCustomerDisplayInfo(order), [order]);
  const pay = useMemo(() => getOrderPaymentInfo(order), [order]);
  const rejectRef = useRef(onReject);
  rejectRef.current = onReject;

  useEffect(() => setTimeLeft(60), [orderKey]);
  useEffect(() => {
    if (timeLeft <= 0) {
      rejectRef.current?.();
      return undefined;
    }
    const t = setInterval(() => setTimeLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const dist = useMemo(() => {
    const fmt = (km) => (km != null && Number.isFinite(km) ? km.toFixed(1) : "??");
    const eta = (m, extra = 0) => Math.max(1, Math.ceil(m / 416) + extra);
    let pKm = null;
    let pEta = null;
    const rawP = order?.pickupDistanceKm ?? order?.distanceKm;
    if (rawP != null) {
      pKm = Number(rawP);
      const rawEta = order.estimatedTime || order.duration || order.eta;
      pEta = rawEta && rawEta > 0 ? Math.ceil(rawEta) : eta(pKm * 1000, 5);
    } else if (riderLocation && rest?.coords) {
      const m = getHaversineDistance(riderLocation.lat, riderLocation.lng, rest.coords.lat, rest.coords.lng);
      pKm = m / 1000;
      pEta = eta(m, order?.prepTime || 5);
    }
    let dKm = null;
    let dEta = null;
    const rawD = order?.dropDistanceKm ?? order?.deliveryDistanceKm;
    if (rawD != null) {
      dKm = Number(rawD);
      dEta = order.dropEta ? Math.ceil(order.dropEta) : eta(dKm * 1000);
    } else if (rest?.coords && cust?.coords) {
      const m = getHaversineDistance(rest.coords.lat, rest.coords.lng, cust.coords.lat, cust.coords.lng);
      dKm = m / 1000;
      dEta = eta(m);
    }
    return {
      pickup: `${fmt(pKm)} km • ${pEta ?? "??"} min`,
      drop: `${fmt(dKm)} km • ${dEta ?? "??"} min`,
      total: `${fmt(pKm != null && dKm != null ? pKm + dKm : null)} km`,
    };
  }, [order, riderLocation, rest, cust]);

  if (!order) return null;
  const bonus = Number(order.deliveryBonusAmount || 0);
  const earnings = Number(order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0)) || 0;
  const base = Math.max(0, earnings - bonus);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onMinimize}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.offerCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable onPress={onMinimize} style={styles.grabber} hitSlop={10}>
            <ChevronDown size={24} color={palette.gray400} strokeWidth={3} />
          </Pressable>
          <View style={styles.offerHead}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt weight={800} style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5 }}>INCOMING REQUEST</Txt>
                <Txt weight={900} style={[styles.payChip, pay.isCod ? styles.payCod : styles.payPaid]}>{pay.paymentLabel}</Txt>
              </View>
              <Txt weight={900} style={{ fontSize: 34, color: palette.white, marginTop: 2 }}>₹{earnings.toFixed(2)}</Txt>
              {bonus > 0 ? <Txt weight={600} style={{ fontSize: 12, color: "#86efac" }}>(₹{base.toFixed(0)} + ₹{bonus.toFixed(0)} Bonus)</Txt> : null}
              <Txt weight={500} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                Order Value: <Txt weight={800} style={{ fontSize: 12, color: palette.white }}>₹{pay.totalAmount.toFixed(2)}</Txt>
              </Txt>
            </View>
            <View style={styles.timer}>
              <Txt weight={900} style={{ fontSize: 18, color: palette.white }}>{timeLeft}s</Txt>
            </View>
          </View>

          {queuedOrders.length > 1 ? (
            <View style={{ paddingTop: 10 }}>
              <Txt weight={700} style={{ fontSize: 11, color: palette.gray500, paddingHorizontal: 16, marginBottom: 6 }}>{queuedOrders.length} orders available — tap to switch</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {queuedOrders.map((q, i) => {
                  const active = isSameOrder(q, order);
                  const qp = getOrderPaymentInfo(q);
                  return (
                    <Pressable key={getOrderMongoId(q) || i} onPress={() => onSelectOrder?.(q)} style={[styles.qChip, active && styles.qChipActive]}>
                      <Txt weight={800} numberOfLines={1} style={{ fontSize: 12, color: active ? palette.white : palette.gray800 }}>{getOrderDisplayId(q) || `Order ${i + 1}`}</Txt>
                      <Txt weight={700} style={{ fontSize: 11, color: active ? "#86efac" : palette.green700 }}>₹{Number(q.earnings || q.riderEarning || q.pricing?.deliveryFee || 0).toFixed(0)} • {qp.paymentLabel}</Txt>
                      <Txt numberOfLines={1} style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.7)" : palette.gray500 }}>{getRestaurantDisplayInfo(q).name}</Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 330 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={styles.stop}>
              <View style={[styles.stopIcon, { backgroundColor: "#fff7ed" }]}>
                <ChefHat size={16} color={dv.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.stopHeadRow}>
                  <Txt weight={800} style={styles.stopKicker}>RESTAURANT PICKUP</Txt>
                  <Txt weight={700} style={styles.stopDist}>{dist.pickup}</Txt>
                </View>
                <Txt weight={700} style={styles.stopName}>{rest.name}</Txt>
                <Txt numberOfLines={2} style={styles.stopAddr}>{rest.address}</Txt>
              </View>
            </View>
            <View style={styles.stop}>
              <View style={[styles.stopIcon, { backgroundColor: palette.green50 }]}>
                <MapPin size={16} color={palette.green600} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.stopHeadRow}>
                  <Txt weight={800} style={styles.stopKicker}>CUSTOMER DROP</Txt>
                  <Txt weight={700} style={styles.stopDist}>{dist.drop}</Txt>
                </View>
                <Txt weight={700} style={styles.stopName}>{cust.name && cust.name !== "Customer" ? cust.name : "Customer Drop"}</Txt>
                <Txt numberOfLines={2} style={styles.stopAddr}>{cust.address}</Txt>
              </View>
            </View>
            <View style={[styles.payBox, pay.isCod ? { backgroundColor: "#fffbeb", borderColor: "#fde68a" } : { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
              <View style={[styles.payIcon, { backgroundColor: pay.isCod ? "#f59e0b" : "#059669" }]}>{pay.isCod ? <Banknote size={16} color={palette.white} /> : <CreditCard size={16} color={palette.white} />}</View>
              <View style={{ flex: 1 }}>
                <Txt weight={800} style={{ fontSize: 12, color: pay.isCod ? "#78350f" : "#064e3b" }}>{pay.paymentLabel} • {pay.paymentStatusText}</Txt>
                <Txt style={{ fontSize: 11, color: pay.isCod ? "#92400e" : "#065f46" }}>{pay.collectionNotice}</Txt>
              </View>
              <Txt weight={900} style={{ fontSize: 15, color: palette.gray900 }}>{pay.formattedTotal}</Txt>
            </View>
            <Txt weight={600} style={{ fontSize: 11, color: palette.gray500, textAlign: "center" }}>Total trip: {dist.total}</Txt>
          </ScrollView>

          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <ActionSlider label="Slide to Accept" successLabel="Accepted!" onConfirm={() => onAccept(order)} color={palette.green600} />
            <Pressable onPress={onReject} style={styles.passBtn}>
              <FastForward size={16} color={palette.gray700} />
              <Txt weight={800} style={{ fontSize: 12, color: palette.gray700, letterSpacing: 1.5 }}>PASS ORDER</Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ PICKUP PANEL */
export function PickupPanel({ order, status, isWithinRange, distanceToTarget, eta, onReachedPickup, onPickedUp, onMarkDelivered, onMinimize, onNavigate, bottomOffset }) {
  const [showItems, setShowItems] = useState(false);
  const [pickupOtp, setPickupOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [requesting, setRequesting] = useState(false);
  if (!order) return null;
  const atPickup = status === "REACHED_PICKUP";
  const rest = getRestaurantDisplayInfo(order);
  const logo = order.restaurantImage || order.restaurant?.logo || order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || order.restaurantId?.logo;
  const items = order.items || [];
  const distanceLabel = Number.isFinite(distanceToTarget) ? `${(distanceToTarget / 1000).toFixed(1)} km • ${eta || "--"} min to Store` : "Locating your position...";

  const requestOtp = async () => {
    const id = order.order_id || order.orderId || order._id || order.orderMongoId;
    if (!id) return toast.error("Order ID missing");
    setRequesting(true);
    try {
      await deliveryAPI.requestPickupOtp(id);
      setOtpRequested(true);
      setSkipped(false);
      toast.success("OTP sent to restaurant! Ask them for the code.");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to send OTP to restaurant");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Sheet onClose={onMinimize} bottomOffset={bottomOffset}>
      <View style={styles.panelHead}>
        {logo && typeof logo === "string" ? <Image source={{ uri: logo }} style={styles.logo} /> : <View style={[styles.logo, { alignItems: "center", justifyContent: "center", backgroundColor: "#fff7ed" }]}><Store size={20} color={dv.orange} /></View>}
        <View style={{ flex: 1 }}>
          <Txt weight={800} numberOfLines={1} style={{ fontSize: 16, color: palette.gray900 }}>{rest.name}</Txt>
          <Txt weight={700} style={{ fontSize: 11, color: palette.gray400, letterSpacing: 1 }}>ORDER #{order.order_id || order.orderId || order._id}</Txt>
          <Txt weight={700} style={{ fontSize: 12, color: atPickup ? palette.green600 : dv.orange, marginTop: 2 }}>{atPickup ? "Reached Location ✓" : distanceLabel}</Txt>
        </View>
        {rest.phone ? (
          <Pressable onPress={() => call(rest.phone)} style={styles.roundBtn}>
            <Phone size={18} color={palette.blue600} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => (onNavigate ? onNavigate(rest.coords) : openMaps(rest.coords, `${rest.name}, ${rest.address}`))} style={[styles.roundBtn, { backgroundColor: palette.gray900 }]}>
          <Navigation size={18} color={palette.white} />
        </Pressable>
      </View>

      {!atPickup ? (
        <View style={{ gap: 10 }}>
          <Txt weight={700} style={[styles.hint, { color: isWithinRange ? palette.green600 : dv.orange }]}>{isWithinRange ? "READY - SWIPE TO CONFIRM ARRIVAL" : "GET CLOSER TO RESTAURANT"}</Txt>
          <ActionSlider label="Slide to Reach" successLabel="Reached!" disabled={!isWithinRange} onConfirm={onReachedPickup} color={palette.green600} />
          <Pressable onPress={() => onMarkDelivered?.(order)} style={styles.markBtn}>
            <CheckCircle2 size={16} color="#059669" />
            <Txt weight={700} style={{ fontSize: 12, color: "#065f46", letterSpacing: 1 }}>MARK AS DELIVERED</Txt>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Txt weight={700} style={[styles.hint, { color: palette.gray600 }]}>
            {skipped ? "OTP BYPASSED — SWIPE TO PICK UP" : otpRequested ? "ENTER OTP & SWIPE TO PICK UP" : "REQUEST OTP FROM RESTAURANT OR SKIP"}
          </Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={requestOtp} disabled={requesting} style={[styles.otpBtn, { flex: 1 }]}>
              {requesting ? <ActivityIndicator size="small" color={palette.white} /> : <Txt weight={800} style={{ fontSize: 12, color: palette.white, letterSpacing: 1 }}>{otpRequested ? "🔔 RESEND" : "🔔 REQUEST OTP"}</Txt>}
            </Pressable>
            <Pressable
              onPress={() => {
                setSkipped(true);
                setPickupOtp("");
                toast.info("OTP Step Bypassed! Slide to Pick Up");
              }}
              style={[styles.skipBtn, skipped && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }]}
            >
              <FastForward size={14} color={skipped ? palette.white : palette.gray700} />
              <Txt weight={800} style={{ fontSize: 12, color: skipped ? palette.white : palette.gray700, letterSpacing: 1 }}>{skipped ? "SKIPPED ✓" : "SKIP OTP"}</Txt>
            </Pressable>
          </View>
          {otpRequested && !skipped ? (
            <>
              <TextInput
                value={pickupOtp}
                onChangeText={(t) => setPickupOtp(t.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="Enter 4-digit Pickup OTP"
                placeholderTextColor={palette.gray400}
                style={styles.otpInput}
              />
              <ActionSlider label="Slide to Pick Up" successLabel="Picked Up!" disabled={pickupOtp.length !== 4} onConfirm={() => onPickedUp(null, pickupOtp)} color="#f97316" />
            </>
          ) : null}
          {skipped ? <ActionSlider label="Slide to Pick Up (Bypass OTP)" successLabel="Picked Up!" onConfirm={() => onPickedUp(null, "SKIP")} color="#d97706" /> : null}
          <Pressable onPress={() => onMarkDelivered?.(order)} style={styles.markBtn}>
            <CheckCircle2 size={16} color="#059669" />
            <Txt weight={700} style={{ fontSize: 12, color: "#065f46", letterSpacing: 1 }}>MARK AS DELIVERED</Txt>
          </Pressable>
        </View>
      )}

      {order.note ? (
        <View style={styles.noteBox}>
          <ChefHat size={16} color={dv.orange} />
          <View style={{ flex: 1 }}>
            <Txt weight={800} style={{ fontSize: 10, color: dv.orange, letterSpacing: 1.5 }}>USER INSTRUCTIONS</Txt>
            <Txt weight={700} style={{ fontSize: 13, color: palette.gray900 }}>"{order.note}"</Txt>
          </View>
        </View>
      ) : null}
      <Pressable onPress={() => setShowItems((v) => !v)} style={styles.itemsToggle}>
        <Package size={16} color={palette.gray600} />
        <Txt weight={700} style={{ fontSize: 13, color: palette.gray700, flex: 1 }}>Order Details ({items.length || 0})</Txt>
        {showItems ? <ChevronDown size={16} color={palette.gray500} /> : <ChevronUp size={16} color={palette.gray500} />}
      </Pressable>
      {showItems
        ? items.map((it, i) => (
            <View key={i} style={styles.itemRow}>
              <Txt weight={600} style={{ fontSize: 13, color: palette.gray800, flex: 1 }}>{it.name || "Item Name"}</Txt>
              <Txt weight={800} style={{ fontSize: 13, color: palette.gray900 }}>x{it.quantity || 1}</Txt>
            </View>
          ))
        : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ DROP PANEL (PICKED_UP / REACHED_DROP) */
export function DropPanel({ order, status, isWithinRange, distanceToTarget, eta, onReachedDrop, onVerify, onMarkDelivered, onMinimize, onNavigate, bottomOffset }) {
  if (!order) return null;
  const cust = getCustomerDisplayInfo(order);
  if (status === "REACHED_DROP") {
    return (
      <View style={[styles.sheetWrap, { paddingBottom: 16 + (bottomOffset || 0) }]} pointerEvents="box-none">
        <Pressable onPress={onVerify} style={styles.verifyBtn}>
          <CheckCircle2 size={22} color={palette.white} />
          <Txt weight={800} style={{ fontSize: 14, color: palette.white, letterSpacing: 2 }}>VERIFY & COMPLETE</Txt>
        </Pressable>
      </View>
    );
  }
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <Sheet onClose={onMinimize} bottomOffset={bottomOffset}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <MapPin size={14} color={palette.blue600} />
        <Txt weight={800} style={{ fontSize: 10, color: palette.blue600, letterSpacing: 1.5 }}>HANDOVER DROP</Txt>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt weight={700} style={{ fontSize: 17, color: palette.gray900 }}>{cust.name}</Txt>
          <Txt numberOfLines={2} style={{ fontSize: 13, color: palette.gray500, marginTop: 2 }}>{cust.address}</Txt>
        </View>
        {cust.phone ? (
          <Pressable onPress={() => call(cust.phone)} style={styles.roundBtn}>
            <Phone size={18} color={palette.blue600} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => (onNavigate ? onNavigate(cust.coords) : openMaps(cust.coords, cust.address))} style={[styles.roundBtn, { backgroundColor: palette.gray900 }]}>
          <Navigation size={18} color={palette.white} />
        </Pressable>
      </View>
      {items.length ? (
        <View style={styles.itemsBox}>
          <Txt weight={700} style={{ fontSize: 10, color: palette.gray400, letterSpacing: 1.5, marginBottom: 4 }}>ORDER ITEMS</Txt>
          <Txt weight={700} style={{ fontSize: 13, color: palette.gray800 }}>{items.map((it) => `${it.quantity}x ${it.menuItem?.name || it.name || "Item"}`).join(", ")}</Txt>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={styles.metric}>
          <Clock size={18} color="#f97316" />
          <View>
            <Txt weight={700} style={styles.metricLabel}>TIME</Txt>
            <Txt weight={700} style={{ fontSize: 13, color: isWithinRange ? palette.green600 : palette.gray900 }}>{isWithinRange ? "Ready" : `${eta || "--"} MINS`}</Txt>
          </View>
        </View>
        <View style={styles.metric}>
          <MapPin size={18} color={palette.gray400} />
          <View>
            <Txt weight={700} style={styles.metricLabel}>DISTANCE</Txt>
            <Txt weight={700} style={{ fontSize: 13, color: isWithinRange ? palette.green600 : palette.gray900 }}>{isWithinRange ? "0 KM" : Number.isFinite(distanceToTarget) ? `${(distanceToTarget / 1000).toFixed(1)} KM` : "--"}</Txt>
          </View>
        </View>
      </View>
      {order.note ? (
        <View style={styles.noteBox}>
          <Package size={16} color={dv.orange} />
          <View style={{ flex: 1 }}>
            <Txt weight={800} style={{ fontSize: 10, color: dv.orange, letterSpacing: 1.5 }}>DROP MESSAGE</Txt>
            <Txt weight={700} style={{ fontSize: 13, color: palette.gray900 }}>"{order.note}"</Txt>
          </View>
        </View>
      ) : null}
      <View style={{ marginTop: 14, gap: 10 }}>
        <ActionSlider label="Slide to Arrive" successLabel="Arrived ✓" disabled={!isWithinRange} onConfirm={onReachedDrop} color={palette.blue600} />
        <Pressable onPress={() => onMarkDelivered?.(order)} style={styles.markBtn}>
          <CheckCircle2 size={16} color="#059669" />
          <Txt weight={700} style={{ fontSize: 12, color: "#065f46", letterSpacing: 1 }}>MARK AS DELIVERED</Txt>
        </Pressable>
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ VERIFICATION (OTP → PAYMENT) */
function InstructionPanel({ note }) {
  const t = String(note || "").trim();
  if (!t) return null;
  return (
    <View style={[styles.noteBox, { marginTop: 0, marginBottom: 14 }]}>
      <Package size={16} color={dv.orange} />
      <View style={{ flex: 1 }}>
        <Txt weight={800} style={{ fontSize: 10, color: dv.orange, letterSpacing: 1.5 }}>DELIVERY INSTRUCTION • READ BEFORE HANDOVER</Txt>
        <Txt weight={700} style={{ fontSize: 13, color: palette.gray900 }}>“{t}”</Txt>
      </View>
    </View>
  );
}

function OtpStep({ order, onVerified, onClose }) {
  const saved = order?.deliveryVerification?.dropOtp?.code;
  const [otp, setOtp] = useState(saved && String(saved).length === 4 ? String(saved).split("") : ["", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const orderId = order.order_id || order.orderId || order._id;
  const alreadyVerified = order?.deliveryVerification?.dropOtp?.verified;

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const change = (i, v) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = ["", "", "", ""];
      clean.slice(0, 4).split("").forEach((d, k) => (next[k] = d));
      setOtp(next);
      refs[Math.min(clean.length, 3)].current?.focus();
      return;
    }
    const next = [...otp];
    next[i] = clean.slice(-1);
    setOtp(next);
    if (clean && i < 3) refs[i + 1].current?.focus();
  };

  const resend = async () => {
    if (resending || cooldown > 0 || verified || alreadyVerified) return;
    setResending(true);
    try {
      const r = await deliveryAPI.confirmReachedDrop(orderId);
      if (r?.data?.success || r?.status === 200) {
        toast.success("OTP resent to customer via screen & push notification");
        setCooldown(30);
      } else toast.error(r?.data?.message || "Failed to resend OTP");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || "Failed to resend OTP to customer");
    } finally {
      setResending(false);
    }
  };

  const verify = async () => {
    const code = otp.join("");
    if (code.length < 4) return;
    setVerifying(true);
    try {
      const r = await deliveryAPI.verifyDropOtp(orderId, code);
      if (r?.data?.success) {
        const st = useDeliveryStore.getState();
        if (st.activeOrder) st.setActiveOrder({ ...st.activeOrder, deliveryVerification: { ...st.activeOrder.deliveryVerification, dropOtp: { ...st.activeOrder.deliveryVerification?.dropOtp, verified: true, code } } });
        setVerified(true);
        setTimeout(() => onVerified(code), 600);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || "Invalid OTP entered");
      throw e;
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.dialog}>
      <Pressable onPress={onClose} style={styles.closeX} hitSlop={8}>
        <X size={18} color={palette.gray500} />
      </Pressable>
      <View style={styles.dialogIcon}>
        <ShieldCheck size={28} color={palette.green600} />
      </View>
      <Txt weight={800} style={styles.dialogTitle}>Handover OTP</Txt>
      <Txt style={styles.dialogSub}>Enter customer's 4-digit code to complete delivery</Txt>
      <InstructionPanel note={order?.note} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 14 }}>
        {otp.map((d, i) => (
          <TextInput
            key={i}
            ref={refs[i]}
            value={d}
            editable={!verified}
            onChangeText={(v) => change(i, v)}
            onKeyPress={({ nativeEvent }) => nativeEvent.key === "Backspace" && !otp[i] && i > 0 && refs[i - 1].current?.focus()}
            keyboardType="number-pad"
            maxLength={i === 0 ? 4 : 1}
            style={[styles.otpBox, verified && { borderColor: palette.green500, backgroundColor: palette.green50, color: palette.green700 }]}
          />
        ))}
      </View>
      <Pressable onPress={resend} disabled={resending || cooldown > 0 || verified || alreadyVerified} style={[styles.resend, (verified || alreadyVerified) && { opacity: 0.4 }]}>
        {resending ? <ActivityIndicator size="small" color={dv.orange} /> : <RefreshCw size={13} color={dv.orange} />}
        <Txt weight={600} style={{ fontSize: 12, color: "#c2410c" }}>{resending ? "Resending OTP..." : cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Customer didn't get OTP? Resend"}</Txt>
      </Pressable>
      <ActionSlider
        label={verifying ? "Verifying..." : alreadyVerified ? "Code already verified ✓" : "Slide to Verify OTP"}
        successLabel="Verified!"
        disabled={otp.some((d) => !d) || verifying || verified || alreadyVerified}
        onConfirm={verify}
        color={palette.gray900}
      />
    </View>
  );
}

function PaymentStep({ order, otpString, onComplete, onClose }) {
  const method = String(order.paymentMethod || order.payment?.method || order.transaction?.payment?.method || order.transaction?.paymentMethod || "").toLowerCase();
  const isCod = ["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(method);
  const prepaid = !isCod && Boolean(method);
  const rawStatus = String(order.payment?.status || order.paymentStatus || order.transactionStatus || order.transaction?.status || order.status || "").toLowerCase();
  const initialPaid = ["paid", "captured", "completed", "settled"].includes(rawStatus) || prepaid;
  const [status, setStatus] = useState(initialPaid ? "paid" : method === "razorpay_qr" ? "pending" : "idle");
  const [qr, setQr] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [genQr, setGenQr] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);
  const isPaid = status === "paid";
  const orderId = order.order_id || order.orderId || order._id;
  const totalBill = Number(order.pricing?.total || order.amountToCollect || 0);
  const amount = isPaid || isCod ? totalBill : 0;

  const check = useCallback(async () => {
    try {
      const r = await deliveryAPI.getPaymentStatus(orderId);
      const d = r?.data?.data || r?.data || {};
      const s = String(d?.status || d?.payment?.status || "pending").toLowerCase();
      if (s === "paid") {
        setStatus("paid");
        setShowQr(false);
        toast.success("Payment verified by Razorpay");
      } else if (["expired", "failed"].includes(s)) setStatus(s);
      else setStatus("pending");
    } catch {}
  }, [orderId]);
  useEffect(() => {
    if (!showQr || status !== "pending") return undefined;
    check();
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [showQr, status, check]);

  const generateQr = async () => {
    setGenQr(true);
    try {
      const r = await deliveryAPI.createCollectQr(orderId);
      const d = r?.data?.data || r?.data || {};
      const imageUrl = d.image_url || d.imageUrl || null;
      if (imageUrl) {
        setQr({ ...d, imageUrl });
        setStatus("pending");
        setShowQr(true);
      } else toast.error("Could not generate QR code");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || "QR Generation failed");
    } finally {
      setGenQr(false);
    }
  };
  const qrStarted = Boolean(qr) || status === "pending";
  const cashCollected = async () => {
    if (cashBusy) return;
    setCashBusy(true);
    try {
      await onComplete(otpString, "cash");
      toast.success("Cash collection recorded");
    } catch {
    } finally {
      setCashBusy(false);
    }
  };

  return (
    <View style={styles.dialog}>
      <Pressable onPress={onClose} style={styles.closeX} hitSlop={8}>
        <X size={18} color={palette.gray500} />
      </Pressable>
      <View style={[styles.dialogIcon, { backgroundColor: isPaid ? palette.green50 : "#fffbeb" }]}>
        <DollarSign size={28} color={isPaid ? palette.green600 : "#d97706"} />
      </View>
      <Txt weight={800} style={styles.dialogTitle}>{isPaid ? "Payment Verified" : "Collect Payment"}</Txt>
      <Txt style={styles.dialogSub}>{isPaid ? "Ready to Complete" : "Payment Settlement"}</Txt>
      <InstructionPanel note={order?.note} />
      <View style={styles.amountBox}>
        <Txt weight={700} style={{ fontSize: 11, color: palette.gray500, letterSpacing: 1 }}>{isPaid ? "AMOUNT PAID ONLINE" : "AMOUNT TO COLLECT"}</Txt>
        <Txt weight={900} style={{ fontSize: 30, color: palette.gray900 }}>₹{amount.toFixed(2)}</Txt>
        {isPaid ? <Txt weight={800} style={styles.paidTag}>PAID ✓</Txt> : null}
      </View>
      {!isPaid ? (
        <View style={{ gap: 10, marginBottom: 14 }}>
          <Pressable onPress={cashCollected} disabled={cashBusy || genQr || qrStarted} style={[styles.cashBtn, (cashBusy || genQr || qrStarted) && { opacity: 0.5 }]}>
            {cashBusy ? <ActivityIndicator size="small" color={palette.white} /> : <DollarSign size={18} color={palette.white} />}
            <Txt weight={800} style={{ fontSize: 13, color: palette.white, letterSpacing: 1 }}>{cashBusy ? "RECORDING CASH…" : "CASH COLLECTED"}</Txt>
          </Pressable>
          <Pressable onPress={() => (qr && status === "pending" ? setShowQr(true) : generateQr())} disabled={genQr || cashBusy} style={styles.qrBtn}>
            {genQr ? <ActivityIndicator size="small" color="#92400e" /> : <QrCode size={18} color="#92400e" />}
            <Txt weight={800} style={{ fontSize: 12, color: "#92400e", letterSpacing: 1 }}>{status === "pending" ? "QR ACTIVE - SHOW AGAIN" : "SHOW PAYMENT QR"}</Txt>
          </Pressable>
          {["expired", "failed"].includes(status) ? <Txt style={{ fontSize: 11, color: palette.red600, textAlign: "center" }}>The previous QR is no longer payable. Create a new QR to continue.</Txt> : null}
          {qrStarted ? <Txt style={{ fontSize: 11, color: "#92400e", textAlign: "center" }}>QR collection is active. Cash collection is disabled to prevent duplicate payment.</Txt> : null}
        </View>
      ) : null}
      <ActionSlider
        label={isPaid ? "Slide to Complete Order" : "Waiting for verified payment"}
        successLabel="Delivered! ✓"
        disabled={!isPaid}
        onConfirm={() => onComplete(otpString, isCod ? (status === "paid" ? "online" : "cash") : "online")}
        color={palette.green600}
      />
      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <Pressable style={styles.qrBackdrop} onPress={() => setShowQr(false)}>
          <Pressable style={styles.qrCard} onPress={() => {}}>
            <Txt weight={800} style={{ fontSize: 18, color: palette.gray900 }}>Scan to Pay</Txt>
            <Txt style={{ fontSize: 13, color: palette.gray500, marginBottom: 12 }}>Order Total: ₹{amount.toFixed(2)}</Txt>
            {qr?.imageUrl ? <Image source={{ uri: qr.imageUrl }} style={{ width: 260, height: 260 }} resizeMode="contain" /> : null}
            <Txt style={{ fontSize: 12, color: palette.gray500, marginTop: 10 }}>{status === "pending" ? "Waiting for server-verified payment…" : "This QR has expired or failed."}</Txt>
            <Pressable onPress={() => setShowQr(false)} style={[styles.cashBtn, { marginTop: 14, backgroundColor: palette.gray900 }]}>
              <Txt weight={800} style={{ fontSize: 12, color: palette.white, letterSpacing: 1 }}>CLOSE QR</Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function DeliveryVerificationModal({ order, onComplete, onClose, skipOtp = false }) {
  const already = Boolean(order?.deliveryVerification?.dropOtp?.verified);
  const skip = Boolean(skipOtp || already);
  const [step, setStep] = useState(skip ? "payment" : "otp");
  const [code, setCode] = useState(order?.deliveryVerification?.dropOtp?.code || (skip ? "BYPASS" : ""));
  if (!order) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }} keyboardShouldPersistTaps="handled">
          {step === "otp" ? (
            <OtpStep
              order={order}
              onVerified={(v) => {
                setCode(v);
                setStep("payment");
              }}
              onClose={onClose}
            />
          ) : (
            <PaymentStep order={order} otpString={code} onComplete={onComplete} onClose={onClose} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ SUMMARY */
export function OrderSummaryModal({ order, onDone }) {
  const earnings = order?.earnings || order?.riderEarning || order?.pricing?.deliveryFee || order?.orderAmount * 0.1 || 0;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={styles.centerBackdrop}>
        <View style={[styles.dialog, { alignItems: "center", margin: 16 }]}>
          <View style={[styles.dialogIcon, { width: 80, height: 80, borderRadius: 40 }]}>
            <CheckCircle2 size={40} color={palette.green600} />
          </View>
          <Txt weight={900} style={{ fontSize: 28, color: palette.gray900 }}>Well Done!</Txt>
          <Txt style={{ fontSize: 14, color: palette.gray500, marginBottom: 18 }}>Trip completed successfully.</Txt>
          <View style={[styles.amountBox, { width: "100%" }]}>
            <Txt weight={700} style={{ fontSize: 11, color: palette.gray500, letterSpacing: 1 }}>EARNINGS ADDED</Txt>
            <Txt weight={900} style={{ fontSize: 44, color: palette.gray900 }}>₹{Number(earnings).toFixed(2)}</Txt>
            <Txt weight={600} style={{ fontSize: 12, color: palette.green700 }}>Transferred to Wallet</Txt>
          </View>
          <Pressable onPress={onDone} style={[styles.cashBtn, { width: "100%", marginTop: 6, backgroundColor: palette.gray900 }]}>
            <Txt weight={800} style={{ fontSize: 14, color: palette.white, letterSpacing: 1.5 }}>DONE</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ SHIFT START SELFIE (PhotoUploadModal) */
export function ShiftSelfieModal({ visible, onClose, onUpload, coords }) {
  const [photo, setPhoto] = useState(null);
  const [address, setAddress] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) {
      setPhoto(null);
      setAddress(null);
      return;
    }
    if (coords) {
      locationAPI
        .reverseGeocode(coords.lat, coords.lng)
        .then((r) => {
          const loc = r?.data?.data?.location || r?.data?.data;
          setAddress(loc?.formattedAddress || loc?.address || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        })
        .catch(() => setAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`));
    }
  }, [visible, coords]);

  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast.error("Camera permission is required for the shift selfie");
    const res = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.5, base64: true, allowsEditing: false });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    // Backend does Buffer.from(shiftStartPicBase64, "base64") — send raw base64 without the data: prefix (same as web PhotoUploadModal).
    setPhoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
  };
  const submit = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      await onUpload(photo.base64, address);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.offerCard, { padding: 20, paddingBottom: 28 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Txt weight={900} style={{ fontSize: 20, color: palette.gray900, flex: 1 }}>Start Your Shift</Txt>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.gray500} />
            </Pressable>
          </View>
          <Txt style={{ fontSize: 13, color: palette.gray500, marginBottom: 16 }}>Take a quick selfie to go online. It confirms you are on duty.</Txt>
          <Pressable onPress={capture} style={styles.selfieBox}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <View style={{ alignItems: "center", gap: 8 }}>
                <Camera size={36} color={palette.gray400} />
                <Txt weight={700} style={{ fontSize: 13, color: palette.gray500 }}>Tap to take selfie</Txt>
              </View>
            )}
          </Pressable>
          <View style={styles.addrRow}>
            <MapPin size={14} color={palette.red500} />
            <Txt numberOfLines={2} style={{ fontSize: 12, color: palette.gray700, flex: 1 }}>{address || "Fetching your location…"}</Txt>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            {photo ? (
              <Pressable onPress={capture} style={[styles.skipBtn, { flex: 1, justifyContent: "center" }]}>
                <Txt weight={800} style={{ fontSize: 12, color: palette.gray700 }}>RETAKE</Txt>
              </Pressable>
            ) : null}
            <Pressable onPress={photo ? submit : capture} disabled={busy} style={[styles.cashBtn, { flex: 2, backgroundColor: palette.green600 }, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color={palette.white} /> : <Txt weight={800} style={{ fontSize: 13, color: palette.white, letterSpacing: 1 }}>{photo ? "GO ONLINE" : "OPEN CAMERA"}</Txt>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  sheet: { backgroundColor: palette.white, borderRadius: 32, padding: 18, paddingTop: 6, elevation: 20, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: -10 } },
  grabber: { alignSelf: "center", paddingVertical: 4, marginBottom: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  offerCard: { backgroundColor: palette.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingTop: 4 },
  offerHead: { flexDirection: "row", alignItems: "center", backgroundColor: GRAD_DARK, marginHorizontal: 12, borderRadius: 22, padding: 16 },
  payChip: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", borderWidth: 1 },
  payCod: { color: "#fcd34d", backgroundColor: "rgba(251,191,36,0.25)", borderColor: "rgba(251,191,36,0.4)" },
  payPaid: { color: "#6ee7b7", backgroundColor: "rgba(52,211,153,0.25)", borderColor: "rgba(52,211,153,0.4)" },
  timer: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center" },
  qChip: { minWidth: 170, maxWidth: 230, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: palette.gray200, backgroundColor: palette.white },
  qChipActive: { backgroundColor: palette.gray900, borderColor: palette.gray900 },
  stop: { flexDirection: "row", gap: 12 },
  stopIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stopHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stopKicker: { fontSize: 10, color: palette.gray400, letterSpacing: 1.5 },
  stopDist: { fontSize: 11, color: palette.gray600 },
  stopName: { fontSize: 15, color: palette.gray900, marginTop: 2 },
  stopAddr: { fontSize: 12, color: palette.gray500, marginTop: 2 },
  payBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  payIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  passBtn: { height: 46, borderRadius: 16, backgroundColor: palette.gray100, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.blue50, alignItems: "center", justifyContent: "center" },
  hint: { textAlign: "center", fontSize: 10, letterSpacing: 1.5 },
  markBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: "#6ee7b7", backgroundColor: "#ecfdf5" },
  otpBtn: { height: 50, borderRadius: 16, backgroundColor: palette.blue600, alignItems: "center", justifyContent: "center" },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 50, borderRadius: 16, borderWidth: 2, borderColor: palette.gray200, backgroundColor: palette.gray100 },
  otpInput: { height: 54, borderRadius: 16, borderWidth: 2, borderColor: palette.gray200, backgroundColor: palette.gray50, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 8, color: palette.gray900 },
  noteBox: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#ffedd5", marginTop: 12 },
  itemsToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, marginTop: 6, borderTopWidth: 1, borderTopColor: palette.gray100 },
  itemRow: { flexDirection: "row", paddingVertical: 4 },
  itemsBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100 },
  metric: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100 },
  metricLabel: { fontSize: 10, color: palette.gray400, letterSpacing: 1.5 },
  verifyBtn: { height: 60, borderRadius: 18, backgroundColor: GRAD_DARK, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, elevation: 10 },
  dialog: { backgroundColor: palette.white, borderRadius: 28, padding: 22 },
  closeX: { position: "absolute", right: 16, top: 16, zIndex: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.gray100, alignItems: "center", justifyContent: "center" },
  dialogIcon: { alignSelf: "center", width: 60, height: 60, borderRadius: 30, backgroundColor: palette.green50, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  dialogTitle: { fontSize: 22, color: palette.gray900, textAlign: "center" },
  dialogSub: { fontSize: 13, color: palette.gray500, textAlign: "center", marginBottom: 16 },
  otpBox: { width: 56, height: 66, borderRadius: 16, borderWidth: 2, borderColor: palette.gray200, backgroundColor: palette.gray50, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 26, color: palette.gray900 },
  resend: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", marginBottom: 16 },
  amountBox: { alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: palette.gray50, borderWidth: 1, borderColor: palette.gray100, marginBottom: 14 },
  paidTag: { marginTop: 6, fontSize: 11, color: palette.green700, backgroundColor: palette.green100, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  cashBtn: { height: 52, borderRadius: 16, backgroundColor: palette.green600, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  qrBtn: { height: 52, borderRadius: 16, borderWidth: 2, borderColor: "#fde68a", backgroundColor: palette.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  qrBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 20 },
  qrCard: { backgroundColor: palette.white, borderRadius: 24, padding: 20, alignItems: "center", width: "100%" },
  selfieBox: { height: 260, borderRadius: 24, backgroundColor: palette.gray100, borderWidth: 2, borderStyle: "dashed", borderColor: palette.gray300, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: palette.gray50 },
});
