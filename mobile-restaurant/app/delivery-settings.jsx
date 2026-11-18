/** Port of pages/restaurant/DeliverySettings.jsx — order acceptance ON/OFF (confirm before OFF), dispatch policy, personal riders. */
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { Truck, Users, Plus, Trash2, Phone, AlertTriangle, X } from "lucide-react-native";
import Screen from "../src/components/ui/Screen";
import PageHeader from "../src/components/ui/PageHeader";
import Txt from "../src/components/ui/Txt";
import Spinner from "../src/components/ui/Spinner";
import { restaurantAPI } from "../src/api";
import { syncOnlineStatus } from "../src/utils/onlineStatus";
import { toast } from "../src/utils/toast";
import { fonts, palette, rt } from "../src/theme";

const VEHICLES = ["Motorcycle", "Scooter", "Bicycle", "Electric Vehicle"];

export default function DeliverySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [deliveryStatus, setDeliveryStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [openForPublic, setOpenForPublic] = useState(true);
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [riders, setRiders] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", vehicleType: "Motorcycle", vehicleNumber: "" });
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rest, ded] = await Promise.all([restaurantAPI.getCurrentRestaurant({ noCache: true }).catch(() => null), restaurantAPI.getDedicatedRiders().catch(() => null)]);
      const r = rest?.data?.data?.restaurant || rest?.data?.restaurant;
      if (r) {
        setDeliveryStatus(r.isAcceptingOrders === true);
        syncOnlineStatus(r.isAcceptingOrders === true);
      }
      if (ded?.data?.success) {
        const d = ded.data.data || {};
        setRiders(d.riders || []);
        setOpenForPublic(d.deliverySettings?.openForPublicDelivery !== false);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (next) => {
    const prev = deliveryStatus;
    try {
      setSaving(true);
      setDeliveryStatus(next);
      syncOnlineStatus(next);
      await restaurantAPI.updateAcceptingOrders(next);
      toast.success(next ? "Delivery is ON - You're receiving orders" : "Delivery is OFF - Not receiving orders");
    } catch (e) {
      setDeliveryStatus(prev);
      syncOnlineStatus(prev);
      toast.error(e?.response?.data?.message || "Error updating delivery status");
    } finally {
      setSaving(false);
    }
  };
  const onToggle = (checked) => {
    if (saving) return;
    if (!checked && deliveryStatus) return setConfirmOff(true);
    save(checked);
  };

  const toggleDispatch = async (checked) => {
    if (savingDispatch) return;
    const prev = openForPublic;
    try {
      setSavingDispatch(true);
      setOpenForPublic(checked);
      const res = await restaurantAPI.updateDeliveryDispatchSettings({ openForPublicDelivery: checked });
      if (res?.data?.success) toast.success(checked ? "Open for All: Platform zone riders can now also receive orders" : "Dedicated Only: Orders are now restricted exclusively to your own delivery boys");
    } catch (e) {
      setOpenForPublic(prev);
      toast.error(e?.response?.data?.message || "Failed to update delivery dispatch setting");
    } finally {
      setSavingDispatch(false);
    }
  };

  const addRider = async () => {
    if (!form.name.trim()) return toast.error("Please enter rider name");
    const phone = form.phone.replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) return toast.error("Please enter a valid 10-digit mobile number");
    try {
      setAdding(true);
      const res = await restaurantAPI.addDedicatedRider({ name: form.name.trim(), phone, vehicleType: form.vehicleType, vehicleNumber: form.vehicleNumber.trim().toUpperCase() });
      if (res?.data?.success) {
        toast.success("Delivery partner added successfully!");
        setShowAdd(false);
        setForm({ name: "", phone: "", vehicleType: "Motorcycle", vehicleNumber: "" });
        load();
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to add delivery partner");
    } finally {
      setAdding(false);
    }
  };
  const removeRider = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      const res = await restaurantAPI.removeDedicatedRider(toDelete._id);
      if (res?.data?.success) {
        toast.success("Delivery partner unlinked successfully");
        setToDelete(null);
        load();
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to remove delivery partner");
    } finally {
      setDeleting(false);
    }
  };

  const onlineCount = riders.filter((r) => r.availabilityStatus === "online").length;

  return (
    <Screen bg={palette.gray50}>
      <PageHeader title="Delivery & Rider Settings" subtitle="Manage orders acceptance and personal delivery partners" />
      {loading ? (
        <Spinner full />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: deliveryStatus ? palette.green50 : palette.gray100 }]}>
                <Truck size={20} color={deliveryStatus ? palette.green600 : palette.gray500} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={styles.h2}>Delivery Acceptance</Txt>
                <Txt style={styles.sub}>Turn delivery ordering on or off for customers</Txt>
              </View>
              <Switch value={deliveryStatus} onValueChange={onToggle} disabled={saving} trackColor={{ true: "#86efac", false: palette.gray300 }} thumbColor={deliveryStatus ? palette.green600 : palette.white} />
            </View>
            <View style={[styles.statusBox, { backgroundColor: deliveryStatus ? palette.green50 : palette.gray50 }]}>
              <View style={[styles.dot, { backgroundColor: deliveryStatus ? palette.green500 : palette.gray400 }]} />
              <Txt weight={600} style={{ fontSize: 13, color: deliveryStatus ? palette.green700 : palette.gray600 }}>{deliveryStatus ? "Online — receiving new orders" : "Offline — not receiving orders"}</Txt>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.icon, { backgroundColor: palette.blue50 }]}>
                <Users size={20} color={palette.blue600} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={styles.h2}>Delivery Dispatch Policy</Txt>
                <Txt style={styles.sub}>Configure who can deliver your restaurant orders</Txt>
              </View>
            </View>
            {[
              [true, "Open for All", "Platform zone riders and your personal riders can take orders."],
              [false, "Dedicated Only", "Orders will ONLY be visible and dispatched to your personal delivery boys. Other riders in the zone cannot see or take your orders."],
            ].map(([val, title, desc]) => (
              <Pressable key={title} onPress={() => openForPublic !== val && toggleDispatch(val)} disabled={savingDispatch} style={[styles.opt, openForPublic === val && styles.optActive]}>
                <View style={[styles.radio, openForPublic === val && { borderColor: rt.primary }]}>{openForPublic === val ? <View style={styles.radioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{title}</Txt>
                  <Txt style={{ fontSize: 12, color: palette.gray600, marginTop: 2 }}>{desc}</Txt>
                </View>
              </Pressable>
            ))}
            {!openForPublic && riders.length === 0 ? (
              <View style={styles.warn}>
                <AlertTriangle size={16} color="#b45309" />
                <Txt style={{ fontSize: 12, color: "#92400e", flex: 1 }}>
                  <Txt weight={700} style={{ fontSize: 12, color: "#92400e" }}>Warning:</Txt> You have selected "Dedicated Only" delivery, but have not registered any delivery partners yet. Add a rider below to avoid missed orders.
                </Txt>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Txt weight={700} style={styles.h2}>Personal Delivery Partners</Txt>
                <Txt style={styles.sub}>{riders.length} registered • {onlineCount} online</Txt>
              </View>
              <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
                <Plus size={16} color={palette.white} />
                <Txt weight={700} style={{ fontSize: 12, color: palette.white }}>Add</Txt>
              </Pressable>
            </View>
            {riders.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Txt weight={700} style={{ fontSize: 14, color: palette.gray700 }}>No Personal Riders Added</Txt>
              </View>
            ) : (
              riders.map((r) => (
                <View key={r._id} style={styles.rider}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.dot, { backgroundColor: r.availabilityStatus === "online" ? palette.green500 : palette.gray300 }]} />
                      <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{r.name}</Txt>
                    </View>
                    <Txt style={{ fontSize: 12, color: palette.gray500, marginTop: 2 }}>{[r.phone, r.vehicleType, r.vehicleNumber].filter(Boolean).join(" • ")}</Txt>
                  </View>
                  {r.phone ? (
                    <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)} style={styles.iconBtn} hitSlop={6}>
                      <Phone size={16} color={palette.blue600} />
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setToDelete(r)} style={styles.iconBtn} hitSlop={6}>
                    <Trash2 size={16} color={palette.red500} />
                  </Pressable>
                </View>
              ))
            )}
            <Txt style={{ fontSize: 11, color: palette.gray500, marginTop: 10 }}>
              <Txt weight={700} style={{ fontSize: 11, color: palette.gray600 }}>How rider login works:</Txt> Registered delivery partners simply open the Delivery Partner App and log in with their registered mobile number.
            </Txt>
          </View>
        </ScrollView>
      )}

      <Modal visible={confirmOff} transparent animationType="fade" onRequestClose={() => setConfirmOff(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Turn off delivery?</Txt>
            <Txt style={{ fontSize: 14, color: palette.gray600, marginTop: 8 }}>You will stop receiving new orders until you turn it back on.</Txt>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setConfirmOff(false)} style={[styles.dBtn, { backgroundColor: palette.gray100 }]}>
                <Txt weight={600} style={{ color: palette.gray700 }}>Cancel</Txt>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmOff(false);
                  save(false);
                }}
                style={[styles.dBtn, { backgroundColor: palette.red600 }]}
              >
                <Txt weight={600} style={{ color: palette.white }}>Turn off</Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={[styles.backdrop, { justifyContent: "flex-end" }]}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, flex: 1 }}>Add Delivery Partner</Txt>
              <Pressable onPress={() => setShowAdd(false)} hitSlop={8}>
                <X size={20} color={palette.gray500} />
              </Pressable>
            </View>
            {[
              ["name", "Full name", "default"],
              ["phone", "Mobile number", "phone-pad"],
              ["vehicleNumber", "Vehicle number (optional)", "default"],
            ].map(([k, l, kb]) => (
              <TextInput key={k} value={form[k]} onChangeText={(v) => setForm((f) => ({ ...f, [k]: k === "phone" ? v.replace(/\D/g, "").slice(0, 10) : v }))} placeholder={l} placeholderTextColor={palette.gray400} keyboardType={kb} autoCapitalize={k === "vehicleNumber" ? "characters" : "words"} style={styles.input} />
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {VEHICLES.map((v) => (
                <Pressable key={v} onPress={() => setForm((f) => ({ ...f, vehicleType: v }))} style={[styles.vChip, form.vehicleType === v && styles.vChipActive]}>
                  <Txt weight={600} style={{ fontSize: 12, color: form.vehicleType === v ? palette.white : palette.gray700 }}>{v}</Txt>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={addRider} disabled={adding} style={[styles.dBtn, { backgroundColor: rt.primary, flex: 0, height: 50 }, adding && { opacity: 0.6 }]}>
              <Txt weight={700} style={{ color: palette.white }}>{adding ? "Adding..." : "Add Partner"}</Txt>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(toDelete)} transparent animationType="fade" onRequestClose={() => setToDelete(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Remove {toDelete?.name}?</Txt>
            <Txt style={{ fontSize: 14, color: palette.gray600, marginTop: 8 }}>This delivery partner will be unlinked from your restaurant.</Txt>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => setToDelete(null)} style={[styles.dBtn, { backgroundColor: palette.gray100 }]}>
                <Txt weight={600} style={{ color: palette.gray700 }}>Cancel</Txt>
              </Pressable>
              <Pressable onPress={removeRider} disabled={deleting} style={[styles.dBtn, { backgroundColor: palette.red600 }]}>
                <Txt weight={600} style={{ color: palette.white }}>{deleting ? "Removing..." : "Remove"}</Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.gray100 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  h2: { fontSize: 15, color: palette.gray900 },
  sub: { fontSize: 12, color: palette.gray500, marginTop: 2 },
  statusBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  opt: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, marginBottom: 8 },
  optActive: { borderColor: rt.primary, backgroundColor: rt.primarySoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: rt.primary },
  warn: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: rt.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  rider: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.gray50 },
  iconBtn: { padding: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  dialog: { backgroundColor: palette.white, borderRadius: 20, padding: 20 },
  dBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: palette.white, borderRadius: 24, padding: 20 },
  input: { borderWidth: 1, borderColor: palette.gray200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900, marginBottom: 10 },
  vChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: palette.gray200 },
  vChipActive: { backgroundColor: rt.primary, borderColor: rt.primary },
});
