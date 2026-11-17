/** Port of pages/user/complaints/SubmitComplaint.jsx (native <select> → option sheet). */
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, AlertCircle, FileText, ChevronDown, Check } from "lucide-react-native";
import Txt from "../../../src/components/ui/Txt";
import Screen from "../../../src/components/ui/Screen";
import BottomSheet from "../../../src/components/ui/BottomSheet";
import Spinner from "../../../src/components/ui/Spinner";
import RequireAuth from "../../../src/components/RequireAuth";
import { orderAPI } from "../../../src/api";
import { toast } from "../../../src/utils/toast";
import { palette, fonts } from "../../../src/theme";

const COMPLAINT_TYPES = [
  { value: "Food Quality", label: "Food Quality Issue" },
  { value: "Wrong Item", label: "Wrong Item Received" },
  { value: "Missing Item", label: "Missing Item" },
  { value: "Packaging Issue", label: "Packaging Issue" },
  { value: "Late Delivery", label: "Late Delivery" },
  { value: "Other", label: "Other" },
];

function SubmitComplaintScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId: rawId } = useLocalSearchParams();
  const orderId = rawId ? decodeURIComponent(String(rawId)) : "";
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [formData, setFormData] = useState({ complaintType: "", subject: "", description: "" });
  const goOrdersLater = () => setTimeout(() => router.replace("/orders"), 2000);

  useEffect(() => {
    if (!orderId) {
      toast.error("Order ID is required");
      goOrdersLater();
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const r = await orderAPI.getOrderDetails(orderId);
        const data = r?.data?.success && r.data.data?.order ? r.data.data.order : r?.data?.order || null;
        if (!data) {
          toast.error("Order not found");
          goOrdersLater();
          return;
        }
        setOrder(data);
      } catch (e) {
        toast.error(e?.response?.data?.message || "Failed to load order details");
        goOrdersLater();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleSubmit = async () => {
    if (!formData.complaintType) return toast.error("Please select a complaint type");
    if (!formData.subject.trim()) return toast.error("Please enter a subject");
    if (!formData.description.trim()) return toast.error("Please enter a description");
    try {
      setSubmitting(true);
      const mongoId = order?._id || orderId;
      if (!mongoId) {
        toast.error("Order ID not available");
        return undefined;
      }
      const r = await orderAPI.submitComplaint({ orderId: String(mongoId), complaintType: formData.complaintType, subject: formData.subject, description: formData.description });
      if (r?.data?.success) {
        toast.success("Complaint submitted successfully");
        router.replace(`/orders/${order?._id || orderId}/details`);
      } else toast.error(r?.data?.message || "Failed to submit complaint");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
    return undefined;
  };

  if (loading) {
    return (
      <Screen bg={palette.gray50}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Loading...</Txt>
        </View>
      </Screen>
    );
  }
  if (!order) return <Screen bg={palette.gray50} />;

  const restaurantName = order?.restaurantId?.restaurantName || order?.restaurantId?.name || order?.restaurantName || order?.restaurant?.restaurantName || "Restaurant";
  const itemNames = (order?.items || []).map((i) => i?.name || i?.foodName).filter(Boolean).join(", ");
  const selectedLabel = COMPLAINT_TYPES.find((t) => t.value === formData.complaintType)?.label;

  return (
    <Screen bg={palette.gray50}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/orders"))} style={{ padding: 4 }}><ArrowLeft size={24} color={palette.gray700} /></Pressable>
        <Txt weight={600} style={{ fontSize: 18, color: palette.gray800, marginLeft: 12 }}>Submit Complaint</Txt>
        <Pressable onPress={() => router.push("/profile/support")} style={{ marginLeft: "auto" }}>
          <Txt weight={600} style={{ fontSize: 14, color: palette.amber600 }}>View History</Txt>
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
          <View style={styles.orderCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, backgroundColor: palette.gray100, borderRadius: 8, alignItems: "center", justifyContent: "center" }}><FileText size={20} color={palette.gray600} /></View>
              <View style={{ flex: 1 }}>
                <Txt weight={600} style={{ fontSize: 16, color: palette.gray800 }}>Order #{order.orderId || order._id}</Txt>
                <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{itemNames ? `${restaurantName} • ${itemNames}` : restaurantName}</Txt>
              </View>
            </View>
            <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</Txt>
          </View>

          <View style={{ marginHorizontal: 16, marginTop: 16, gap: 16 }}>
            <View>
              <Txt weight={600} style={styles.label}>Complaint Type <Txt weight={600} style={{ color: palette.red500 }}>*</Txt></Txt>
              <Pressable onPress={() => setShowTypes(true)} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <Txt weight={400} style={{ fontSize: 14, color: selectedLabel ? palette.gray900 : palette.gray500 }}>{selectedLabel || "Select complaint type"}</Txt>
                <ChevronDown size={18} color={palette.gray500} />
              </Pressable>
            </View>
            <View>
              <Txt weight={600} style={styles.label}>Subject <Txt weight={600} style={{ color: palette.red500 }}>*</Txt></Txt>
              <TextInput value={formData.subject} onChangeText={(t) => setFormData((p) => ({ ...p, subject: t }))} placeholder="Brief description of your complaint" placeholderTextColor={palette.gray400} maxLength={200} style={styles.input} />
            </View>
            <View>
              <Txt weight={600} style={styles.label}>Description <Txt weight={600} style={{ color: palette.red500 }}>*</Txt></Txt>
              <TextInput value={formData.description} onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))} placeholder="Please provide detailed information about your complaint..." placeholderTextColor={palette.gray400} maxLength={1000} multiline numberOfLines={6} textAlignVertical="top" style={[styles.input, { height: 140, paddingTop: 12 }]} />
              <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>{formData.description.length}/1000 characters</Txt>
            </View>
            <View style={styles.info}>
              <AlertCircle size={20} color={palette.blue600} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Txt weight={600} style={{ fontSize: 14, color: "#1e40af", marginBottom: 4 }}>What happens next?</Txt>
                <Txt weight={400} style={{ fontSize: 14, color: "#1d4ed8" }}>Your complaint will be sent to the restaurant. They will review and respond to your complaint. You can track the status in your complaints section.</Txt>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.bottom, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable disabled={submitting} onPress={handleSubmit} style={[styles.submit, submitting && { opacity: 0.5 }]}>
          {submitting ? <Spinner size={16} color={palette.black} /> : null}
          <Txt weight={600} style={{ fontSize: 16, color: palette.black }}>{submitting ? "Submitting..." : "Submit Complaint"}</Txt>
        </Pressable>
      </View>
      <BottomSheet visible={showTypes} onClose={() => setShowTypes(false)}>
        <View style={{ paddingVertical: 12 }}>
          <Txt weight={600} style={{ fontSize: 16, color: palette.gray900, paddingHorizontal: 20, paddingVertical: 12 }}>Select complaint type</Txt>
          {COMPLAINT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => {
                setFormData((p) => ({ ...p, complaintType: t.value }));
                setShowTypes(false);
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Txt weight={formData.complaintType === t.value ? 600 : 400} style={{ fontSize: 15, color: palette.gray900 }}>{t.label}</Txt>
              {formData.complaintType === t.value ? <Check size={18} color={palette.amber600} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

export default function SubmitComplaintRoute() {
  return (
    <RequireAuth>
      <SubmitComplaintScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray200, elevation: 1 },
  orderCard: { backgroundColor: palette.white, marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, elevation: 1 },
  label: { fontSize: 14, color: palette.gray700, marginBottom: 8 },
  input: { minHeight: 48, paddingHorizontal: 16, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray300, borderRadius: 8, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900 },
  info: { backgroundColor: palette.blue50, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 8, padding: 16, flexDirection: "row", gap: 12 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopWidth: 1, borderColor: palette.gray200, padding: 16 },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: palette.yellow, paddingVertical: 14, borderRadius: 8 },
});
