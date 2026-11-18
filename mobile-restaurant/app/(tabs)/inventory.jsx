/**
 * Inventory tab — port of pages/restaurant/Inventory.jsx (daily-operations part):
 * Menu (sections → items) with category / item stock toggles, "turn off" popup (specific hours / next business day /
 * custom date-time / manual) with local stock rules + auto-resume (same storage key as web), recommended toggle,
 * filters + header search; Add-ons and Combos lists with availability toggles and approval badges.
 * Creating / editing dishes, add-ons and combos stays on the web dashboard (deviation D2).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ChevronDown, ChevronUp, Star, Minus, Plus, X } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Spinner from "../../src/components/ui/Spinner";
import AppImage from "../../src/components/ui/AppImage";
import RestaurantHeader from "../../src/components/RestaurantHeader";
import { restaurantAPI } from "../../src/api";
import { addAppListener } from "../../src/utils/events";
import { localStore } from "../../src/utils/storage";
import { toast } from "../../src/utils/toast";
import { palette, rt, BOTTOM_NAV_HEIGHT } from "../../src/theme";

const STOCK_RULES_KEY = "restaurant_inventory_stock_rules_v1";
const MENU_FILTERS = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "recommended", label: "Recommended" },
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-veg" },
];
const ADDON_FILTERS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const readRules = () => {
  try {
    return JSON.parse(localStore.getItem(STOCK_RULES_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const normalizeDayName = (v) => String(v || "").trim().toLowerCase().replace(/\./g, "");
const parseTime = (value) => {
  const raw = String(value || "").trim();
  const a = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (a) return { hours: Math.min(23, Number(a[1])), minutes: Math.min(59, Number(a[2])) };
  const b = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (b) {
    let h = Number(b[1]);
    if (b[3].toLowerCase() === "pm" && h !== 12) h += 12;
    if (b[3].toLowerCase() === "am" && h === 12) h = 0;
    return { hours: h, minutes: Number(b[2] || 0) };
  }
  return { hours: 9, minutes: 0 };
};
const nextBusinessDay = (profile) => {
  const now = new Date();
  const openDays = Array.isArray(profile?.openDays) ? profile.openDays.map(normalizeDayName).filter(Boolean) : [];
  const t = parseTime(profile?.openingTime || "09:00");
  for (let o = 1; o <= 7; o += 1) {
    const c = new Date(now);
    c.setDate(now.getDate() + o);
    if (openDays.length && !openDays.includes(normalizeDayName(c.toLocaleDateString("en-US", { weekday: "long" })))) continue;
    c.setHours(t.hours, t.minutes, 0, 0);
    return c.toISOString();
  }
  const f = new Date(now);
  f.setDate(now.getDate() + 1);
  f.setHours(t.hours, t.minutes, 0, 0);
  return f.toISOString();
};
const ruleLabel = (rule) => {
  if (!rule) return "No time set. Turn item in stock manually.";
  if (rule.mode === "manual") return "Manual off. Turn item in stock manually.";
  const d = new Date(rule.resumeAt || "");
  if (Number.isNaN(d.getTime())) return "Out of stock";
  const f = d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  return rule.mode === "next-business-day" ? `Back next business day at ${f}` : `Out of stock until ${f}`;
};
const approvalMeta = (s) => {
  const n = String(s || "approved").toLowerCase();
  if (n === "rejected") return { label: "Rejected", bg: palette.red50, fg: "#b91c1c", border: "#fecaca" };
  if (n === "pending") return { label: "Pending", bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  return { label: "Approved", bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
};

function mapItem(item, section) {
  return {
    id: String(item.id || item._id),
    name: item.name || "Unnamed Item",
    image: item.image || "",
    price: item.price ?? "",
    variants: Array.isArray(item.variants) ? item.variants : Array.isArray(item.variations) ? item.variations : [],
    categoryId: section.categoryId || section.id || "",
    inStock: item.isAvailable !== undefined ? item.isAvailable : true,
    isVeg: item.foodType === "Veg",
    approvalStatus: String(item.approvalStatus || "approved").toLowerCase(),
    rejectionReason: item.rejectionReason || "",
    isRecommended: Boolean(item.isRecommended),
  };
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("menu");
  const [categories, setCategories] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [stockRules, setStockRules] = useState(readRules);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [addons, setAddons] = useState([]);
  const [combos, setCombos] = useState([]);
  const [addonFilter, setAddonFilter] = useState("all");

  // turn-off popup
  const [target, setTarget] = useState(null);
  const [option, setOption] = useState("specific-time");
  const [hours, setHours] = useState(3);
  const [customAt, setCustomAt] = useState(null);
  const [picker, setPicker] = useState(null); // "date" | "time"

  useEffect(() => addAppListener("restaurantInventorySearch", (e) => setQuery(String(e?.detail?.query || ""))), []);
  useEffect(() => {
    localStore.setItem(STOCK_RULES_KEY, JSON.stringify(stockRules));
  }, [stockRules]);

  const loadMenu = useCallback(async () => {
    try {
      const [menuRes, profRes] = await Promise.all([restaurantAPI.getMenu(), restaurantAPI.getCurrentRestaurant().catch(() => null)]);
      setProfile(profRes?.data?.data?.restaurant || profRes?.data?.restaurant || null);
      const sections = menuRes?.data?.data?.menu?.sections || [];
      const rules = readRules();
      const now = Date.now();
      const cats = sections.map((section, i) => {
        const items = [];
        (section.items || []).forEach((it) => items.push(mapItem(it, section)));
        (section.subsections || []).forEach((sub) => (sub.items || []).forEach((it) => items.push(mapItem(it, section))));
        const ruled = items.map((it) => {
          const r = rules[it.id];
          const active = r && (r.mode === "manual" || (r.resumeAt && new Date(r.resumeAt).getTime() > now));
          return active ? { ...it, inStock: false, stockRule: r } : it;
        });
        return { id: section.id || `category-${i}`, name: section.name || "Unnamed Category", items: ruled, inStock: ruled.length ? ruled.every((x) => x.inStock) : true };
      });
      setCategories(cats);
      setExpanded((prev) => (prev.length ? prev : cats.map((c) => c.id)));
    } catch {
      toast.error("Failed to load menu data");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAddonsCombos = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([restaurantAPI.getAddons().catch(() => null), restaurantAPI.getCombos().catch(() => null)]);
      const al = a?.data?.data?.addons || a?.data?.addons || a?.data?.data || [];
      const cl = c?.data?.data?.combos || c?.data?.combos || c?.data?.data || [];
      setAddons((Array.isArray(al) ? al : []).map((x) => ({ ...x, id: String(x.id || x._id) })));
      setCombos((Array.isArray(cl) ? cl : []).map((x) => ({ ...x, id: String(x.id || x._id) })));
    } catch {}
  }, []);

  useEffect(() => {
    loadMenu();
    loadAddonsCombos();
  }, [loadMenu, loadAddonsCombos]);

  // Auto-resume expired rules (web runExpiryCheck)
  useEffect(() => {
    const ids = Object.keys(stockRules);
    if (!ids.length) return undefined;
    const run = () => {
      const now = Date.now();
      const expired = Object.entries(stockRules)
        .filter(([, r]) => r?.mode !== "manual" && Number.isFinite(new Date(r?.resumeAt || "").getTime()) && new Date(r.resumeAt).getTime() <= now)
        .map(([id]) => id);
      if (!expired.length) return;
      setCategories((prev) =>
        prev.map((c) => {
          let changed = false;
          const items = c.items.map((it) => {
            if (!expired.includes(it.id)) return it;
            changed = true;
            return { ...it, inStock: true, stockRule: null };
          });
          return changed ? { ...c, items, inStock: items.every((x) => x.inStock) } : c;
        }),
      );
      setStockRules((p) => {
        const n = { ...p };
        expired.forEach((id) => delete n[id]);
        return n;
      });
      expired.forEach((id) => restaurantAPI.updateFood(id, { isAvailable: true }).catch(() => {}));
    };
    run();
    const t = setInterval(run, 30000);
    return () => clearInterval(t);
  }, [stockRules]);

  const targetIds = (type, categoryId, itemId) => {
    const c = categories.find((x) => x.id === categoryId);
    return type === "category" ? (c?.items || []).map((i) => i.id) : itemId ? [itemId] : [];
  };
  const updateAvailability = async (type, categoryId, itemId, isAvailable) => {
    try {
      const ids = targetIds(type, categoryId, itemId);
      await Promise.all(ids.map((id) => restaurantAPI.updateFood(id, { isAvailable: Boolean(isAvailable) })));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update availability");
    }
  };
  const applyLocal = (type, categoryId, itemId, inStock, rule) =>
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoryId) return c;
        if (type === "category") return { ...c, inStock, items: c.items.map((i) => ({ ...i, inStock, stockRule: rule })) };
        return { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, inStock, stockRule: rule } : i)) };
      }),
    );

  const onToggle = async (type, categoryId, itemId, next) => {
    if (next) {
      applyLocal(type, categoryId, itemId, true, null);
      setStockRules((p) => {
        const n = { ...p };
        targetIds(type, categoryId, itemId).forEach((id) => delete n[id]);
        return n;
      });
      await updateAvailability(type, categoryId, itemId, true);
      return;
    }
    setTarget({ type, categoryId, itemId });
    setOption("specific-time");
    setHours(3);
    setCustomAt(null);
  };

  const confirmOff = async () => {
    if (!target) return;
    const createdAt = new Date().toISOString();
    let rule;
    if (option === "manual") rule = { mode: "manual", createdAt, resumeAt: null };
    else if (option === "next-business-day") rule = { mode: "next-business-day", createdAt, resumeAt: nextBusinessDay(profile) };
    else if (option === "custom-date-time") {
      if (!customAt) return toast.error("Please select a valid custom date and time");
      if (customAt.getTime() <= Date.now()) return toast.error("Custom date & time must be in the future");
      rule = { mode: "custom-date-time", createdAt, resumeAt: customAt.toISOString() };
    } else {
      const d = new Date();
      d.setHours(d.getHours() + Math.max(1, hours));
      rule = { mode: "specific-time", createdAt, durationHours: Math.max(1, hours), resumeAt: d.toISOString() };
    }
    const { type, categoryId, itemId } = target;
    applyLocal(type, categoryId, itemId, false, rule);
    setStockRules((p) => {
      const n = { ...p };
      targetIds(type, categoryId, itemId).forEach((id) => (n[id] = rule));
      return n;
    });
    setTarget(null);
    await updateAvailability(type, categoryId, itemId, false);
  };

  const toggleRecommend = async (categoryId, item) => {
    const next = !item.isRecommended;
    setCategories((prev) => prev.map((c) => (c.id !== categoryId ? c : { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, isRecommended: next } : i)) })));
    try {
      await restaurantAPI.updateFood(item.id, { isRecommended: next });
    } catch {}
  };

  const toggleAddon = async (a, isAvailable) => {
    try {
      await restaurantAPI.updateAddon(a.id, { isAvailable });
      setAddons((p) => p.map((x) => (x.id === a.id ? { ...x, isAvailable } : x)));
      toast.success(`Add-on ${isAvailable ? "enabled" : "disabled"} successfully`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update add-on");
    }
  };
  const toggleCombo = async (c, isAvailable) => {
    try {
      await restaurantAPI.updateCombo(c.id, { isAvailable });
      setCombos((p) => p.map((x) => (x.id === c.id ? { ...x, isAvailable } : x)));
      toast.success(`Combo ${isAvailable ? "enabled" : "paused"}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update combo");
    }
  };

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => {
        let items = c.items;
        if (filter === "in-stock") items = items.filter((i) => i.inStock);
        else if (filter === "out-of-stock") items = items.filter((i) => !i.inStock);
        else if (filter === "recommended") items = items.filter((i) => i.isRecommended);
        else if (filter === "veg") items = items.filter((i) => i.isVeg);
        else if (filter === "non-veg") items = items.filter((i) => !i.isVeg);
        if (q) items = c.name.toLowerCase().includes(q) ? items : items.filter((i) => i.name.toLowerCase().includes(q));
        return { ...c, items };
      })
      .filter((c) => c.items.length > 0 || (!q && filter === "all"));
  }, [categories, filter, query]);

  const filterList = (list) => {
    if (addonFilter === "available") return list.filter((x) => x.isAvailable !== false);
    if (addonFilter === "unavailable") return list.filter((x) => x.isAvailable === false);
    if (["approved", "pending", "rejected"].includes(addonFilter)) return list.filter((x) => String(x.approvalStatus || "approved").toLowerCase() === addonFilter);
    return list;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMenu(), loadAddonsCombos()]);
    setRefreshing(false);
  };

  const Chips = ({ options, value, onChange }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, value === o.value && styles.chipActive]}>
          <Txt weight={value === o.value ? 700 : 500} style={{ fontSize: 12, color: value === o.value ? palette.white : palette.gray700 }}>{o.label}</Txt>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderSimple = (list, onToggleFn, kind) =>
    filterList(list).length === 0 ? (
      <Txt style={styles.empty}>No {kind} found</Txt>
    ) : (
      filterList(list).map((x) => {
        const m = approvalMeta(x.approvalStatus);
        const price = Number(x.comboPrice ?? x.price) || 0;
        return (
          <View key={x.id} style={styles.itemCard}>
            <AppImage src={x.image || x.images?.[0]} style={styles.itemImg} width={160} />
            <View style={{ flex: 1 }}>
              <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{x.name}</Txt>
              <Txt style={{ fontSize: 12, color: palette.gray600 }}>₹{Math.round(price)}{x.originalPrice > price ? `  (₹${Math.round(x.originalPrice)})` : ""}</Txt>
              {kind === "combos" && Array.isArray(x.items) && x.items.length ? (
                <Txt numberOfLines={2} style={{ fontSize: 11, color: palette.gray500 }}>{x.items.map((ci) => `${ci.quantity || 1} x ${ci.name}`).join(" + ")}</Txt>
              ) : null}
              <Txt weight={700} style={[styles.approval, { backgroundColor: m.bg, color: m.fg, borderColor: m.border }]}>{m.label}</Txt>
              {String(x.approvalStatus).toLowerCase() === "rejected" && x.rejectionReason ? <Txt style={{ fontSize: 11, color: palette.red600 }}>{x.rejectionReason}</Txt> : null}
            </View>
            <Switch value={x.isAvailable !== false} onValueChange={(v) => onToggleFn(x, v)} trackColor={{ true: "#86efac", false: palette.gray300 }} thumbColor={x.isAvailable !== false ? palette.green600 : palette.white} />
          </View>
        );
      })
    );

  return (
    <View style={{ flex: 1, backgroundColor: rt.pageBg }}>
      <RestaurantHeader mode="inventory" />
      <View style={styles.segment}>
        {[
          ["menu", "Menu"],
          ["addons", "Add-ons"],
          ["combos", "Combos"],
        ].map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.segBtn, tab === k && styles.segActive]}>
            <Txt weight={tab === k ? 700 : 500} style={{ fontSize: 13, color: tab === k ? rt.primary : palette.gray600 }}>{l}</Txt>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 48 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rt.primary]} />}>
        {tab === "menu" ? (
          <>
            <Chips options={MENU_FILTERS} value={filter} onChange={setFilter} />
            {loading ? (
              <Spinner full />
            ) : visibleCategories.length === 0 ? (
              <Txt style={styles.empty}>{categories.length ? "No items match this filter" : "Your menu is empty. Add dishes from the restaurant dashboard on the website."}</Txt>
            ) : (
              visibleCategories.map((c) => {
                const open = expanded.includes(c.id);
                const outCount = c.items.filter((i) => !i.inStock).length;
                const full = categories.find((x) => x.id === c.id);
                return (
                  <View key={c.id} style={styles.catCard}>
                    <Pressable onPress={() => setExpanded((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} style={styles.catHead}>
                      <View style={{ flex: 1 }}>
                        <Txt weight={700} style={{ fontSize: 15, color: palette.gray900 }}>{c.name}</Txt>
                        <Txt style={{ fontSize: 12, color: palette.gray500 }}>{full?.items.length || 0} items{outCount ? ` • ${outCount} out of stock` : ""}</Txt>
                      </View>
                      <Switch value={Boolean(full?.inStock)} onValueChange={(v) => onToggle("category", c.id, null, v)} trackColor={{ true: "#86efac", false: palette.gray300 }} thumbColor={full?.inStock ? palette.green600 : palette.white} />
                      {open ? <ChevronUp size={18} color={palette.gray500} /> : <ChevronDown size={18} color={palette.gray500} />}
                    </Pressable>
                    {open
                      ? c.items.map((it) => {
                          const m = approvalMeta(it.approvalStatus);
                          return (
                            <View key={it.id} style={styles.itemRow}>
                              <AppImage src={it.image} style={styles.itemImg} width={160} />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <View style={[styles.vegBox, { borderColor: it.isVeg ? palette.green600 : palette.red600 }]}><View style={[styles.vegDot, { backgroundColor: it.isVeg ? palette.green600 : palette.red600 }]} /></View>
                                  <Txt weight={600} numberOfLines={2} style={{ fontSize: 13, color: palette.gray900, flex: 1 }}>{it.name}</Txt>
                                </View>
                                <Txt style={{ fontSize: 12, color: palette.gray600, marginTop: 2 }}>
                                  {it.variants.length ? `${it.variants.length} variants • from ₹${Math.min(...it.variants.map((v) => Number(v.price) || 0))}` : it.price !== "" ? `₹${it.price}` : ""}
                                </Txt>
                                {it.approvalStatus !== "approved" ? <Txt weight={700} style={[styles.approval, { backgroundColor: m.bg, color: m.fg, borderColor: m.border }]}>{m.label}</Txt> : null}
                                {it.approvalStatus === "rejected" && it.rejectionReason ? <Txt style={{ fontSize: 11, color: palette.red600 }}>{it.rejectionReason}</Txt> : null}
                                {!it.inStock && it.stockRule ? <Txt style={{ fontSize: 11, color: palette.amber600, marginTop: 2 }}>{ruleLabel(it.stockRule)}</Txt> : null}
                              </View>
                              <View style={{ alignItems: "center", gap: 6 }}>
                                <Switch value={it.inStock} onValueChange={(v) => onToggle("item", c.id, it.id, v)} trackColor={{ true: "#86efac", false: palette.gray300 }} thumbColor={it.inStock ? palette.green600 : palette.white} />
                                <Pressable onPress={() => toggleRecommend(c.id, it)} hitSlop={8}>
                                  <Star size={18} color={it.isRecommended ? "#f59e0b" : palette.gray300} fill={it.isRecommended ? "#f59e0b" : "transparent"} />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })
                      : null}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            <Chips options={ADDON_FILTERS} value={addonFilter} onChange={setAddonFilter} />
            {tab === "addons" ? renderSimple(addons, toggleAddon, "add-ons") : renderSimple(combos, toggleCombo, "combos")}
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(target)} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Txt weight={700} style={{ fontSize: 18, color: palette.gray900, flex: 1 }}>
                {target?.type === "category" ? `Turn off "${categories.find((c) => c.id === target?.categoryId)?.name || "category"}"` : "Mark item out of stock"}
              </Txt>
              <Pressable onPress={() => setTarget(null)} hitSlop={8}>
                <X size={20} color={palette.gray500} />
              </Pressable>
            </View>
            <Txt style={{ fontSize: 13, color: palette.gray500, marginBottom: 14 }}>When should it come back in stock?</Txt>
            {[
              ["specific-time", "For a specific time"],
              ["next-business-day", "Next business day"],
              ["custom-date-time", "Custom date & time"],
              ["manual", "I will turn it on myself"],
            ].map(([k, l]) => (
              <View key={k}>
                <Pressable onPress={() => setOption(k)} style={[styles.optRow, option === k && styles.optActive]}>
                  <View style={[styles.radio, option === k && { borderColor: rt.primary }]}>{option === k ? <View style={styles.radioDot} /> : null}</View>
                  <Txt weight={500} style={{ fontSize: 14, color: palette.gray800, flex: 1 }}>{l}</Txt>
                  {k === "specific-time" && option === k ? (
                    <View style={styles.stepper}>
                      <Pressable onPress={() => setHours((h) => Math.max(1, h - 1))} style={{ padding: 6 }} hitSlop={6}><Minus size={14} color={palette.gray800} /></Pressable>
                      <Txt weight={700} style={{ fontSize: 13, minWidth: 54, textAlign: "center" }}>{hours} hr{hours > 1 ? "s" : ""}</Txt>
                      <Pressable onPress={() => setHours((h) => Math.min(72, h + 1))} style={{ padding: 6 }} hitSlop={6}><Plus size={14} color={palette.gray800} /></Pressable>
                    </View>
                  ) : null}
                </Pressable>
                {k === "custom-date-time" && option === k ? (
                  <Pressable onPress={() => setPicker("date")} style={styles.customBtn}>
                    <Txt weight={600} style={{ fontSize: 13, color: rt.primary }}>{customAt ? customAt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Pick date & time"}</Txt>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Pressable onPress={confirmOff} style={styles.confirm}>
              <Txt weight={700} style={{ color: palette.white, fontSize: 15 }}>Turn off</Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {picker ? (
        <DateTimePicker
          value={customAt || new Date(Date.now() + 3600000)}
          mode={picker}
          minimumDate={new Date()}
          onChange={(e, d) => {
            const step = picker;
            setPicker(null);
            if (e.type !== "set" || !d) return;
            const base = customAt ? new Date(customAt) : new Date(Date.now() + 3600000);
            if (step === "date") {
              base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              setCustomAt(base);
              setTimeout(() => setPicker("time"), 50);
            } else {
              base.setHours(d.getHours(), d.getMinutes(), 0, 0);
              setCustomAt(base);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", marginHorizontal: 16, marginTop: 12, backgroundColor: palette.white, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: palette.gray100 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  segActive: { backgroundColor: rt.primarySoft },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.gray200 },
  chipActive: { backgroundColor: rt.primary, borderColor: rt.primary },
  empty: { textAlign: "center", paddingVertical: 32, color: palette.gray500, fontSize: 14 },
  catCard: { backgroundColor: palette.white, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.gray100, overflow: "hidden" },
  catHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: palette.gray50 },
  itemCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.white, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: palette.gray100 },
  itemImg: { width: 52, height: 52, borderRadius: 10 },
  vegBox: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  approval: { alignSelf: "flex-start", marginTop: 4, fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, overflow: "hidden" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: palette.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200, marginBottom: 8 },
  optActive: { borderColor: rt.primary, backgroundColor: rt.primarySoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: palette.gray300, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: rt.primary },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, backgroundColor: palette.white },
  customBtn: { marginTop: -2, marginBottom: 10, marginLeft: 44, paddingVertical: 8 },
  confirm: { marginTop: 8, height: 50, borderRadius: 14, backgroundColor: rt.primary, alignItems: "center", justifyContent: "center" },
});
