/** Port of pages/user/profile/ReportSafetyEmergency.jsx */
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, AlertTriangle, Phone, Shield } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import Button from "../../src/components/ui/Button";
import BottomSheet from "../../src/components/ui/BottomSheet";
import RequireAuth from "../../src/components/RequireAuth";
import { userAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { palette, fonts } from "../../src/theme";

const STATUS = { unread: [palette.blue100, "#1d4ed8"], read: [palette.slate100, "#334155"], urgent: [palette.red100, "#b91c1c"], resolved: [palette.green100, palette.green700] };
const PRIORITY = { low: [palette.gray100, palette.gray700], medium: ["#fef9c3", "#a16207"], high: [palette.orange100, "#c2410c"], critical: [palette.red100, "#b91c1c"] };
const cap = (s) => String(s).replace(/^\w/, (c) => c.toUpperCase());
const Pill = ({ map, value, fallback }) => {
  const [bg, fg] = map[String(value)] || map[fallback];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: bg }}>
      <Txt weight={value === "critical" ? 700 : 600} style={{ fontSize: 11, color: fg }}>{cap(value || fallback)}</Txt>
    </View>
  );
};
const fmt = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
};

function ReportSafetyScreen() {
  const router = useRouter();
  const [report, setReport] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const r = await userAPI.getMySafetyEmergencyReports({ page: 1, limit: 20 });
      const list = r?.data?.data?.safetyEmergencies ?? [];
      setHistory(Array.isArray(list) ? list : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };
  useEffect(() => {
    fetchHistory();
  }, []);
  const sorted = useMemo(() => [...history].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)), [history]);

  const handleSubmit = async () => {
    if (!report.trim()) return toast.error("Please describe the safety concern or emergency");
    if (report.trim().length < 10) return toast.error("Description must be at least 10 characters");
    try {
      setIsSubmitting(true);
      const r = await userAPI.createSafetyEmergencyReport(report.trim());
      if (r.data.success) {
        setIsSubmitted(true);
        setReport("");
        toast.success("Safety emergency report submitted successfully!");
        fetchHistory();
        setTimeout(() => setIsSubmitted(false), 5000);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || e.response?.data?.error || "Failed to submit safety emergency report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
    return undefined;
  };
  const tooShort = report.trim().length < 10;

  return (
    <Screen bg="#f5f5f5">
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={{ width: 32, height: 32, justifyContent: "center" }}><ArrowLeft size={16} color={palette.black} /></Pressable>
            <Txt weight={700} style={{ fontSize: 20, color: palette.black, flex: 1 }}>Report a safety emergency</Txt>
          </View>

          <View style={[styles.card, { backgroundColor: palette.red50, borderWidth: 1, borderColor: "#fecaca" }]}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.iconCircle, { backgroundColor: palette.red100 }]}><Phone size={20} color={palette.red600} /></View>
              <View style={{ flex: 1 }}>
                <Txt weight={600} style={{ fontSize: 16, color: "#7f1d1d", marginBottom: 4 }}>Emergency Contact</Txt>
                <Txt weight={400} style={{ fontSize: 14, color: "#b91c1c", marginBottom: 12 }}>For immediate emergencies, please call your local emergency services.</Txt>
                <Pressable onPress={() => Linking.openURL("tel:100")}>
                  <Txt weight={600} style={{ fontSize: 16, color: palette.red600 }}>Emergency: 100</Txt>
                </Pressable>
              </View>
            </View>
          </View>

          {!isSubmitted ? (
            <>
              <View style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: palette.gray100 }]}><Shield size={20} color={palette.gray700} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt weight={600} style={{ fontSize: 16, color: palette.gray900, marginBottom: 4 }}>Safety is our priority</Txt>
                    <Txt weight={400} style={{ fontSize: 14, color: palette.gray600 }}>Report any safety concerns, incidents, or emergencies related to your order or delivery experience.</Txt>
                  </View>
                </View>
              </View>
              <View style={styles.card}>
                <Txt weight={500} style={{ fontSize: 14, color: palette.gray900, marginBottom: 8 }}>Describe the safety concern or emergency</Txt>
                <TextInput placeholder="Please provide details about the safety issue..." placeholderTextColor={palette.gray400} value={report} onChangeText={setReport} multiline textAlignVertical="top" style={styles.textarea} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Txt weight={400} style={{ fontSize: 12, color: tooShort ? palette.red500 : palette.gray500 }}>{report.length} characters</Txt>
                  <Txt weight={400} style={{ fontSize: 12, color: tooShort ? palette.red500 : palette.gray500 }}>Min 10 characters</Txt>
                </View>
              </View>
              <Button title={isSubmitting ? "Submitting..." : "Report Safety Issue"} variant="destructive" rounded="md" loading={isSubmitting} disabled={tooShort || isSubmitting} onPress={handleSubmit} />

              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>Your report history</Txt>
                  <Button title={historyLoading ? "Loading" : "Refresh"} variant="outline" rounded="md" size="sm" loading={historyLoading} disabled={historyLoading} onPress={fetchHistory} />
                </View>
                {historyLoading && sorted.length === 0 ? (
                  <Txt weight={400} style={styles.muted}>Loading your reports...</Txt>
                ) : sorted.length === 0 ? (
                  <Txt weight={400} style={styles.muted}>No reports yet.</Txt>
                ) : (
                  <View style={{ marginTop: 16, gap: 12 }}>
                    {sorted.map((it) => (
                      <Pressable key={it?._id || it?.id || `${it?.createdAt}`} onPress={() => setSelected(it)} style={styles.historyItem}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight={500} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{it?.message || "—"}</Txt>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray500, marginTop: 4 }}>{fmt(it?.createdAt)}</Txt>
                        </View>
                        <Pill map={STATUS} value={it?.status} fallback="unread" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={[styles.card, { borderRadius: 16, padding: 24, alignItems: "center" }]}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.red100, alignItems: "center", justifyContent: "center", marginBottom: 16 }}><AlertTriangle size={32} color={palette.red600} /></View>
              <Txt weight={700} style={{ fontSize: 20, color: palette.gray900, marginBottom: 8 }}>Report Submitted</Txt>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray600, marginBottom: 12, textAlign: "center" }}>Your safety report has been submitted. Our team will review it immediately and take appropriate action.</Txt>
              <Txt weight={500} style={{ fontSize: 12, color: palette.red600, textAlign: "center" }}>If this is a life-threatening emergency, please call 100 immediately.</Txt>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} position="center">
        {selected ? (
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 20, width: 340, gap: 16 }}>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={20} color={palette.red600} />
                <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Report Details</Txt>
              </View>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray500, marginTop: 4 }}>Full details of your safety emergency report.</Txt>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Pill map={STATUS} value={selected?.status} fallback="unread" />
              {selected?.priority ? <Pill map={PRIORITY} value={selected.priority} fallback="medium" /> : null}
              {selected?.createdAt ? <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{fmt(selected.createdAt)}</Txt> : null}
            </View>
            <View style={{ borderRadius: 8, borderWidth: 1, borderColor: palette.gray200, padding: 16 }}>
              <Txt weight={400} style={{ fontSize: 14, color: palette.gray800, lineHeight: 22 }}>{selected?.message || "—"}</Txt>
            </View>
            {selected?.adminResponse ? (
              <View style={{ borderRadius: 8, borderWidth: 1, borderColor: "#a7f3d0", backgroundColor: "rgba(236,253,245,0.6)", padding: 16 }}>
                <Txt weight={600} style={{ fontSize: 12, color: "#047857", letterSpacing: 1, marginBottom: 8 }}>ADMIN RESPONSE</Txt>
                <Txt weight={400} style={{ fontSize: 14, color: "#064e3b", lineHeight: 22 }}>{selected.adminResponse}</Txt>
                {selected?.respondedAt ? <Txt weight={400} style={{ fontSize: 12, color: "#047857", marginTop: 8 }}>Responded at: {fmt(selected.respondedAt)}</Txt> : null}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

export default function ReportSafetyRoute() {
  return (
    <RequireAuth>
      <ReportSafetyScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  iconCircle: { borderRadius: 999, padding: 8, alignSelf: "flex-start" },
  textarea: { minHeight: 150, borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, padding: 12, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: palette.gray900 },
  muted: { fontSize: 14, color: palette.gray500, marginTop: 16 },
  historyItem: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, padding: 12, backgroundColor: palette.gray50 },
});
