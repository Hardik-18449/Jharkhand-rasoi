/**
 * Port of components/user/DeliveryTrackingMap.jsx → react-native-maps.
 * - Rider location from shared user socket (`location-update`), smoothed between pushes.
 * - Route: rider-pushed encoded polyline, else Google Directions (REST, same key as web JS DirectionsService).
 * - Traveled part dashed grey, remaining part green (pickup leg) / blue (delivery leg).
 * - Off-route (>120 m) → recompute from rider position, at most every 15 s.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Path, Circle } from "react-native-svg";
import { Navigation } from "lucide-react-native";
import Txt from "./ui/Txt";
import AppImage from "./ui/AppImage";
import { useOrderLocationSubscription } from "../hooks/useOrderLocationSubscription";
import { subscribeLocationUpdates } from "../utils/userSocketManager";
import { GOOGLE_MAPS_API_KEY } from "../config";
import { localImages } from "../constants/images";
import { palette } from "../theme";

const OFF_ROUTE_THRESHOLD_M = 120;
const LIVE_ROUTE_RECALC_MS = 15000;

const toRad = (d) => (d * Math.PI) / 180;
function haversineM(a, b) {
  const R = 6371e3;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
const normEncoded = (v) => (!v ? "" : typeof v === "string" ? v : v.points || v.encodedPath || "");
function closestIdx(path, p) {
  let min = Infinity;
  let idx = 0;
  path.forEach((pt, i) => {
    const d = haversineM(pt, p);
    if (d < min) {
      min = d;
      idx = i;
    }
  });
  return { idx, dist: min };
}
function calcHeading(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function headingFromPath(path, p) {
  if (!path || path.length < 2 || !p) return null;
  const { idx } = closestIdx(path, p);
  const a = idx < path.length - 1 ? path[idx] : path[idx - 1];
  const b = idx < path.length - 1 ? path[idx + 1] : path[idx];
  return a && b ? calcHeading(a, b) : null;
}
function resolveHeading(raw, prev, lat, lng, path) {
  const n = Number(raw);
  let head = Number.isFinite(n) && n !== 0 ? n : null;
  if (head === null && prev && Number.isFinite(prev.lat)) {
    if (haversineM(prev, { lat, lng }) > 1.5) head = calcHeading(prev, { lat, lng });
    else if (Number.isFinite(prev.heading) && prev.heading !== 0) head = prev.heading;
  }
  if ((head === null || head === 0) && path?.length > 1) {
    const ph = headingFromPath(path, { lat, lng });
    if (Number.isFinite(ph)) head = ph;
  }
  return head ?? prev?.heading ?? 0;
}
async function fetchDirections(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK") return null;
    const route = json.routes?.[0];
    return { path: decodePolyline(route?.overview_polyline?.points || ""), duration: route?.legs?.[0]?.duration?.text || null };
  } catch {
    return null;
  }
}
const toLatLng = (p) => ({ latitude: p.lat, longitude: p.lng });

function PinSvg({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path fill={color} d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7z" />
      <Circle cx={12} cy={9} r={3} fill="#FFFFFF" />
    </Svg>
  );
}
function PinMarker({ coord, color, image, pulse }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 1500);
    return () => clearTimeout(t);
  }, [image, pulse]);
  return (
    <Marker coordinate={toLatLng(coord)} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracks}>
      <View style={{ alignItems: "center" }}>
        <View style={[styles.pin, { borderColor: color }, pulse && { borderWidth: 3 }]}>
          {image ? <AppImage src={image} style={{ width: "100%", height: "100%", borderRadius: 20 }} width={100} /> : <PinSvg color={color} />}
        </View>
        <View style={[styles.pinTip, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

export default function DeliveryTrackingMap({ orderId, orderTrackingIds = [], restaurantCoords, customerCoords, order = null, onEtaUpdate = null }) {
  const mapRef = useRef(null);
  const [riderLocation, setRiderLocation] = useState(null);
  const [smoothLocation, setSmoothLocation] = useState(null);
  const [currentEta, setCurrentEta] = useState(null);
  const [fullRoutePath, setFullRoutePath] = useState(null);
  const pathRef = useRef(null);
  const interpRef = useRef({ lastPos: null, nextPos: null, startTime: 0, durationMs: 1500 });
  const lastUpdateAtRef = useRef(0);
  const lastEncodedRef = useRef("");
  const lastLiveRouteAtRef = useRef(0);
  const baselineDoneRef = useRef(false);
  const lastCameraRef = useRef({ time: 0, status: null });
  useEffect(() => {
    pathRef.current = fullRoutePath;
  }, [fullRoutePath]);

  const trackingIds = useMemo(() => [...new Set([orderId, ...(orderTrackingIds || [])].map((id) => String(id || "").trim()).filter(Boolean))], [orderId, orderTrackingIds]);
  useOrderLocationSubscription(trackingIds, { enabled: trackingIds.length > 0 });

  const tripStatus = String(order?.status || order?.orderStatus || "pending").toLowerCase();
  const isOrderPickedUp = ["picked_up", "out_for_delivery", "delivered"].includes(tripStatus);
  const routeDestination = isOrderPickedUp ? customerCoords : restaurantCoords;

  // initial rider position from order payload
  useEffect(() => {
    const loc = order?.deliveryState?.currentLocation;
    if (!loc || riderLocation) return;
    const lat = typeof loc.lat === "number" ? loc.lat : Array.isArray(loc.coordinates) ? Number(loc.coordinates[1]) : null;
    const lng = typeof loc.lng === "number" ? loc.lng : Array.isArray(loc.coordinates) ? Number(loc.coordinates[0]) : null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const p = { lat, lng, heading: resolveHeading(loc.bearing || loc.heading, null, lat, lng, pathRef.current) };
      interpRef.current = { lastPos: p, nextPos: p, startTime: Date.now(), durationMs: 600 };
      setRiderLocation(p);
    }
  }, [order, riderLocation]);

  // live socket location
  useEffect(() => {
    if (!trackingIds.length) return undefined;
    return subscribeLocationUpdates((data) => {
      const dataOrderId = data?.orderId || data?.order_id || data?.trackingId || data?.order?.id || data?.order?._id;
      const matched = dataOrderId ? trackingIds.find((id) => String(id) === String(dataOrderId)) : trackingIds.length === 1 ? trackingIds[0] : null;
      const lat = Number(data?.lat ?? data?.boy_lat ?? data?.location?.lat ?? data?.location?.coordinates?.[1]);
      const lng = Number(data?.lng ?? data?.boy_lng ?? data?.location?.lng ?? data?.location?.coordinates?.[0]);
      if (!data || !matched || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const prev = interpRef.current?.nextPos;
      const nextPos = { lat, lng, heading: resolveHeading(data?.heading ?? data?.bearing ?? data?.location?.heading, prev, lat, lng, pathRef.current) };
      const now = Date.now();
      const delta = Math.max(300, Math.min(now - (lastUpdateAtRef.current || now), 4000));
      lastUpdateAtRef.current = now;
      interpRef.current = { lastPos: interpRef.current.nextPos || nextPos, nextPos, startTime: now, durationMs: delta };
      setRiderLocation(nextPos);
      const enc = normEncoded(data?.polyline);
      if (enc && enc !== lastEncodedRef.current) {
        lastEncodedRef.current = enc;
        const pts = decodePolyline(enc);
        if (pts.length > 1) setFullRoutePath(pts);
      }
      if (data?.eta) {
        setCurrentEta(data.eta);
        onEtaUpdate?.(data.eta);
      }
    });
  }, [trackingIds, onEtaUpdate]);

  // smooth glide (~30 fps)
  useEffect(() => {
    const id = setInterval(() => {
      const { lastPos, nextPos, startTime, durationMs } = interpRef.current;
      if (!lastPos || !nextPos) return;
      const raw = Math.min((Date.now() - startTime) / Math.max(600, durationMs || 1500), 1);
      if (raw >= 1 && smoothLocation && smoothLocation.lat === nextPos.lat && smoothLocation.lng === nextPos.lng) return;
      const pr = raw * raw * (3 - 2 * raw);
      let lh = lastPos.heading || 0;
      let nh = nextPos.heading || 0;
      if (Math.abs(nh - lh) > 180) {
        if (nh > lh) lh += 360;
        else nh += 360;
      }
      setSmoothLocation({ lat: lastPos.lat + (nextPos.lat - lastPos.lat) * pr, lng: lastPos.lng + (nextPos.lng - lastPos.lng) * pr, heading: (lh + (nh - lh) * pr) % 360 });
    }, 33);
    return () => clearInterval(id);
  }, [smoothLocation]);

  // reset when leg changes
  useEffect(() => {
    baselineDoneRef.current = false;
    lastEncodedRef.current = "";
    lastLiveRouteAtRef.current = 0;
    setFullRoutePath(null);
  }, [orderId, isOrderPickedUp]);

  // baseline route restaurant → customer
  useEffect(() => {
    if (fullRoutePath?.length || baselineDoneRef.current || !restaurantCoords || !customerCoords) return;
    baselineDoneRef.current = true;
    fetchDirections(restaurantCoords, customerCoords).then((r) => {
      if (r?.path?.length > 1) setFullRoutePath((p) => p || r.path);
      if (r?.duration && !currentEta) {
        setCurrentEta(r.duration);
        onEtaUpdate?.(r.duration);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantCoords?.lat, restaurantCoords?.lng, customerCoords?.lat, customerCoords?.lng, fullRoutePath?.length]);

  const display = smoothLocation || riderLocation;

  // off-route recompute
  useEffect(() => {
    if (!fullRoutePath?.length || !display || !routeDestination) return;
    if (closestIdx(fullRoutePath, display).dist <= OFF_ROUTE_THRESHOLD_M) return;
    const now = Date.now();
    if (now - lastLiveRouteAtRef.current < LIVE_ROUTE_RECALC_MS) return;
    lastLiveRouteAtRef.current = now;
    fetchDirections({ lat: display.lat, lng: display.lng }, routeDestination).then((r) => {
      if (r?.path?.length > 1) setFullRoutePath(r.path);
      if (r?.duration) {
        setCurrentEta(r.duration);
        onEtaUpdate?.(r.duration);
      }
    });
  }, [fullRoutePath, display, routeDestination, onEtaUpdate]);

  // camera fit
  useEffect(() => {
    if (!mapRef.current || !restaurantCoords || !customerCoords) return;
    const now = Date.now();
    const statusChanged = lastCameraRef.current.status !== isOrderPickedUp;
    if (!statusChanged && now - lastCameraRef.current.time < 15000) return;
    lastCameraRef.current = { time: now, status: isOrderPickedUp };
    const pts = [restaurantCoords, customerCoords, riderLocation].filter(Boolean).map(toLatLng);
    setTimeout(() => mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 100, bottom: 120, left: 60, right: 60 }, animated: true }), 300);
  }, [riderLocation, restaurantCoords, customerCoords, isOrderPickedUp]);

  const { traveledPath, remainingPath } = useMemo(() => {
    if (!fullRoutePath || fullRoutePath.length < 2) return { traveledPath: [], remainingPath: [] };
    if (!display) return { traveledPath: [], remainingPath: fullRoutePath };
    const { idx } = closestIdx(fullRoutePath, display);
    return { traveledPath: [...fullRoutePath.slice(0, idx + 1), display], remainingPath: [display, ...fullRoutePath.slice(idx + 1)] };
  }, [fullRoutePath, display]);

  const center = (isOrderPickedUp ? customerCoords : restaurantCoords) || { lat: 0, lng: 0 };
  const onMapReady = useCallback(() => {
    lastCameraRef.current = { time: 0, status: null };
  }, []);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        showsCompass={false}
        rotateEnabled={false}
        onMapReady={onMapReady}
      >
        {traveledPath.length > 1 ? <Polyline coordinates={traveledPath.map(toLatLng)} strokeColor="#9ca3af" strokeWidth={5} lineDashPattern={[8, 10]} zIndex={6} /> : null}
        {remainingPath.length > 1 ? <Polyline coordinates={remainingPath.map(toLatLng)} strokeColor={isOrderPickedUp ? "#3b82f6" : "#22c55e"} strokeWidth={6} zIndex={8} /> : null}
        {restaurantCoords ? <PinMarker coord={restaurantCoords} color={palette.yellow} image={order?.restaurantLogo || order?.restaurantId?.logo || order?.restaurantId?.profileImage} pulse={!isOrderPickedUp} /> : null}
        {customerCoords ? <PinMarker coord={customerCoords} color={palette.green500} image={order?.customerImage || order?.userId?.profileImage || order?.userId?.avatar} pulse={isOrderPickedUp} /> : null}
        {display ? (
          <Marker coordinate={toLatLng(display)} anchor={{ x: 0.5, y: 0.5 }} flat rotation={display.heading || 0} image={localImages.mapRider} zIndex={20} tracksViewChanges={false} />
        ) : null}
      </MapView>
      {riderLocation && currentEta ? (
        <View pointerEvents="none" style={styles.eta}>
          <Txt weight={900} style={{ fontSize: 9, color: "rgba(0,0,0,0.7)", letterSpacing: 2, marginBottom: 2 }}>ARRIVAL</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt weight={900} style={{ fontSize: 20, color: palette.black, lineHeight: 22 }}>{currentEta}</Txt>
            <Navigation size={12} color={palette.black} style={{ transform: [{ rotate: "45deg" }] }} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", height: 300, overflow: "hidden", backgroundColor: palette.gray100 },
  pin: { width: 44, height: 44, borderRadius: 22, padding: 3, backgroundColor: palette.white, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 6 },
  pinTip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent", marginTop: -1 },
  eta: { position: "absolute", top: 16, left: 16, minWidth: 90, padding: 12, borderRadius: 16, backgroundColor: "rgba(254,198,0,0.95)", borderWidth: 1, borderColor: "rgba(251,191,36,0.5)", elevation: 8 },
});
