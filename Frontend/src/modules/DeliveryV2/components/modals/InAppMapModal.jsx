import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Store, Navigation2, ExternalLink } from 'lucide-react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { getGoogleMapsApiKeySync } from '@/modules/Food/utils/googleMapsApiKey';

const LIBRARIES = ['places', 'geometry'];
const FALLBACK_KEY = 'AIzaSyDzBYks_EAI7-2tjQZgHShSqSS5FVESYt4';

const mapContainerStyle = {
  width: '100%',
  height: '280px',
  borderRadius: '16px',
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  ],
};

export default function InAppMapModal({
  isOpen,
  onClose,
  title,
  type = 'pickup', // 'pickup' | 'drop'
  address,
  coords,
  order,
  onOpenLiveRoute,
}) {
  const apiKey = useMemo(() => getGoogleMapsApiKeySync() || FALLBACK_KEY, []);

  const { isLoaded } = useJsApiLoader({
    id: 'delivery-live-map',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  if (!isOpen) return null;

  const validCoords =
    coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
      ? { lat: Number(coords.lat), lng: Number(coords.lng) }
      : { lat: 23.3441, lng: 85.3096 }; // Ranchi default fallback

  const isPickup = type === 'pickup';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-xl ${
                  isPickup
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {isPickup ? <Store className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {isPickup ? 'Pickup Location' : 'Customer Drop Location'}
                </p>
                <h3 className="text-sm font-black text-gray-900 truncate max-w-[240px]">
                  {title || (isPickup ? 'Restaurant' : 'Customer')}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive In-App Google Map */}
          <div className="mt-3.5 relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-inner">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={validCoords}
                zoom={15}
                options={mapOptions}
              >
                <Marker
                  position={validCoords}
                  title={title}
                  icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    fillColor: isPickup ? '#F25A05' : '#2563EB',
                    fillOpacity: 1,
                    strokeWeight: 1.5,
                    strokeColor: '#FFFFFF',
                    scale: 1.8,
                    anchor: typeof window !== 'undefined' && window.google?.maps?.Point ? new window.google.maps.Point(12, 22) : undefined,
                  }}
                />
              </GoogleMap>
            ) : (
              <div className="h-[280px] w-full flex items-center justify-center text-xs text-gray-500 font-medium">
                Loading in-app map...
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-gray-700 shadow-xs border border-gray-200">
              In-App Live Map
            </div>
          </div>

          {/* Address Details */}
          <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
            <p className="font-bold text-gray-900">{title}</p>
            <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
              {address || 'Coordinates provided'}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {onOpenLiveRoute && order && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLiveRoute(order);
                }}
                className="flex-1 py-3 px-4 rounded-xl text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--primary, #F25A05)' }}
              >
                <Navigation2 className="w-3.5 h-3.5" />
                <span>Navigate on LiveMap</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`py-3 px-4 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all ${
                onOpenLiveRoute && order ? 'w-auto' : 'w-full bg-gray-950 text-white border-transparent'
              }`}
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
