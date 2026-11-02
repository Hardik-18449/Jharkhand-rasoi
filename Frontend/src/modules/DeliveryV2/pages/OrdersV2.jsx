import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Store,
  X,
  ExternalLink,
  Banknote,
  CreditCard,
  RefreshCw,
  CheckCheck,
  Calendar,
  ChevronRight,
  Info,
  Phone,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrderAcceptId, getOrderMongoId } from '@food/utils/orderDispatchId';
import {
  getRestaurantDisplayInfo,
  getCustomerDisplayInfo,
  getOrderPaymentInfo
} from '@/modules/DeliveryV2/utils/orderLocation';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

const money = (value) => `₹${Number(value || 0).toFixed(0)}`;

const displayOrderId = (order) =>
  order?.order_id || order?.orderId || order?.displayOrderId || getOrderAcceptId(order) || 'Order';

function formatDeliveredTime(order) {
  const dateVal =
    order?.deliveredAt ||
    order?.deliveryState?.deliveredAt ||
    order?.completedAt ||
    order?.updatedAt ||
    order?.createdAt;
  if (!dateVal) return 'Recently delivered';

  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'Recently delivered';

  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
}

function extractItemsSummary(order) {
  const items = order?.items || order?.orderItems || [];
  if (!Array.isArray(items) || items.length === 0) return null;
  return items
    .map((it) => {
      const q = it.quantity || it.qty || 1;
      const n = it.name || it.title || it.foodName || 'Item';
      return `${q}x ${n}`;
    })
    .join(', ');
}

function OrderInfo({ order }) {
  const amount =
    order?.earnings ||
    order?.riderEarning ||
    order?.deliveryEarning ||
    order?.deliveryFee ||
    order?.pricing?.deliveryFee ||
    order?.pricing?.total;
  const restaurantInfo = getRestaurantDisplayInfo(order);
  const customerInfo = getCustomerDisplayInfo(order);
  const paymentInfo = getOrderPaymentInfo(order);
  const distanceKm =
    order?.pickupDistanceKm ??
    order?.distanceKm ??
    order?.dropDistanceKm ??
    order?.deliveryDistanceKm;
  const itemsSummary = extractItemsSummary(order);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{displayOrderId(order)}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
              paymentInfo.isCod
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              {paymentInfo.paymentLabel}
            </span>
            {distanceKm != null && Number.isFinite(Number(distanceKm)) && (
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                {Number(distanceKm).toFixed(1)} km
              </span>
            )}
          </div>
          <h3 className="mt-0.5 text-base font-black text-gray-950">{restaurantInfo.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-block rounded-xl bg-green-50 border border-green-100 px-3 py-1.5 text-sm font-black text-green-700">
            {money(amount)}
          </span>
          <span className="block text-[10px] font-semibold text-gray-400 mt-0.5">Rider Pay</span>
        </div>
      </div>

      {itemsSummary && (
        <p className="mt-2 text-xs text-gray-600 line-clamp-1 bg-gray-50/90 border border-gray-100/80 rounded-lg px-2.5 py-1">
          <span className="font-bold text-gray-700">Items: </span>
          {itemsSummary}
        </p>
      )}

      <div className="mt-3 space-y-2.5 rounded-xl bg-gray-50/80 p-3 text-xs border border-gray-100">
        {/* Restaurant Pickup */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Store className="h-3 w-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Pickup Location</span>
              {restaurantInfo.mapsUrl && (
                <a
                  href={restaurantInfo.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
                >
                  <span>Map</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-gray-800 truncate">{restaurantInfo.name}</p>
            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{restaurantInfo.address}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-200 ml-7" />

        {/* Customer Drop */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <MapPin className="h-3 w-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Customer Drop</span>
              {customerInfo.mapsUrl && (
                <a
                  href={customerInfo.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
                >
                  <span>Map</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-gray-800 truncate">{customerInfo.name}</p>
            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{customerInfo.address}</p>
          </div>
        </div>
      </div>

      {/* Order Bill & Payment Status Strip */}
      <div className={`mt-2.5 flex items-center justify-between rounded-xl px-3 py-2 text-xs border ${
        paymentInfo.isCod
          ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
          : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {paymentInfo.isCod ? <Banknote className="h-4 w-4 shrink-0 text-amber-600" /> : <CreditCard className="h-4 w-4 shrink-0 text-emerald-600" />}
          <div className="min-w-0">
            <span className="font-bold block truncate">
              {paymentInfo.isCod ? `Cash to Collect: ₹${paymentInfo.totalAmount.toFixed(2)}` : 'Pre-paid Online (Collect ₹0)'}
            </span>
            <span className="text-[10px] opacity-80 block truncate">
              {paymentInfo.collectionNotice}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Bill</span>
          <span className="font-black text-gray-950 text-sm">
            ₹{paymentInfo.totalAmount.toFixed(2)}
          </span>
        </div>
      </div>
    </>
  );
}

export default function OrdersV2({
  incomingOrders = [],
  acceptedOrders = [],
  capacity = {},
  onAccept,
  onPass,
  onOpen,
  onMarkDelivered
}) {
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [loadingDelivered, setLoadingDelivered] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'delivered'
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const limit = Number(capacity.effectiveLimit || 1);
  const activeCount = Number(capacity.activeOrderCount ?? acceptedOrders.length);
  const canAccept = capacity.canAcceptMore !== false && activeCount < limit;

  // Fetch Delivered Orders
  const fetchDeliveredOrders = useCallback(async (silent = false) => {
    if (!silent) setLoadingDelivered(true);
    try {
      let ordersList = [];
      if (typeof deliveryAPI.getDeliveredOrders === 'function') {
        const res = await deliveryAPI.getDeliveredOrders({ limit: 100 });
        if (res.data?.success && Array.isArray(res.data?.data?.deliveredOrders)) {
          ordersList = res.data.data.deliveredOrders;
        }
      }

      // Fallback to getTripHistory if delivered endpoint didn't return or isn't available
      if (!ordersList.length && typeof deliveryAPI.getTripHistory === 'function') {
        const historyRes = await deliveryAPI.getTripHistory({
          status: 'Completed',
          period: 'all',
          all: true,
          limit: 100
        });
        if (historyRes.data?.success && Array.isArray(historyRes.data?.data?.trips)) {
          ordersList = historyRes.data.data.trips;
        }
      }

      setDeliveredOrders(ordersList);
    } catch (err) {
      console.warn('Could not fetch delivered orders:', err);
    } finally {
      if (!silent) setLoadingDelivered(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveredOrders();
  }, [fetchDeliveredOrders]);

  const totalActive = incomingOrders.length + acceptedOrders.length;

  return (
    <div className="min-h-full bg-gray-50 px-4 pb-28 pt-5">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Orders</h1>
          <p className="mt-0.5 text-xs font-medium text-gray-500">Manage incoming offers and delivery history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDeliveredOrders(false)}
            disabled={loadingDelivered}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-900 active:scale-95 transition-all shadow-sm"
            title="Refresh orders"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDelivered ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <span className="rounded-full bg-gray-950 px-3 py-1.5 text-xs font-bold text-white shrink-0">
            {activeCount} / {limit} active
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-5 flex rounded-2xl bg-white p-1.5 border border-gray-200 shadow-sm gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-gray-950 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <span>All</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
          }`}>
            {totalActive + deliveredOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-gray-950 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <span>Active</span>
          {totalActive > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
            }`}>
              {totalActive}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delivered')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'delivered'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Delivered</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'delivered' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {deliveredOrders.length}
          </span>
        </button>
      </div>

      {/* 1. New Offers Section */}
      {(activeTab === 'all' || activeTab === 'active') && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-orange-500" />
              <h2 className="font-black text-gray-900 text-base">New Offers</h2>
            </div>
            {incomingOrders.length > 0 && (
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                {incomingOrders.length} pending
              </span>
            )}
          </div>
          <div className="space-y-3">
            {incomingOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-xs font-medium text-gray-400">
                No new offers right now. Stay online to receive deliveries!
              </div>
            ) : (
              incomingOrders.map((order) => {
                const id = getOrderMongoId(order) || getOrderAcceptId(order);
                return (
                  <article key={id} className="rounded-2xl border border-orange-200/80 bg-white p-4 shadow-sm">
                    <OrderInfo order={order} />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPass?.(order);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                      >
                        <X className="h-4 w-4" />
                        Pass
                      </button>
                      <button
                        type="button"
                        disabled={!canAccept}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAccept?.(order);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-gray-950 py-3 text-sm font-bold text-white disabled:bg-gray-300 active:scale-95 transition-all shadow-sm"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {canAccept ? 'Accept' : 'Limit reached'}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* 2. Accepted Orders Section */}
      {(activeTab === 'all' || activeTab === 'active') && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <h2 className="font-black text-gray-900 text-base">Active Deliveries</h2>
            </div>
            {acceptedOrders.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {acceptedOrders.length} in progress
              </span>
            )}
          </div>
          <div className="space-y-3">
            {acceptedOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-xs font-medium text-gray-400">
                No active deliveries at the moment.
              </div>
            ) : (
              acceptedOrders.map((order) => {
                const id = getOrderMongoId(order) || getOrderAcceptId(order);
                return (
                  <article
                    key={id}
                    onClick={() => onOpen?.(order)}
                    className="w-full rounded-2xl border border-green-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] cursor-pointer hover:border-green-300"
                  >
                    <OrderInfo order={order} />
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 gap-2">
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-black uppercase text-green-700 truncate">
                        {String(order?.orderStatus || 'accepted').replaceAll('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkDelivered?.(order);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Delivered</span>
                        </button>
                        <span className="text-xs font-black text-gray-900 flex items-center hover:translate-x-0.5 transition-transform">
                          Open →
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* 3. Delivered Orders Section */}
      {(activeTab === 'all' || activeTab === 'delivered') && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-black text-gray-900 text-base">Delivered Orders</h2>
            </div>
            {deliveredOrders.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                {deliveredOrders.length} completed
              </span>
            )}
          </div>

          <div className="space-y-3">
            {loadingDelivered ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <p className="text-xs text-gray-500 font-medium">Loading delivered orders...</p>
              </div>
            ) : deliveredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs font-medium text-gray-400">
                No delivered orders found yet. Completed deliveries will appear here!
              </div>
            ) : (
              deliveredOrders.map((order, idx) => {
                const id = getOrderMongoId(order) || getOrderAcceptId(order) || `delivered-${idx}`;
                const restaurantInfo = getRestaurantDisplayInfo(order);
                const customerInfo = getCustomerDisplayInfo(order);
                const paymentInfo = getOrderPaymentInfo(order);
                const deliveredTime = formatDeliveredTime(order);
                const itemsSummary = extractItemsSummary(order);
                const riderPay =
                  Number(order?.riderEarning || order?.deliveryEarning || order?.earnings || order?.amount || 0);

                return (
                  <article
                    key={id}
                    onClick={() => setSelectedOrderDetails(order)}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow hover:border-emerald-300 cursor-pointer active:scale-[0.99]"
                  >
                    {/* Top Row: Order ID & Delivered Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-gray-950 uppercase tracking-wider">
                            {displayOrderId(order)}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Delivered</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{deliveredTime}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-black text-emerald-700">
                          {money(riderPay)}
                        </span>
                        <span className="block text-[9px] font-bold text-gray-400 mt-0.5">Earned</span>
                      </div>
                    </div>

                    {/* Items Summary if available */}
                    {itemsSummary && (
                      <p className="mb-2 text-xs text-gray-600 line-clamp-1 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                        <span className="font-bold text-gray-700">Items: </span>
                        {itemsSummary}
                      </p>
                    )}

                    {/* Locations Box */}
                    <div className="mt-2 space-y-2 rounded-xl bg-gray-50/70 p-2.5 text-xs border border-gray-100">
                      <div className="flex items-start gap-2">
                        <Store className="h-3.5 w-3.5 mt-0.5 text-orange-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{restaurantInfo.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{restaurantInfo.shortAddress || restaurantInfo.address}</p>
                        </div>
                      </div>
                      <div className="border-t border-dashed border-gray-200 ml-5" />
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{customerInfo.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{customerInfo.shortAddress || customerInfo.address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer strip: Payment info & Details button */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <span className="text-[11px] font-medium text-gray-600 truncate max-w-[65%]">
                        {paymentInfo.isCod
                          ? `COD Collected: ₹${paymentInfo.totalAmount.toFixed(0)}`
                          : `Pre-paid Online (${money(paymentInfo.totalAmount)})`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-800">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Delivered Order Details Modal */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="w-full sm:max-w-md max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto shadow-2xl border border-gray-100"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-gray-950">
                      {displayOrderId(selectedOrderDetails)}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Delivered
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDeliveredTime(selectedOrderDetails)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Earnings Banner */}
              <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Your Payout</p>
                  <p className="text-2xl font-black text-emerald-800 mt-0.5">
                    {money(
                      selectedOrderDetails?.riderEarning ||
                        selectedOrderDetails?.deliveryEarning ||
                        selectedOrderDetails?.earnings ||
                        selectedOrderDetails?.amount ||
                        0
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Order Bill</p>
                  <p className="text-base font-black text-gray-900 mt-0.5">
                    ₹{Number(selectedOrderDetails?.pricing?.total || selectedOrderDetails?.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Addresses */}
              <div className="mt-4 space-y-3">
                {/* Pickup */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" />
                      Pickup Restaurant
                    </span>
                    {getRestaurantDisplayInfo(selectedOrderDetails).mapsUrl && (
                      <a
                        href={getRestaurantDisplayInfo(selectedOrderDetails).mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>Map</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-1">
                    {getRestaurantDisplayInfo(selectedOrderDetails).name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getRestaurantDisplayInfo(selectedOrderDetails).address}
                  </p>
                  {getRestaurantDisplayInfo(selectedOrderDetails).phone && (
                    <a
                      href={`tel:${getRestaurantDisplayInfo(selectedOrderDetails).phone}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                    >
                      <Phone className="w-3 h-3" />
                      {getRestaurantDisplayInfo(selectedOrderDetails).phone}
                    </a>
                  )}
                </div>

                {/* Drop */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Customer Drop
                    </span>
                    {getCustomerDisplayInfo(selectedOrderDetails).mapsUrl && (
                      <a
                        href={getCustomerDisplayInfo(selectedOrderDetails).mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>Map</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-1">
                    {getCustomerDisplayInfo(selectedOrderDetails).name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getCustomerDisplayInfo(selectedOrderDetails).address}
                  </p>
                  {getCustomerDisplayInfo(selectedOrderDetails).phone && (
                    <a
                      href={`tel:${getCustomerDisplayInfo(selectedOrderDetails).phone}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                    >
                      <Phone className="w-3 h-3" />
                      {getCustomerDisplayInfo(selectedOrderDetails).phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Items List */}
              {Array.isArray(selectedOrderDetails?.items || selectedOrderDetails?.orderItems) && (
                <div className="mt-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">
                    Delivered Items ({(selectedOrderDetails?.items || selectedOrderDetails?.orderItems || []).length})
                  </p>
                  <div className="space-y-1.5">
                    {(selectedOrderDetails?.items || selectedOrderDetails?.orderItems || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-800">
                          {it.quantity || it.qty || 1}x {it.name || it.title || it.foodName || 'Item'}
                        </span>
                        {(it.price || it.itemPrice) && (
                          <span className="text-gray-500 font-mono">
                            ₹{Number(it.price || it.itemPrice).toFixed(0)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="mt-5 w-full py-3.5 rounded-2xl bg-gray-950 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
