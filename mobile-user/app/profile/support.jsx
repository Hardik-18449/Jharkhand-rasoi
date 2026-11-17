/** Help & Support tickets — port of pages/user/profile/Support.jsx (datalist → search box + tappable matches). */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Building2, HelpCircle, ShoppingBag, ChevronRight } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import Button from "../../src/components/ui/Button";
import RequireAuth from "../../src/components/RequireAuth";
import { orderAPI, restaurantAPI, supportAPI, authAPI } from "../../src/api";
import { toast } from "../../src/utils/toast";
import { palette, fonts } from "../../src/theme";

const orderIssues = ["Item missing", "Wrong item", "Not delivered", "Payment issue"];
const restaurantIssues = ["Bad service", "Wrong info", "Other"];
const statusColors = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "resolved" || s === "closed") return { bg: palette.green100, fg: palette.green700 };
  if (s === "open") return { bg: "#fef3c7", fg: "#b45309" };
  return { bg: palette.slate100, fg: "#334155" };
};
const getOrderLabel = (o) => {
  const name = o?.restaurantId?.restaurantName || o?.restaurantId?.name || o?.restaurantName || o?.restaurant?.restaurantName || "Restaurant";
  const d = o?.createdAt || o?.date;
  const items = (o?.items || []).map((i) => i?.name || i?.foodName).filter(Boolean).join(", ");
  return `${name}${items ? ` • ${items}` : ""} • ${d ? new Date(d).toLocaleDateString() : "No date"} • ₹${o?.pricing?.total ?? o?.total ?? 0}`;
};
const getRestaurantLabel = (r) => {
  const loc = r?.city || r?.area || "";
  return `${r?.restaurantName || r?.name || "Restaurant"}${loc ? ` • ${loc}` : ""}`;
};

// Module-level so the TextInput is not remounted (keyboard would close) on every keystroke.
const Textarea = (props) => <TextInput multiline textAlignVertical="top" placeholderTextColor={palette.gray400} style={[styles.input, { minHeight: 80, paddingTop: 10 }]} {...props} />;

function SupportScreen() {
  const router = useRouter();
  const [step, setStep] = useState("pick");
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [issueType, setIssueType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [restaurantSearch, setRestaurantSearch] = useState("");

  useEffect(() => {
    setLoadingTickets(true);
    authAPI
      .getCurrentUser()
      .catch(() => null)
      .finally(async () => {
        try {
          const r = await supportAPI.getMyTickets();
          setTickets(r?.data?.data?.tickets || r?.data?.tickets || []);
        } catch {}
        setLoadingTickets(false);
      });
  }, []);

  const handlePick = (t) => {
    setOrderSearch("");
    setRestaurantSearch("");
    if (t === "order") {
      orderAPI
        .getOrders({ limit: 10, page: 1 })
        .then((r) => setOrders(r?.data?.data?.orders || r?.data?.orders || []))
        .catch(() => toast.error("Failed to load orders"));
      setStep("choose_order");
    } else if (t === "restaurant") {
      restaurantAPI
        .getRestaurants({ limit: 20, page: 1 })
        .then((r) => setRestaurants(r?.data?.data?.restaurants || r?.data?.restaurants || []))
        .catch(() => toast.error("Failed to load restaurants"));
      setStep("choose_restaurant");
    } else setStep("other_form");
  };
  const resetForm = () => {
    setStep("pick");
    setSelectedOrder(null);
    setSelectedRestaurant(null);
    setIssueType("");
    setSubject("");
    setDescription("");
  };
  const submitTicket = async (payload) => {
    setSubmitting(true);
    try {
      const r = await supportAPI.createTicket(payload);
      if (!r?.data?.success) throw new Error(r?.data?.message || "Failed");
      toast.success("Ticket created");
      setTickets((p) => [r?.data?.data?.ticket, ...p].filter(Boolean));
      resetForm();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const oq = orderSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    if (!oq) return true;
    const name = (o?.restaurantId?.restaurantName || o?.restaurantId?.name || o?.restaurantName || o?.restaurant?.restaurantName || "").toLowerCase();
    const items = (o?.items || []).map((i) => i?.name || i?.foodName).filter(Boolean).join(" ").toLowerCase();
    return name.includes(oq) || String(o?._id || o?.id || "").toLowerCase().includes(oq) || items.includes(oq);
  });
  const rq = restaurantSearch.trim().toLowerCase();
  const filteredRestaurants = restaurants.filter((r) => {
    if (!rq) return true;
    return [r?.restaurantName || r?.name, r?.city || r?.area, r?._id || r?.id].some((v) => String(v || "").toLowerCase().includes(rq));
  });

  const IssueGrid = ({ list }) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {list.map((it) => (
        <View key={it} style={{ width: "48%" }}>
          <Button title={it} variant={issueType === it ? "primary" : "outline"} rounded="md" size="sm" onPress={() => setIssueType(it)} />
        </View>
      ))}
    </View>
  );

  return (
    <Screen bg="#f5f5f5">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Pressable onPress={() => (step === "pick" ? (router.canGoBack() ? router.back() : router.replace("/profile")) : setStep("pick"))} style={{ width: 32, height: 32, justifyContent: "center", marginBottom: 16 }}>
          <ArrowLeft size={20} color={palette.black} />
        </Pressable>
        <View style={styles.card}>
          <Txt weight={700} style={{ fontSize: 20, color: "#0f172a" }}>Help & Support</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.slate500, marginTop: 4 }}>Raise a support ticket and track updates in one place.</Txt>
        </View>
        <View style={[styles.card, { gap: 16 }]}>
          {step === "pick" ? (
            <View style={{ gap: 12 }}>
              {[
                ["order", ShoppingBag, "Order Issue", "Missing item, wrong item, delivery issue"],
                ["restaurant", Building2, "Restaurant Issue", "Service, listing info, behavior report"],
                ["other", HelpCircle, "Other Issue", "Account, app, payment or general query"],
              ].map(([k, Icon, t, d]) => (
                <Pressable key={k} onPress={() => handlePick(k)} style={styles.pickBtn}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Icon size={20} color="#334155" />
                    <ChevronRight size={16} color="#94a3b8" />
                  </View>
                  <Txt weight={600} style={{ marginTop: 12, fontSize: 16, color: "#0f172a" }}>{t}</Txt>
                  <Txt weight={400} style={{ fontSize: 12, color: palette.slate500, marginTop: 4 }}>{d}</Txt>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === "choose_order" ? (
            <View style={{ gap: 12 }}>
              <Txt weight={600} style={styles.h3}>Select an order</Txt>
              {orders.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <TextInput value={orderSearch} onChangeText={setOrderSearch} placeholder="Select/search order" placeholderTextColor={palette.gray400} style={styles.input} />
                  {filteredOrders.map((o) => (
                    <Pressable
                      key={o._id || o.id}
                      onPress={() => {
                        setSelectedOrder(o);
                        setStep("order_issue");
                      }}
                      style={styles.option}
                    >
                      <Txt weight={400} style={{ fontSize: 14, color: "#0f172a" }}>{getOrderLabel(o)}</Txt>
                    </Pressable>
                  ))}
                  {filteredOrders.length === 0 ? <Txt weight={400} style={styles.muted}>No matching orders found</Txt> : null}
                </View>
              ) : (
                <Txt weight={400} style={styles.muted}>No recent orders found</Txt>
              )}
              <Button title="Back" variant="outline" rounded="md" size="sm" onPress={() => setStep("pick")} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : null}

          {step === "order_issue" && selectedOrder ? (
            <View style={{ gap: 12 }}>
              <Txt weight={600} style={styles.h3}>Issue type</Txt>
              <IssueGrid list={orderIssues} />
              <Textarea placeholder="Describe the issue (optional)" value={description} onChangeText={setDescription} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title={submitting ? "Submitting..." : "Submit Ticket"} rounded="md" size="sm" disabled={!issueType || submitting} onPress={() => submitTicket({ type: "order", orderId: selectedOrder._id || selectedOrder.id, issueType, description })} />
                <Button title="Cancel" variant="outline" rounded="md" size="sm" onPress={() => setStep("pick")} />
              </View>
            </View>
          ) : null}

          {step === "choose_restaurant" ? (
            <View style={{ gap: 12 }}>
              <Txt weight={600} style={styles.h3}>Select a restaurant</Txt>
              {restaurants.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <TextInput value={restaurantSearch} onChangeText={setRestaurantSearch} placeholder="Select/search restaurant" placeholderTextColor={palette.gray400} style={styles.input} />
                  {filteredRestaurants.map((r) => (
                    <Pressable
                      key={r._id || r.id}
                      onPress={() => {
                        setSelectedRestaurant(r);
                        setStep("restaurant_issue");
                      }}
                      style={styles.option}
                    >
                      <Txt weight={400} style={{ fontSize: 14, color: "#0f172a" }}>{getRestaurantLabel(r)}</Txt>
                    </Pressable>
                  ))}
                  {filteredRestaurants.length === 0 ? <Txt weight={400} style={styles.muted}>No matching restaurants found</Txt> : null}
                </View>
              ) : (
                <Txt weight={400} style={styles.muted}>No restaurants found</Txt>
              )}
              <Button title="Back" variant="outline" rounded="md" size="sm" onPress={() => setStep("pick")} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : null}

          {step === "restaurant_issue" && selectedRestaurant ? (
            <View style={{ gap: 12 }}>
              <Txt weight={600} style={styles.h3}>Issue type</Txt>
              <IssueGrid list={restaurantIssues} />
              <Textarea placeholder="Describe the issue (optional)" value={description} onChangeText={setDescription} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title={submitting ? "Submitting..." : "Submit Ticket"} rounded="md" size="sm" disabled={!issueType || submitting} onPress={() => submitTicket({ type: "restaurant", restaurantId: selectedRestaurant._id || selectedRestaurant.id, issueType, description })} />
                <Button title="Cancel" variant="outline" rounded="md" size="sm" onPress={() => setStep("pick")} />
              </View>
            </View>
          ) : null}

          {step === "other_form" ? (
            <View style={{ gap: 12 }}>
              <TextInput placeholder="Subject" value={subject} onChangeText={setSubject} placeholderTextColor={palette.gray400} style={styles.input} />
              <Textarea placeholder="Describe your issue" value={description} onChangeText={setDescription} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title={submitting ? "Submitting..." : "Submit Ticket"} rounded="md" size="sm" disabled={!subject || submitting} onPress={() => submitTicket({ type: "other", issueType: subject || "Other", description })} />
                <Button title="Cancel" variant="outline" rounded="md" size="sm" onPress={() => setStep("pick")} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Txt weight={600} style={{ fontSize: 16, color: palette.gray900 }}>My Tickets</Txt>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: palette.slate100 }}><Txt weight={500} style={{ fontSize: 12, color: "#475569" }}>{tickets.length}</Txt></View>
          </View>
          {loadingTickets ? (
            <Txt weight={400} style={styles.muted}>Loading tickets...</Txt>
          ) : tickets.length === 0 ? (
            <Txt weight={400} style={styles.muted}>No tickets yet</Txt>
          ) : (
            <View style={{ gap: 8 }}>
              {tickets.map((t) => {
                const c = statusColors(t.status);
                return (
                  <View key={t._id || t.id} style={styles.ticket}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Txt weight={600} style={{ fontSize: 14, color: "#0f172a" }}>#{String(t._id || t.id).slice(-6)} • {t.type} • {t.issueType}</Txt>
                        <Txt weight={400} style={{ fontSize: 12, color: palette.slate500, marginTop: 4 }}>{new Date(t.createdAt).toLocaleDateString()}</Txt>
                      </View>
                      <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: c.bg }}><Txt weight={600} style={{ fontSize: 11, color: c.fg }}>{t.status}</Txt></View>
                    </View>
                    {t.adminResponse ? <Txt weight={400} style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Reply: {t.adminResponse}</Txt> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

export default function SupportRoute() {
  return (
    <RequireAuth>
      <SupportScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.white, borderRadius: 12, borderWidth: 1, borderColor: palette.slate200, padding: 16, marginBottom: 12, elevation: 1 },
  pickBtn: { borderWidth: 1, borderColor: palette.slate200, borderRadius: 12, padding: 16 },
  h3: { fontSize: 16, color: "#0f172a" },
  muted: { fontSize: 14, color: palette.slate500 },
  input: { minHeight: 44, borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900, backgroundColor: palette.white },
  option: { borderWidth: 1, borderColor: palette.slate200, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  ticket: { borderWidth: 1, borderColor: palette.slate200, borderRadius: 8, padding: 12, backgroundColor: palette.white },
});
