import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, FastForward, Clock, Phone, ChefHat, ChevronDown, Store, ExternalLink, Banknote, CreditCard } from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { getHaversineDistance } from '@/modules/DeliveryV2/utils/geo';
import { getOrderMongoId, getOrderDisplayId, isSameOrder } from '@food/utils/orderDispatchId';
import { getRestaurantDisplayInfo, getCustomerDisplayInfo, getOrderPaymentInfo } from '@/modules/DeliveryV2/utils/orderLocation';

/**
 * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
 * Matches the Zomato/Swiggy style Green Header + White Card.
 */
export const NewOrderModal = ({ order, queuedOrders = [], onSelectOrder, onAccept, onReject, onMinimize }) => {
  const { riderLocation } = useDeliveryStore();
  const [timeLeft, setTimeLeft] = useState(60);
  const orderKey = getOrderMongoId(order) || getOrderDisplayId(order);

  const restaurantInfo = useMemo(() => getRestaurantDisplayInfo(order), [order]);
  const customerInfo = useMemo(() => getCustomerDisplayInfo(order), [order]);
  const paymentInfo = useMemo(() => getOrderPaymentInfo(order), [order]);

  useEffect(() => {
    setTimeLeft(60);
  }, [orderKey]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onReject();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onReject]);

  const { pickup, drop, total } = useMemo(() => {
    const unknown = {
      pickup: { distanceKm: '??', etaMins: '??' },
      drop: { distanceKm: '??', etaMins: '??' },
      total: { distanceKm: '??', etaMins: '??' },
    };
    if (!order) return unknown;

    const etaFromMeters = (meters, extraMins = 0) =>
      Math.max(1, Math.ceil(meters / 416) + extraMins);

    const fmtKm = (km) => (km != null && Number.isFinite(km) ? km.toFixed(1) : '??');
    const fmtMins = (mins) => (mins != null && Number.isFinite(mins) ? mins : '??');

    let pickupDistKm = null;
    let pickupEta = null;
    const rawPickup = order.pickupDistanceKm ?? order.distanceKm;
    if (rawPickup != null) {
      pickupDistKm = Number(rawPickup);
      const rawEta = order.estimatedTime || order.duration || order.eta;
      pickupEta =
        rawEta && rawEta > 0 ? Math.ceil(rawEta) : etaFromMeters(pickupDistKm * 1000, 5);
    } else if (riderLocation && restaurantInfo?.coords) {
      const distM = getHaversineDistance(
        riderLocation.lat,
        riderLocation.lng,
        restaurantInfo.coords.lat,
        restaurantInfo.coords.lng,
      );
      pickupDistKm = distM / 1000;
      pickupEta = etaFromMeters(distM, order.prepTime || 5);
    }

    let dropDistKm = null;
    let dropEta = null;
    const rawDrop = order.dropDistanceKm ?? order.deliveryDistanceKm;
    if (rawDrop != null) {
      dropDistKm = Number(rawDrop);
      dropEta = order.dropEta ? Math.ceil(order.dropEta) : etaFromMeters(dropDistKm * 1000, 0);
    } else if (restaurantInfo?.coords && customerInfo?.coords) {
      const distM = getHaversineDistance(
        restaurantInfo.coords.lat,
        restaurantInfo.coords.lng,
        customerInfo.coords.lat,
        customerInfo.coords.lng,
      );
      dropDistKm = distM / 1000;
      dropEta = etaFromMeters(distM, 0);
    }

    const totalKm =
      pickupDistKm != null && dropDistKm != null ? pickupDistKm + dropDistKm : null;
    const totalEta =
      pickupEta != null && dropEta != null ? pickupEta + dropEta : null;

    return {
      pickup: { distanceKm: fmtKm(pickupDistKm), etaMins: fmtMins(pickupEta) },
      drop: { distanceKm: fmtKm(dropDistKm), etaMins: fmtMins(dropEta) },
      total: { distanceKm: fmtKm(totalKm), etaMins: fmtMins(totalEta) },
    };
  }, [order, riderLocation, restaurantInfo, customerInfo]);

  if (!order) return null;

  useEffect(() => {
    console.log('[DeliveryPopupTrace] NewOrderModal mounted', {
      popupOrderId: orderKey,
      displayId: getOrderDisplayId(order),
      queuedCount: queuedOrders.length,
    });

    return () => {
      console.log('[DeliveryPopupTrace] NewOrderModal unmounted', {
        popupOrderId: orderKey,
        displayId: getOrderDisplayId(order),
      });
    };
  }, [orderKey, order, queuedOrders.length]);

  const bonus = order.deliveryBonusAmount || 0;
  const earnings = order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0);
  const baseEarnings = Math.max(0, earnings - bonus);

  const restaurantName = restaurantInfo.name;
  const restaurantAddress = restaurantInfo.address;
  const restaurantMapsLink = restaurantInfo.mapsUrl;

  const customerName =
    customerInfo.name && customerInfo.name !== 'Customer'
      ? customerInfo.name
      : 'Customer Drop';
  const customerAddress = customerInfo.address;
  const customerMapsLink = customerInfo.mapsUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black/60 flex items-end justify-center p-0"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-1 pt-1.5 bg-white relative z-10 shrink-0">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
             <ChevronDown className="w-5 h-5 text-gray-400 stroke-3" />
          </button>
        </div>

        {/* Header Ribbon (Zomato/Swiggy style) */}
        <div 
          className="px-4 py-3 sm:px-6 sm:py-3.5 flex justify-between items-center text-white shrink-0 border-b border-white/10"
          style={{ background: 'linear-gradient(33deg, #15498b 0%, #000000 100%)' }}
        >
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Incoming Request</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                paymentInfo.isCod
                  ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40'
                  : 'bg-emerald-400/25 text-emerald-300 border border-emerald-400/40'
              }`}>
                {paymentInfo.paymentLabel}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">₹{Number(earnings || 0).toFixed(2)}</h2>
              {bonus > 0 && (
                <p className="text-white/70 text-xs font-semibold mb-0.5">
                  (₹{Number(baseEarnings).toFixed(0)} + ₹{Number(bonus).toFixed(0)} Bonus)
                </p>
              )}
            </div>
            <p className="text-white/75 text-[11px] font-semibold mt-0.5">
              Order Value: <span className="font-bold text-white">₹{paymentInfo.totalAmount.toFixed(2)}</span>
            </p>
          </div>
          <div className="bg-white/20 border border-white/30 rounded-2xl px-3 sm:px-5 py-1.5 sm:py-2 text-white font-black text-base sm:text-xl shadow-inner tabular-nums">
            {timeLeft}s
          </div>
        </div>

        {queuedOrders.length > 1 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              {queuedOrders.length} orders available — tap to switch
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {queuedOrders.map((queuedOrder, index) => {
                const queuedId = getOrderMongoId(queuedOrder) || getOrderDisplayId(queuedOrder);
                const isActive = isSameOrder(queuedOrder, order);
                const qEarnings =
                  queuedOrder.earnings ||
                  queuedOrder.riderEarning ||
                  queuedOrder.pricing?.deliveryFee ||
                  0;
                const label =
                  getOrderDisplayId(queuedOrder) ||
                  `Order ${index + 1}`;
                const qRest = getRestaurantDisplayInfo(queuedOrder);
                const qCust = getCustomerDisplayInfo(queuedOrder);
                const qPayment = getOrderPaymentInfo(queuedOrder);

                return (
                  <button
                    key={queuedId || `order-${index}`}
                    type="button"
                    onClick={() => onSelectOrder?.(queuedOrder)}
                    className={`shrink-0 rounded-2xl p-2.5 border text-left transition-all min-w-[200px] max-w-[250px] ${
                      isActive
                        ? 'bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-blue-400/40'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80 truncate">
                        {label}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="block text-xs font-black text-green-500">
                          ₹{Number(qEarnings || 0).toFixed(0)}
                        </span>
                        <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded leading-none ${
                          qPayment.isCod
                            ? (isActive ? 'bg-amber-400/30 text-amber-300' : 'bg-amber-100 text-amber-800')
                            : (isActive ? 'bg-emerald-400/30 text-emerald-300' : 'bg-emerald-100 text-emerald-800')
                        }`}>
                          {qPayment.paymentLabel} · ₹{Math.round(qPayment.totalAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <div className="flex items-center gap-1 truncate">
                        <Store className={`w-3 h-3 shrink-0 ${isActive ? 'text-green-400' : 'text-green-600'}`} />
                        <span className="truncate font-semibold text-[11px]">{qRest.name}</span>
                      </div>
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className={`w-3 h-3 shrink-0 ${isActive ? 'text-blue-400' : 'text-blue-500'}`} />
                        <span className="truncate font-medium text-[10px] opacity-90">{qCust.shortAddress || qCust.address}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Info Body */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1 mt-1 py-0.5 shrink-0">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-100 shadow-sm" />
              <div className="w-0.5 h-10 sm:h-12 border-l-2 border-dashed border-gray-200" />
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-100 shadow-sm" />
            </div>
            <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
              <div>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-green-600">
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Restaurant Pickup</span>
                  </div>
                  {restaurantMapsLink && (
                    <button
                      type="button"
                      onClick={() => onMinimize?.()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-600 hover:text-green-700 active:scale-95 transition-transform"
                      title="View on Map"
                    >
                      <span>Map</span>
                      <MapPin className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-gray-950 font-bold text-sm sm:text-base leading-tight truncate">{restaurantName}</p>
                <p className="text-gray-500 text-xs font-medium leading-normal line-clamp-2 mt-0.5">{restaurantAddress}</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-blue-600">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Customer Drop</span>
                  </div>
                  {customerMapsLink && (
                    <button
                      type="button"
                      onClick={() => onMinimize?.()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
                      title="View on Map"
                    >
                      <span>Map</span>
                      <MapPin className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-gray-950 font-bold text-sm sm:text-base leading-tight truncate">{customerName}</p>
                <p className="text-gray-500 text-xs font-medium leading-normal line-clamp-2 mt-0.5">{customerAddress}</p>
              </div>
            </div>
          </div>

          {/* Order Bill & Payment Mode Card */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
            paymentInfo.isCod
              ? 'bg-amber-50/90 border-amber-200'
              : 'bg-emerald-50/90 border-emerald-200'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                paymentInfo.isCod ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {paymentInfo.isCod ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    paymentInfo.isCod ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {paymentInfo.paymentLabel}
                  </span>
                  <span className="text-[11px] font-bold text-gray-900 truncate">
                    {paymentInfo.paymentStatusText}
                  </span>
                </div>
                <p className={`text-[10px] font-semibold mt-0.5 truncate ${
                  paymentInfo.isCod ? 'text-amber-800' : 'text-emerald-800'
                }`}>
                  {paymentInfo.collectionNotice}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Order Bill</span>
              <span className="text-sm sm:text-base font-black text-gray-950">
                ₹{paymentInfo.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 4 Stats Chips */}
          <div className="grid grid-cols-2 gap-2">
             <div className="p-2.5 bg-green-50/80 rounded-xl border border-green-100 flex items-center gap-2">
               <MapPin className="w-4 h-4 text-green-600 shrink-0" />
               <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-green-700/80 font-bold uppercase tracking-wider truncate">To Restaurant</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{pickup.distanceKm} KM</span>
               </div>
             </div>
             <div className="p-2.5 bg-green-50/80 rounded-xl border border-green-100 flex items-center gap-2">
               <Clock className="w-4 h-4 text-green-600 shrink-0" />
               <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-green-700/80 font-bold uppercase tracking-wider truncate">Pickup Time</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{pickup.etaMins} MINS</span>
               </div>
             </div>
             <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-100 flex items-center gap-2">
               <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
               <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-blue-700/80 font-bold uppercase tracking-wider truncate">To Customer</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{drop.distanceKm} KM</span>
               </div>
             </div>
             <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-100 flex items-center gap-2">
               <Clock className="w-4 h-4 text-blue-600 shrink-0" />
               <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-blue-700/80 font-bold uppercase tracking-wider truncate">Drop Time</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{drop.etaMins} MINS</span>
               </div>
             </div>
          </div>

          {total.distanceKm !== '??' && (
            <p className="text-center text-[10px] sm:text-[11px] font-semibold text-gray-500 pt-0.5">
              Total trip ~ {total.distanceKm} KM · ~ {total.etaMins} MINS
            </p>
          )}
        </div>

        {/* Pinned Action Area */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-3 sm:pb-4 space-y-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
          <ActionSlider 
            key={orderKey}
            label="Slide to Accept" 
            onConfirm={() => onAccept(order)} 
            color="bg-black"
            successLabel="Order Accepted ✓"
          />

          <div className="flex justify-between items-center px-4 pt-1">
            <button 
              onClick={onMinimize}
              className="text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors active:scale-95 py-1"
            >
              Cancel
            </button>
            <button 
              onClick={onReject}
              className="text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors active:scale-95 py-1"
            >
              Pass this task
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
