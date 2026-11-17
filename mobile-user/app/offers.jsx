/** Port of pages/user/Offers.jsx (banner SVG drawn natively). */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Rect, Circle, Text as SvgText } from "react-native-svg";
import { ArrowLeft, Star, Clock } from "lucide-react-native";
import Txt from "../src/components/ui/Txt";
import Screen from "../src/components/ui/Screen";
import Skeleton from "../src/components/ui/Skeleton";
import AppImage from "../src/components/ui/AppImage";
import Button from "../src/components/ui/Button";
import { restaurantAPI } from "../src/api";
import { toast } from "../src/utils/toast";
import { palette } from "../src/theme";

function OfferBanner() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
      <Rect width={1200} height={400} rx={32} fill="#FF4C4C" />
      <SvgText x={600} y={195} textAnchor="middle" fontSize={72} fontWeight="bold" fill="#fff">Great Offers</SvgText>
      <SvgText x={600} y={252} textAnchor="middle" fontSize={32} fill="#fff">Save big on your next meal!</SvgText>
      <Circle cx={1100} cy={80} r={60} fill="#fff" fillOpacity={0.15} />
      <Circle cx={100} cy={320} r={40} fill="#fff" fillOpacity={0.1} />
      <Rect x={900} y={250} width={180} height={80} rx={24} fill="#fff" fillOpacity={0.18} />
    </Svg>
  );
}

export default function OffersScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await restaurantAPI.getPublicOffers();
        const d = r?.data?.data;
        if (d) {
          setOffers(d.allOffers || []);
          setGrouped(d.groupedByOffer || {});
        }
      } catch (e) {
        const m = e?.response?.data?.message || e?.message || "Failed to load offers";
        setError(m);
        toast.error(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  return (
    <Screen bg={palette.white} edges={[]} padTop={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: 220, overflow: "hidden" }}>
          <OfferBanner />
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back}><ArrowLeft size={20} color={palette.white} /></Pressable>
        </View>
        <View style={{ padding: 16, paddingVertical: 24, gap: 24 }}>
          {loading ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.cell}>
                  <Skeleton height={128} radius={12} />
                  <Skeleton height={12} width="70%" style={{ marginTop: 8 }} />
                  <Skeleton height={10} width="50%" style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <Txt weight={400} style={{ color: palette.red500, textAlign: "center" }}>{error}</Txt>
              <Button title="Retry" rounded="md" onPress={() => setReloadKey((k) => k + 1)} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <>
              {Object.entries(grouped).map(([text, dishes]) => (
                <View key={text}>
                  <Txt weight={900} style={{ fontSize: 24, color: palette.red500, textAlign: "center", marginBottom: 16, letterSpacing: 0.5 }}>{text}</Txt>
                  <View style={styles.grid}>
                    {(dishes || []).slice(0, 8).map((d) => (
                      <Pressable key={d.id} onPress={() => router.push(`/restaurants/${d.restaurantSlug}`)} style={styles.cell}>
                        <View style={{ height: 128, borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                          <AppImage src={d.dishImage || d.restaurantImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"} style={StyleSheet.absoluteFill} width={400} />
                          <View style={styles.offerBadge}><Txt weight={600} style={{ fontSize: 10, color: palette.white }}>{d.offer}</Txt></View>
                        </View>
                        <View style={styles.rating}>
                          <Txt weight={700} style={{ fontSize: 12, color: palette.white }}>{d.restaurantRating?.toFixed?.(1) || "0.0"}</Txt>
                          <Star size={10} color={palette.white} fill={palette.white} />
                        </View>
                        <Txt weight={600} numberOfLines={1} style={{ fontSize: 14, color: palette.gray900 }}>{d.restaurantName}</Txt>
                        <Txt weight={400} numberOfLines={1} style={{ fontSize: 12, color: palette.gray600, marginBottom: 4 }}>{d.dishName} - ₹{d.discountedPrice}</Txt>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Clock size={12} color={palette.gray500} />
                          <Txt weight={400} style={{ fontSize: 12, color: palette.gray500 }}>{d.deliveryTime}</Txt>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {Object.keys(grouped).length === 0 && offers.length > 0 ? (
                <View style={{ gap: 16 }}>
                  <Txt weight={700} style={{ fontSize: 20, color: palette.gray900 }}>Available Coupons</Txt>
                  {offers.map((o) => (
                    <View key={o.id || o.offerId} style={styles.coupon}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <View>
                          <Txt weight={400} style={{ fontSize: 12, color: palette.slate500 }}>Coupon</Txt>
                          <Txt weight={800} style={{ fontSize: 18, color: "#0f172a", letterSpacing: 0.5 }}>{o.couponCode || "-"}</Txt>
                        </View>
                        <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: palette.blue600 }}>
                          <Txt weight={600} style={{ fontSize: 12, color: palette.white }}>{o.title || "Offer"}</Txt>
                        </View>
                      </View>
                      <Txt weight={400} style={{ fontSize: 14, color: "#334155", marginTop: 8 }}>
                        <Txt weight={600} style={{ fontSize: 14 }}>Restaurant:</Txt> {o.restaurantName || "All Restaurants"}
                      </Txt>
                      {o.endDate ? <Txt weight={400} style={{ fontSize: 12, color: palette.slate500, marginTop: 8 }}>Valid till: {new Date(o.endDate).toLocaleDateString()}</Txt> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {offers.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <Txt weight={400} style={{ color: palette.gray500 }}>No offers available at the moment</Txt>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(31,41,55,0.6)", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cell: { width: "47%" },
  offerBadge: { position: "absolute", top: 8, left: 8, backgroundColor: palette.blue600, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  rating: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: palette.green600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  coupon: { borderWidth: 1, borderColor: palette.slate200, borderRadius: 12, padding: 16, backgroundColor: palette.white, elevation: 1 },
});
