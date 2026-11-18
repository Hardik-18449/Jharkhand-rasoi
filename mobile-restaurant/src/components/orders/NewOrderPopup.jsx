/**
 * Port of the OrdersMain.jsx new-order popup + reject popup (presentational; logic lives in the Orders screen).
 * Slide-to-accept uses PanResponder (web: pointer/touch tracking, accept at ≥45 % travel), countdown bar shrinks over 180 s.
 */
import React, { useRef, useState } from "react";
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, FileText, ChevronUp, ChevronDown, Utensils, Receipt, Minus, Plus, X, Volume2, VolumeX } from "lucide-react-native";
import Txt from "../ui/Txt";
import { fonts, palette, rt } from "../../theme";

export const REJECT_REASONS = ["Restaurant is too busy", "Item not available", "Outside delivery area", "Kitchen closing soon", "Technical issue", "Other reason"];

const fmt = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const HANDLE = 48;

function AcceptSlider({ countdown, accepting, onAccept }) {
  const [width, setWidth] = useState(320);
  const x = useRef(new Animated.Value(0)).current;
  const maxTravel = Math.max(width - HANDLE - 16, 1);
  const progressRef = useRef(0);
  const responder = useRef(null);
  responder.current = PanResponder.create({
    onStartShouldSetPanResponder: () => !accepting,
    onMoveShouldSetPanResponder: () => !accepting,
    onPanResponderMove: (_, g) => {
      const dx = Math.max(0, Math.min(g.dx, maxTravel));
      progressRef.current = dx / maxTravel;
      x.setValue(dx);
    },
    onPanResponderRelease: () => {
      if (progressRef.current >= 0.45) {
        Animated.timing(x, { toValue: maxTravel, duration: 150, useNativeDriver: true }).start(() => onAccept());
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      }
      progressRef.current = 0;
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  });
  // reset after a failed accept
  React.useEffect(() => {
    if (!accepting) x.setValue(0);
  }, [accepting, x]);

  return (
    <View style={styles.slider} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.sliderFill, { width: `${(countdown / 180) * 100}%` }]} />
      <View style={styles.sliderLabel} pointerEvents="none">
        <Txt weight={600} style={{ color: palette.white, fontSize: 14 }}>{accepting ? "Accepting order..." : `Slide to accept (${fmt(countdown)})`}</Txt>
      </View>
      <Animated.View {...responder.current.panHandlers} style={[styles.handle, { transform: [{ translateX: x }] }]}>
        <Txt weight={700} style={{ fontSize: 20, color: palette.blue600 }}>›</Txt>
      </Animated.View>
    </View>
  );
}

export default function NewOrderPopup({ visible, order, queueLength = 0, countdown, prepTime, setPrepTime, accepting, onAccept, onReject, isMuted, onToggleMute, cancelledLabel }) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(true);
  if (!visible || !order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const total = (() => {
    const d = Number(order.total);
    if (Number.isFinite(d) && d > 0) return d;
    const p = Number(order.pricing?.total);
    if (Number.isFinite(p) && p > 0) return p;
    const a = Number(order.payment?.amountDue);
    if (Number.isFinite(a) && a > 0) return a;
    return items.reduce((s, i) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 0), 0);
  })();
  const rawPay = String(order.paymentMethod || order.payment?.method || "").toLowerCase().trim();
  const isCod = rawPay === "cash" || rawPay === "cod";

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>{order.orderId || "#Order"}</Txt>
                {queueLength > 1 ? <Txt weight={700} style={styles.more}>+{queueLength - 1} more</Txt> : null}
              </View>
              <Txt style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{order.restaurantName || "Restaurant"}</Txt>
            </View>
            <Pressable onPress={onToggleMute} style={styles.iconBtn} accessibilityLabel={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <VolumeX size={20} color={palette.gray700} /> : <Volume2 size={20} color={palette.gray700} />}
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16 }}>
            {order.scheduledAt ? (
              <View style={styles.sched}>
                <View style={styles.schedIcon}>
                  <Calendar size={16} color={palette.green600} />
                </View>
                <View>
                  <Txt weight={700} style={{ fontSize: 10, color: palette.green700, letterSpacing: 1 }}>SCHEDULED ORDER</Txt>
                  <Txt weight={600} style={{ fontSize: 14, color: "#14532d", marginTop: 2 }}>
                    For {new Date(order.scheduledAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                  </Txt>
                </View>
              </View>
            ) : null}

            <View style={{ marginBottom: 8 }}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>{items[0]?.name || "New Order"}</Txt>
              <Txt style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Just now"}
              </Txt>
            </View>

            {order.restaurantNote ? (
              <View style={styles.note}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <FileText size={16} color={palette.blue600} />
                  <Txt weight={700} style={{ fontSize: 11, color: "#1d4ed8", letterSpacing: 0.5 }}>NOTE FOR RESTAURANT</Txt>
                </View>
                <Txt weight={500} style={{ fontSize: 14, color: "#1e3a8a" }}>{order.restaurantNote}</Txt>
              </View>
            ) : null}

            <Pressable onPress={() => setExpanded((v) => !v)} style={styles.accordion}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <FileText size={18} color={palette.gray700} />
                <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Details</Txt>
                <Txt style={{ fontSize: 12, color: palette.gray500 }}>{items.length} item{items.length !== 1 ? "s" : ""}</Txt>
              </View>
              {expanded ? <ChevronUp size={16} color={palette.gray600} /> : <ChevronDown size={16} color={palette.gray600} />}
            </Pressable>
            {expanded ? (
              <View style={{ paddingVertical: 12, gap: 12 }}>
                {items.length ? (
                  items.map((item, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                      <View style={[styles.vegDot, { backgroundColor: item.isVeg ? palette.green500 : palette.red500 }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Txt weight={500} style={{ fontSize: 14, color: palette.gray900, flex: 1 }}>{item.quantity} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}</Txt>
                          <Txt style={{ fontSize: 12, color: palette.gray600, marginLeft: 8 }}>₹{(Number(item.price) || 0) * (Number(item.quantity) || 0)}</Txt>
                        </View>
                        {item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length ? (
                          <Txt style={{ fontSize: 11, color: palette.gray500, marginTop: 2 }}>Combo: {item.comboItems.map((ci) => `${ci.quantity || 1} x ${ci.name}`).join(", ")}</Txt>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Txt style={{ fontSize: 14, color: palette.gray500 }}>No items</Txt>
                )}
              </View>
            ) : null}

            <View style={[styles.cutlery, { backgroundColor: order.sendCutlery === false ? palette.orange50 : palette.gray50 }]}>
              <Utensils size={18} color={order.sendCutlery === false ? palette.orange600 : palette.gray600} />
              <Txt weight={500} style={{ fontSize: 14, color: order.sendCutlery === false ? "#c2410c" : palette.gray700 }}>{order.sendCutlery === false ? "Don't send cutlery" : "Send cutlery"}</Txt>
            </View>

            <View style={styles.total}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Receipt size={18} color={palette.gray700} />
                <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Total bill</Txt>
              </View>
              <Txt weight={700} style={{ fontSize: 16, color: palette.gray900 }}>₹{total}</Txt>
            </View>
            <View style={[styles.payTag, { backgroundColor: isCod ? palette.orange50 : palette.green50, borderColor: isCod ? palette.orange200 : palette.green100 }]}>
              <Txt weight={700} style={{ fontSize: 12, color: isCod ? "#c2410c" : palette.green700 }}>{isCod ? "Cash on Delivery — collect ₹" + total : "Paid Online"}</Txt>
            </View>

            <View style={styles.prep}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>Preparation time</Txt>
              <View style={styles.stepper}>
                <Pressable onPress={() => setPrepTime(Math.max(1, prepTime - 1))} style={styles.stepBtn} hitSlop={6}>
                  <Minus size={16} color={palette.gray800} />
                </Pressable>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray900, minWidth: 64, textAlign: "center" }}>{prepTime} mins</Txt>
                <Pressable onPress={() => setPrepTime(prepTime + 1)} style={styles.stepBtn} hitSlop={6}>
                  <Plus size={16} color={palette.gray800} />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={{ padding: 16, paddingTop: 8, gap: 12 }}>
            {cancelledLabel ? (
              <View style={styles.cancelled}>
                <Txt weight={600} style={{ fontSize: 14, color: "#b91c1c" }}>{cancelledLabel}</Txt>
                <Txt style={{ fontSize: 12, color: palette.red600, marginTop: 4 }}>This order is no longer available for acceptance.</Txt>
              </View>
            ) : (
              <>
                <AcceptSlider countdown={countdown} accepting={accepting} onAccept={onAccept} />
                <Pressable onPress={onReject} disabled={accepting} style={[styles.rejectBtn, accepting && { opacity: 0.5 }]}>
                  <Txt weight={600} style={{ fontSize: 14, color: palette.red600 }}>Reject Order</Txt>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Reject / cancel reason sheet (web Reject Order popup + Cancel popup). */
export function ReasonSheet({ visible, title, reasons = REJECT_REASONS, value, onChange, onConfirm, onClose, confirmLabel = "Confirm Rejection", freeText = false }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.reasonSheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, flex: 1 }}>{title}</Txt>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.gray500} />
            </Pressable>
          </View>
          {freeText ? (
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="Enter reason for cancellation"
              placeholderTextColor={palette.gray400}
              multiline
              style={styles.reasonInput}
            />
          ) : (
            <View style={{ gap: 8 }}>
              {reasons.map((r) => (
                <Pressable key={r} onPress={() => onChange(r)} style={[styles.reasonRow, value === r && styles.reasonRowActive]}>
                  <View style={[styles.radio, value === r && { borderColor: rt.primary }]}>{value === r ? <View style={styles.radioDot} /> : null}</View>
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray800 }}>{r}</Txt>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <Pressable onPress={onClose} style={[styles.sheetBtn, { backgroundColor: palette.gray100 }]}>
              <Txt weight={600} style={{ fontSize: 14, color: palette.gray700 }}>Cancel</Txt>
            </Pressable>
            <Pressable onPress={onConfirm} disabled={!String(value || "").trim()} style={[styles.sheetBtn, { backgroundColor: String(value || "").trim() ? palette.red600 : palette.gray200 }]}>
              <Txt weight={600} style={{ fontSize: 14, color: String(value || "").trim() ? palette.white : palette.gray400 }}>{confirmLabel}</Txt>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { marginHorizontal: 12, backgroundColor: palette.white, borderRadius: 24, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.gray100 },
  more: { fontSize: 11, color: rt.primary, backgroundColor: rt.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  iconBtn: { padding: 8, borderRadius: 8 },
  sched: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.green50, borderWidth: 1, borderColor: palette.green100, borderRadius: 12, padding: 12, marginBottom: 12 },
  schedIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.green100, alignItems: "center", justifyContent: "center" },
  note: { marginBottom: 12, backgroundColor: palette.blue50, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 8, padding: 10 },
  accordion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.gray100 },
  vegDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cutlery: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 8, marginBottom: 8 },
  total: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderColor: palette.gray100 },
  payTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 12 },
  prep: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.gray200, borderRadius: 10 },
  stepBtn: { padding: 8 },
  slider: { height: 56, borderRadius: 16, backgroundColor: "#1e3a8a", overflow: "hidden", justifyContent: "center", paddingHorizontal: 8 },
  sliderFill: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: palette.blue600 },
  sliderLabel: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 60 },
  handle: { width: HANDLE, height: 40, borderRadius: 12, backgroundColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 3 },
  rejectBtn: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: "#fecaca", backgroundColor: palette.red50, alignItems: "center", justifyContent: "center" },
  cancelled: { borderRadius: 12, borderWidth: 1, borderColor: "#fecaca", backgroundColor: palette.red50, paddingHorizontal: 16, paddingVertical: 12 },
  reasonSheet: { backgroundColor: palette.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
  reasonRowActive: { borderColor: rt.primary, backgroundColor: rt.primarySoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: rt.primary },
  reasonInput: { minHeight: 96, borderWidth: 1, borderColor: palette.gray200, borderRadius: 12, padding: 12, textAlignVertical: "top", fontFamily: fonts.regular, fontSize: 14, color: palette.gray900 },
  sheetBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
