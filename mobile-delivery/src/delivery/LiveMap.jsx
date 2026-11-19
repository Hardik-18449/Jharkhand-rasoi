/**
 * Port of DeliveryV2/components/map/LiveMap.jsx on react-native-maps (Google provider):
 * rider marker (heading), restaurant / customer markers, road route to the current target via Directions API
 * (refreshed when the rider moves > 60 m or the target changes; straight line fallback), follow-rider camera.
 * onPolylineReceived(encoded) lets the home screen forward the route to the customer tracking map.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Bike, Store, MapPin } from "lucide-react-native";
import { ANDROID_CERT_SHA1, ANDROID_PACKAGE, GOOGLE_MAPS_API_KEY } from "../config";
import { useDeliveryStore } from "./store";
import { getHaversineDistance, parseLatLng } from "./orderUtils";
import { palette } from "../theme";

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
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const LiveMap = forwardRef(function LiveMap({ onPolylineReceived, onMapPress }, ref) {
  const mapRef = useRef(null);
  const riderLocation = useDeliveryStore((s) => s.riderLocation);
  const activeOrder = useDeliveryStore((s) => s.activeOrder);
  const tripStatus = useDeliveryStore((s) => s.tripStatus);
  const [route, setRoute] = useState([]);
  const [follow, setFollow] = useState(true);
  const lastRouteFrom = useRef(null);
  const lastTargetKey = useRef("");

  const restaurant = useMemo(() => parseLatLng(activeOrder?.restaurantLocation) || parseLatLng(activeOrder?.restaurantId?.location), [activeOrder]);
  const customer = useMemo(() => parseLatLng(activeOrder?.customerLocation) || parseLatLng(activeOrder?.deliveryAddress?.location) || parseLatLng(activeOrder?.deliveryAddress), [activeOrder]);
  const target = ["PICKED_UP", "REACHED_DROP"].includes(tripStatus) ? customer : ["PICKING_UP", "REACHED_PICKUP"].includes(tripStatus) ? restaurant : null;

  useImperativeHandle(ref, () => ({
    recenter: () => {
      setFollow(true);
      if (riderLocation) mapRef.current?.animateCamera({ center: { latitude: riderLocation.lat, longitude: riderLocation.lng }, zoom: 16 }, { duration: 400 });
    },
    focus: (p) => p && mapRef.current?.animateCamera({ center: { latitude: p.lat, longitude: p.lng }, zoom: 16 }, { duration: 400 }),
    zoomBy: async (d) => {
      const cam = await mapRef.current?.getCamera();
      if (cam) mapRef.current?.animateCamera({ zoom: Math.max(8, Math.min(20, (cam.zoom || 15) + d)) }, { duration: 200 });
    },
  }));

  // follow rider
  useEffect(() => {
    if (follow && riderLocation) mapRef.current?.animateCamera({ center: { latitude: riderLocation.lat, longitude: riderLocation.lng } }, { duration: 500 });
  }, [riderLocation, follow]);

  // route
  useEffect(() => {
    if (!riderLocation || !target) {
      setRoute([]);
      return;
    }
    const targetKey = `${target.lat},${target.lng}`;
    const moved = lastRouteFrom.current ? getHaversineDistance(lastRouteFrom.current.lat, lastRouteFrom.current.lng, riderLocation.lat, riderLocation.lng) : Infinity;
    if (targetKey === lastTargetKey.current && moved < 60) return;
    lastTargetKey.current = targetKey;
    lastRouteFrom.current = { lat: riderLocation.lat, lng: riderLocation.lng };
    const straight = [
      { latitude: riderLocation.lat, longitude: riderLocation.lng },
      { latitude: target.lat, longitude: target.lng },
    ];
    if (!GOOGLE_MAPS_API_KEY) {
      setRoute(straight);
      return;
    }
    let cancelled = false;
    // Routes API (enabled on the key; legacy Directions API is not). X-Android-* headers let an Android-app-restricted key work.
    fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
        "X-Android-Package": ANDROID_PACKAGE,
        ...(ANDROID_CERT_SHA1 ? { "X-Android-Cert": ANDROID_CERT_SHA1 } : {}),
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: riderLocation.lat, longitude: riderLocation.lng } } },
        destination: { location: { latLng: { latitude: target.lat, longitude: target.lng } } },
        travelMode: "DRIVE",
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const enc = j?.routes?.[0]?.polyline?.encodedPolyline;
        if (enc) {
          setRoute(decodePolyline(enc));
          onPolylineReceived?.(enc);
        } else setRoute(straight);
      })
      .catch(() => !cancelled && setRoute(straight));
    return () => {
      cancelled = true;
    };
  }, [riderLocation, target, onPolylineReceived]);

  const initial = riderLocation || restaurant || { lat: 23.3441, lng: 85.3096 };
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        userInterfaceStyle="light"
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: initial.lat, longitude: initial.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsCompass={false}
        toolbarEnabled={false}
        showsMyLocationButton={false}
        onPanDrag={() => setFollow(false)}
        onPress={onMapPress}
      >
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#2563EB" strokeWidth={5} /> : null}
        {restaurant ? (
          <Marker coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={[styles.pin, { backgroundColor: "#ea580c" }]}>
              <Store size={16} color={palette.white} />
            </View>
          </Marker>
        ) : null}
        {customer ? (
          <Marker coordinate={{ latitude: customer.lat, longitude: customer.lng }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={[styles.pin, { backgroundColor: "#16a34a" }]}>
              <MapPin size={16} color={palette.white} />
            </View>
          </Marker>
        ) : null}
        {riderLocation ? (
          <Marker coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={riderLocation.heading || 0} tracksViewChanges={false}>
            <View style={styles.rider}>
              <Bike size={18} color={palette.white} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
});

export default LiveMap;

const styles = StyleSheet.create({
  pin: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: palette.white, elevation: 4 },
  rider: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: palette.white, elevation: 6 },
});
