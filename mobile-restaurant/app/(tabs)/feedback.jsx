/** Feedback tab — port of pages/restaurant/Feedback.jsx: Complaints (date range + search) and Reviews (from delivered orders, rating summary, sort). */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Star, MessageSquare, Search } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import RestaurantHeader from "../../src/components/RestaurantHeader";
import { restaurantAPI } from "../../src/api";
import { fonts, palette, rt, BOTTOM_NAV_HEIGHT } from "../../src/theme";

const normalizeRating = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.round(n * 10) / 10);
};
const ratingOf = (o) => normalizeRating(o?.review?.rating ?? o?.ratings?.restaurant?.rating ?? o?.feedback?.rating ?? o?.rating);
const textOf = (o) => String(o?.review?.comment ?? o?.review?.text ?? o?.ratings?.restaurant?.comment ?? o?.feedback?.comment ?? o?.feedback?.text ?? "").trim() || "No review text";
const idOf = (v) => String(v?._id || v || "").trim();

const RANGES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last5days", "Last 5 days"],
  ["thisWeek", "This week"],
  ["lastWeek", "Last week"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
];
function rangeDates(key) {
  const now = new Date();
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const eod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const today = sod(now);
  const dow = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dow);
  switch (key) {
    case "today":
      return [today, now];
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return [y, eod(y)];
    }
    case "thisWeek": {
      const e = new Date(weekStart);
      e.setDate(e.getDate() + 6);
      return [weekStart, eod(e)];
    }
    case "lastWeek": {
      const s = new Date(weekStart);
      s.setDate(s.getDate() - 7);
      const e = new Date(weekStart);
      e.setDate(e.getDate() - 1);
      return [s, eod(e)];
    }
    case "thisMonth":
      return [new Date(today.getFullYear(), today.getMonth(), 1), eod(new Date(today.getFullYear(), today.getMonth() + 1, 0))];
    case "lastMonth":
      return [new Date(today.getFullYear(), today.getMonth() - 1, 1), eod(new Date(today.getFullYear(), today.getMonth(), 0))];
    default: {
      const s = new Date(today);
      s.setDate(s.getDate() - 4);
      return [s, eod(today)];
    }
  }
}

function Stars({ value = 0, size = 14 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= Math.round(value) ? "#f59e0b" : palette.gray300} fill={i <= Math.round(value) ? "#f59e0b" : "transparent"} />
      ))}
    </View>
  );
}

export default function FeedbackScreen() {
  const [activeTab, setActiveTab] = useState("reviews");
  const [range, setRange] = useState("last5days");
  const [search, setSearch] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [refreshing, setRefreshing] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoadingComplaints(true);
      const [from, to] = rangeDates(range);
      const params = { fromDate: from.toISOString(), toDate: to.toISOString() };
      if (search.trim()) params.search = search.trim();
      const res = await restaurantAPI.getComplaints(params);
      setComplaints(res?.data?.success && res.data.data?.complaints ? res.data.data.complaints : []);
    } catch {
      setComplaints([]);
    } finally {
      setLoadingComplaints(false);
    }
  }, [range, search]);

  const fetchReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      let all = [];
      for (let page = 1; page <= 5; page += 1) {
        const res = await restaurantAPI.getOrders({ page, limit: 1000, status: "delivered" });
        const rows = res?.data?.data?.orders || [];
        all = all.concat(rows);
        const totalPages = res?.data?.data?.meta?.totalPages || 1;
        if (rows.length < 1000 || page >= totalPages) break;
      }
      const list = all
        .filter((o) => String(o?.status || o?.orderStatus || "").toLowerCase() === "delivered")
        .map((o, i) => {
          const d = new Date(o.createdAt || o.deliveredAt || Date.now());
          const userName = o.userId?.name || o.customerName || "Customer";
          return {
            id: o._id || o.orderId || `review-${i}`,
            orderNumber: o.orderId || String(i),
            userName,
            userImage: o.userId?.profileImage || null,
            ordersCount: all.filter((x) => idOf(x.userId) === idOf(o.userId)).length,
            rating: ratingOf(o),
            ts: d.getTime(),
            date: `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}, ${d.getFullYear()}`,
            reviewText: textOf(o),
          };
        })
        .filter((r) => r.rating !== null || r.reviewText !== "No review text");
      setReviews(list);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);
  useEffect(() => {
    if (activeTab !== "complaints") return undefined;
    const t = setTimeout(fetchComplaints, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [activeTab, fetchComplaints, search]);

  const summary = useMemo(() => {
    const ratings = reviews.map((r) => r.rating).filter((r) => r !== null);
    return { avg: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0, totalRatings: ratings.length, totalReviews: reviews.length };
  }, [reviews]);
  const sorted = useMemo(() => {
    const l = [...reviews];
    l.sort((a, b) => (sortBy === "oldest" ? a.ts - b.ts : sortBy === "bestRated" ? (b.rating ?? 0) - (a.rating ?? 0) : sortBy === "worstRated" ? (a.rating ?? 0) - (b.rating ?? 0) : b.ts - a.ts));
    return l;
  }, [reviews, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    await (activeTab === "complaints" ? fetchComplaints() : fetchReviews());
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: rt.pageBg }}>
      <RestaurantHeader showSearch={false} />
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        {[
          ["complaints", "Complaints"],
          ["reviews", "Reviews"],
        ].map(([k, l]) => (
          <Pressable key={k} onPress={() => setActiveTab(k)} style={[styles.tab, activeTab === k && styles.tabActive]}>
            <Txt weight={600} style={{ fontSize: 14, color: activeTab === k ? palette.white : palette.gray600 }}>{l}</Txt>
            {k === "complaints" && complaints.length > 0 && activeTab !== "complaints" ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 48 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rt.primary]} />}>
        {activeTab === "complaints" ? (
          <>
            <View style={styles.searchBox}>
              <Search size={16} color={palette.gray400} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search by order ID or customer" placeholderTextColor={palette.gray400} style={styles.searchInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {RANGES.map(([k, l]) => (
                <Pressable key={k} onPress={() => setRange(k)} style={[styles.chip, range === k && styles.chipActive]}>
                  <Txt weight={range === k ? 700 : 500} style={{ fontSize: 12, color: range === k ? palette.white : palette.gray700 }}>{l}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            {loadingComplaints ? (
              <Spinner full />
            ) : complaints.length === 0 ? (
              <View style={styles.emptyBox}>
                <MessageSquare size={36} color={palette.gray300} />
                <Txt weight={600} style={{ color: palette.gray500, marginTop: 8 }}>No complaints found</Txt>
              </View>
            ) : (
              complaints.map((c) => (
                <View key={c._id || c.id} style={styles.card}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>#{c.orderId?.orderId || c.orderId || "Order"}</Txt>
                    <Txt weight={700} style={[styles.statusChip, String(c.status).toLowerCase() === "resolved" ? { backgroundColor: palette.green50, color: palette.green700 } : { backgroundColor: "#fffbeb", color: "#b45309" }]}>
                      {String(c.status || "open").toUpperCase()}
                    </Txt>
                  </View>
                  <Txt weight={600} style={{ fontSize: 13, color: rt.primary, marginTop: 4 }}>{String(c.issueType || c.complaintType || "Issue").replace(/_/g, " ")}</Txt>
                  {c.description ? <Txt style={{ fontSize: 13, color: palette.gray700, marginTop: 4 }}>{c.description}</Txt> : null}
                  <Txt style={{ fontSize: 11, color: palette.gray400, marginTop: 6 }}>
                    {c.userId?.name ? `${c.userId.name} • ` : ""}
                    {c.createdAt ? new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </Txt>
                  {c.adminResponse ? (
                    <View style={styles.adminBox}>
                      <Txt weight={700} style={{ fontSize: 11, color: "#1d4ed8" }}>Admin Response</Txt>
                      <Txt style={{ fontSize: 12, color: "#1e3a8a", marginTop: 2 }}>{c.adminResponse}</Txt>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.summary}>
              <View style={{ alignItems: "center", paddingRight: 16, borderRightWidth: 1, borderRightColor: palette.gray100 }}>
                <Txt weight={800} style={{ fontSize: 32, color: palette.gray900 }}>{summary.avg ? summary.avg.toFixed(1) : "0.0"}</Txt>
                <Stars value={summary.avg} />
              </View>
              <View style={{ flex: 1, paddingLeft: 16 }}>
                <Txt weight={600} style={{ fontSize: 14, color: palette.gray900 }}>{summary.totalRatings} ratings</Txt>
                <Txt style={{ fontSize: 13, color: palette.gray500, marginTop: 2 }}>{summary.totalReviews} reviews</Txt>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {[
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["bestRated", "Best rated"],
                ["worstRated", "Worst rated"],
              ].map(([k, l]) => (
                <Pressable key={k} onPress={() => setSortBy(k)} style={[styles.chip, sortBy === k && styles.chipActive]}>
                  <Txt weight={sortBy === k ? 700 : 500} style={{ fontSize: 12, color: sortBy === k ? palette.white : palette.gray700 }}>{l}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            {loadingReviews ? (
              <Spinner full />
            ) : sorted.length === 0 ? (
              <View style={styles.emptyBox}>
                <Star size={36} color={palette.gray300} />
                <Txt weight={600} style={{ color: palette.gray500, marginTop: 8 }}>No reviews yet</Txt>
              </View>
            ) : (
              sorted.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {r.userImage ? (
                      <Image source={{ uri: r.userImage }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: rt.primarySoft, alignItems: "center", justifyContent: "center" }]}>
                        <Txt weight={700} style={{ color: rt.primary }}>{r.userName.charAt(0).toUpperCase()}</Txt>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Txt weight={700} style={{ fontSize: 14, color: palette.gray900 }}>{r.userName}</Txt>
                      <Txt style={{ fontSize: 11, color: palette.gray500 }}>{r.ordersCount} order{r.ordersCount === 1 ? "" : "s"} • #{r.orderNumber}</Txt>
                    </View>
                    <Txt style={{ fontSize: 11, color: palette.gray400 }}>{r.date}</Txt>
                  </View>
                  {r.rating !== null ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <Stars value={r.rating} />
                      <Txt weight={700} style={{ fontSize: 12, color: palette.gray700 }}>{r.rating}</Txt>
                    </View>
                  ) : null}
                  {r.reviewText !== "No review text" ? <Txt style={{ fontSize: 13, color: palette.gray700, marginTop: 6 }}>{r.reviewText}</Txt> : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  tabActive: { backgroundColor: rt.primary, borderColor: rt.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red500 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: palette.white, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.gray200 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: palette.gray900, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  chipActive: { backgroundColor: rt.primary, borderColor: rt.primary },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  card: { backgroundColor: palette.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: palette.gray100 },
  statusChip: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  adminBox: { marginTop: 8, backgroundColor: palette.blue50, borderRadius: 10, padding: 10 },
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: palette.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: palette.gray100 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
});
