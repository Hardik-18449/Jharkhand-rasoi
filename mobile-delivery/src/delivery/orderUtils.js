/** Ported unchanged from web: Food/utils/orderDispatchId.js, DeliveryV2/utils/geo.js, DeliveryV2/hooks/proximity.utils.js, DeliveryV2/utils/orderLocation.js */
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

/**
 * Canonical MongoDB id for accept API + lock comparisons.
 * Prefers orderMongoId / _id over display order_id.
 */
export function getOrderMongoId(order) {
  if (!order) return '';
  const candidates = [
    order.orderMongoId,
    order.order_mongo_id,
    order._id,
    order.id,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value && MONGO_ID_RE.test(value)) return value;
  }
  return '';
}

/** Human-readable order id (ORD-xxx) when present. */
export function getOrderDisplayId(order) {
  if (!order) return '';
  return String(
    order.orderId ||
      order.order_id ||
      order.orderMongoId ||
      order._id ||
      order.id ||
      '',
  ).trim();
}

/** Id used for accept/reject API — mongo id when available. */
export function getOrderAcceptId(order) {
  return getOrderMongoId(order) || getOrderDisplayId(order);
}

export function isSameOrder(a, b) {
  if (!a || !b) return false;
  const aMongo = getOrderMongoId(a);
  const bMongo = getOrderMongoId(b);
  if (aMongo && bMongo) return aMongo === bMongo;

  const aDisplay = getOrderDisplayId(a);
  const bDisplay = getOrderDisplayId(b);
  return Boolean(aDisplay && bDisplay && aDisplay === bDisplay);
}

/** Normalize socket/poll payloads so _id and orderMongoId always match. */
export function normalizeIncomingOrder(order) {
  if (!order) return null;
  const mongoId = getOrderMongoId(order);
  const displayId = getOrderDisplayId(order);
  return {
    ...order,
    orderMongoId: mongoId || order.orderMongoId || order.order_mongo_id || undefined,
    _id: mongoId || order._id || order.id || undefined,
    orderId: displayId || order.orderId || order.order_id,
  };
}

export function getOrderAlertKey(order = {}) {
  return getOrderMongoId(order) || getOrderDisplayId(order);
}

export function upsertIncomingOrderInQueue(queue, order) {
  const normalized = normalizeIncomingOrder(order);
  if (!normalized) return Array.isArray(queue) ? queue : [];

  const list = Array.isArray(queue) ? queue : [];
  const exists = list.some((item) => isSameOrder(item, normalized));
  if (exists) {
    return list.map((item) =>
      isSameOrder(item, normalized) ? { ...item, ...normalized } : item,
    );
  }
  return [...list, normalized];
}

export function removeIncomingOrderFromQueue(queue, orderRef) {
  if (!orderRef) return Array.isArray(queue) ? queue : [];
  const list = Array.isArray(queue) ? queue : [];
  return list.filter((item) => !isSameOrder(item, orderRef));
}

export function getPrimaryIncomingOrder(queue, selectedId = '') {
  const list = Array.isArray(queue) ? queue : [];
  if (!list.length) return null;

  const selected = String(selectedId || '').trim();
  if (selected) {
    const found = list.find(
      (item) =>
        getOrderMongoId(item) === selected ||
        isSameOrder(item, { orderMongoId: selected, _id: selected }),
    );
    if (found) return found;
  }
  return list[0];
}
/**
 * Haversine formula to calculate the distance between two points in meters.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth Radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Calculates accurate ETA in minutes based on distance and rolling average speed.
 * @param {number} distanceInMeters 
 * @param {number} averageSpeedMetersPerSec 
 * @returns {number} ETA in minutes (minimum 1)
 */
export const calculateETA = (distanceInMeters, averageSpeedMetersPerSec) => {
    if (!distanceInMeters || distanceInMeters <= 0) return 0;
    // Fallback speed if stationary/low speed (avg human biking speed 4.5m/s approx 16km/h)
    const speed = averageSpeedMetersPerSec > 1 ? averageSpeedMetersPerSec : 4.5;
    const seconds = distanceInMeters / speed;
    return Math.max(1, Math.round(seconds / 60));
};
/**
 * Calculates the bearing (heading) between two points in degrees.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Angle in degrees [0, 360)
 */
export const calculateHeading = (lat1, lon1, lat2, lon2) => {
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const deltaLonRad = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);
    
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
};
/**
 * Haversine formula to calculate the great-circle distance between two points on a sphere.
 * Returns distance in meters.
 */
export const parseLatLng = (raw) => {
  if (!raw) return null;

  let lat = Number(raw.lat ?? raw.latitude);
  let lng = Number(raw.lng ?? raw.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const coords = raw.coordinates || raw.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const aLat = Number(lat1);
  const aLng = Number(lon1);
  const bLat = Number(lat2);
  const bLng = Number(lon2);

  if (!Number.isFinite(aLat) || !Number.isFinite(aLng) || !Number.isFinite(bLat) || !Number.isFinite(bLng)) {
    return Infinity;
  }

  const earthRadiusMeters = 6371e3;
  const phi1 = (aLat * Math.PI) / 180;
  const phi2 = (bLat * Math.PI) / 180;
  const deltaPhi = ((bLat - aLat) * Math.PI) / 180;
  const deltaLambda = ((bLng - aLng) * Math.PI) / 180;

  const haversine =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusMeters * arc;
};


/**
 * Format full address from various address and order structures.
 */
function cleanText(val) {
  if (val == null) return '';
  const s = String(val).trim();
  return s === 'undefined' || s === 'null' ? '' : s;
}

/**
 * Extract restaurant display details from an order object.
 */
export function getRestaurantDisplayInfo(order) {
  if (!order) {
    return {
      name: 'Restaurant',
      address: 'Address not available',
      shortAddress: 'Restaurant Location',
      coords: null,
      mapsUrl: null,
      phone: '',
    };
  }

  const restId = typeof order.restaurantId === 'object' && order.restaurantId !== null ? order.restaurantId : {};
  const restLoc = order.restaurantLocation || restId.location || {};

  const name =
    cleanText(order.restaurantName) ||
    cleanText(order.restaurant_name) ||
    cleanText(restId.restaurantName) ||
    cleanText(restId.name) ||
    cleanText(order.restaurant?.restaurantName) ||
    cleanText(order.restaurant?.name) ||
    'Restaurant';

  // Area and city
  const area = cleanText(restLoc.area) || cleanText(restId.area);
  const city = cleanText(restLoc.city) || cleanText(restId.city);
  const areaCity = [area, city].filter(Boolean).join(', ');

  // Full address
  const fullAddress =
    cleanText(order.restaurantAddress) ||
    cleanText(order.restaurant_address) ||
    cleanText(restLoc.formattedAddress) ||
    cleanText(restLoc.address) ||
    cleanText(restId.location?.formattedAddress) ||
    cleanText(restId.location?.address) ||
    cleanText(restId.addressLine1) ||
    cleanText(restId.address) ||
    areaCity ||
    'Address not available';

  // Short address (e.g. Area, City or first line of address)
  const shortAddress =
    areaCity ||
    (fullAddress !== 'Address not available'
      ? fullAddress.split(',').slice(0, 2).join(', ').trim()
      : 'Restaurant Location');

  // Parse coords
  const coords =
    parseLatLng(order.restaurantLocation) ||
    parseLatLng(restId.location) ||
    parseLatLng(order.restaurant_location) ||
    parseLatLng({
      lat: order.restaurantLat ?? order.restaurant_lat,
      lng: order.restaurantLng ?? order.restaurant_lng,
    });

  let mapsUrl = null;
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${coords.lat},${coords.lng}`,
    )}`;
  } else if (fullAddress && fullAddress !== 'Address not available') {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${name}, ${fullAddress}`,
    )}`;
  }

  const phone = cleanText(order.restaurantPhone) || cleanText(restId.phone) || cleanText(order.restaurant_phone) || '';

  return {
    name,
    address: fullAddress,
    shortAddress,
    coords,
    mapsUrl,
    phone,
  };
}

/**
 * Extract customer / delivery user display details from an order object.
 */
export function getCustomerDisplayInfo(order) {
  if (!order) {
    return {
      name: 'Customer',
      address: 'Location not available',
      shortAddress: 'Customer Location',
      coords: null,
      mapsUrl: null,
      phone: '',
    };
  }

  const deliveryAddress =
    (typeof order.deliveryAddress === 'object' && order.deliveryAddress !== null ? order.deliveryAddress : null) ||
    (typeof order.address === 'object' && order.address !== null ? order.address : {}) ||
    {};

  const userObj = typeof order.userId === 'object' && order.userId !== null ? order.userId : (order.user || {});

  const name =
    cleanText(order.customerName) ||
    cleanText(order.userName) ||
    cleanText(deliveryAddress.fullName) ||
    cleanText(deliveryAddress.name) ||
    cleanText(userObj.name) ||
    'Customer';

  const phone =
    cleanText(order.customerPhone) ||
    cleanText(order.userPhone) ||
    cleanText(deliveryAddress.phone) ||
    cleanText(userObj.phone) ||
    '';

  // Address parts from schema
  const addressParts = [
    cleanText(deliveryAddress.street),
    cleanText(deliveryAddress.additionalDetails),
    cleanText(deliveryAddress.landmark),
    cleanText(deliveryAddress.area),
    cleanText(deliveryAddress.city),
    cleanText(deliveryAddress.state),
    cleanText(deliveryAddress.zipCode || deliveryAddress.pincode),
  ].filter(Boolean);

  const parsedPartsString = addressParts.join(', ');

  // Direct address fields
  const rawAddress =
    cleanText(order.customerAddress) ||
    cleanText(order.customer_address) ||
    cleanText(deliveryAddress.formattedAddress) ||
    cleanText(deliveryAddress.address) ||
    cleanText(order.address?.formattedAddress) ||
    cleanText(order.address) ||
    parsedPartsString;

  // Resolve coords
  const coords =
    parseLatLng(order.customerLocation) ||
    parseLatLng(order.deliveryLocation) ||
    parseLatLng(order.customer_location) ||
    parseLatLng(deliveryAddress.location) ||
    parseLatLng(deliveryAddress) ||
    parseLatLng({
      lat: order.customerLat ?? order.customer_lat,
      lng: order.customerLng ?? order.customer_lng,
    });

  const fullAddress =
    rawAddress ||
    (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
      ? `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`
      : 'Location not available');

  // Short address for compact cards
  const areaCity = [cleanText(deliveryAddress.area), cleanText(deliveryAddress.city)].filter(Boolean).join(', ');
  const streetPart = cleanText(deliveryAddress.street);
  const shortAddress =
    areaCity ||
    streetPart ||
    (fullAddress !== 'Location not available'
      ? fullAddress.split(',').slice(0, 2).join(', ').trim()
      : 'Customer Location');

  let mapsUrl = null;
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${coords.lat},${coords.lng}`,
    )}`;
  } else if (fullAddress && fullAddress !== 'Location not available') {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  }

  return {
    name,
    address: fullAddress,
    shortAddress,
    coords,
    mapsUrl,
    phone,
  };
}

/**
 * Extract order bill amount and payment status (COD vs PAID) for rider display.
 */
export function getOrderPaymentInfo(order) {
  if (!order) {
    return {
      totalAmount: 0,
      formattedTotal: '₹0.00',
      isCod: false,
      isPaid: true,
      paymentMethod: 'online',
      paymentLabel: 'PAID',
      paymentStatusText: 'Pre-paid Online',
      collectionNotice: 'Do not collect cash from customer',
    };
  }

  // Extract raw order total value
  const rawTotal =
    order.pricing?.total ??
    order.total ??
    order.orderAmount ??
    order.order_amount ??
    order.pricing?.grandTotal ??
    order.amounts?.total ??
    0;

  const totalAmount = Number(rawTotal) || 0;
  const formattedTotal = `₹${totalAmount.toFixed(2)}`;

  // Determine payment method and status
  const method = String(
    order.paymentMethod ||
    order.payment?.method ||
    order.paymentMode ||
    order.payment_method ||
    ''
  ).toLowerCase().trim();

  const paymentStatus = String(
    order.payment?.status ||
    order.paymentStatus ||
    order.payment_status ||
    ''
  ).toLowerCase().trim();

  const isCod =
    method === 'cash' ||
    method === 'cod' ||
    method === 'cash_on_delivery' ||
    paymentStatus === 'cod_pending';

  const isPaid = !isCod;

  return {
    totalAmount,
    formattedTotal,
    isCod,
    isPaid,
    paymentMethod: method || (isCod ? 'cod' : 'online'),
    paymentLabel: isCod ? 'COD' : 'PAID',
    paymentStatusText: isCod ? 'Cash on Delivery' : 'Pre-paid Online',
    collectionNotice: isCod
      ? `Collect ₹${totalAmount.toFixed(2)} cash from customer`
      : 'Online Paid — Do NOT collect cash',
  };
}

