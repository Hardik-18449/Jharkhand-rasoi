/**
 * Meta (Facebook) Pixel Analytics Service
 * Pixel / Dataset ID: 2090031751442584
 */

export const FB_PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID || '2090031751442584';

/**
 * Safe invocation of window.fbq
 */
export const fbq = (...args) => {
  if (typeof window === 'undefined') return;

  if (typeof window.fbq === 'function') {
    try {
      window.fbq(...args);
      if (import.meta.env.DEV) {
        console.log('[Meta Pixel Event]:', ...args);
      }
    } catch (err) {
      console.warn('[Meta Pixel] Error executing fbq:', err);
    }
  } else if (import.meta.env.DEV) {
    console.debug('[Meta Pixel] fbq not yet ready for event:', ...args);
  }
};

/**
 * Initialize Pixel programmatically if not loaded via index.html
 */
export const initPixel = (pixelId = FB_PIXEL_ID) => {
  if (typeof window === 'undefined') return;
  if (window.fbq) return;

  /* eslint-disable */
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  fbq('init', pixelId);
  fbq('track', 'PageView');
};

/**
 * Track route / PageView on client-side SPA navigation
 */
export const trackPageView = (path) => {
  fbq('track', 'PageView');
};

/**
 * Track when a user views a restaurant, dish, or category
 */
export const trackViewContent = ({ name, id, category, price } = {}) => {
  fbq('track', 'ViewContent', {
    content_name: name || 'Restaurant / Menu',
    content_ids: id ? [String(id)] : [],
    content_category: category || 'Food & Dining',
    content_type: 'product',
    value: Number(price) || 0,
    currency: 'INR',
  });
};

/**
 * Track user search queries
 */
export const trackSearch = (query) => {
  if (!query || !query.trim()) return;
  fbq('track', 'Search', {
    search_string: query.trim(),
    content_category: 'Food Search',
  });
};

/**
 * Track when a customer adds an item to cart
 */
export const trackAddToCart = (item) => {
  if (!item) return;

  const itemId = item.id || item._id || item.foodId || item.name;
  const name = item.name || item.foodName || 'Food Item';
  const price = Number(item.price || item.itemPrice || 0);

  fbq('track', 'AddToCart', {
    content_name: name,
    content_ids: [String(itemId)],
    content_type: 'product',
    value: price,
    currency: 'INR',
  });
};

/**
 * Track when checkout is initiated (e.g. entering checkout / opening payment options)
 */
export const trackInitiateCheckout = (totalAmount, items = []) => {
  const contentIds = items
    .map((i) => String(i?.id || i?._id || i?.foodId || i?.name))
    .filter(Boolean);

  fbq('track', 'InitiateCheckout', {
    content_type: 'product',
    content_ids: contentIds,
    num_items: items.length || 1,
    value: Number(totalAmount) || 0,
    currency: 'INR',
  });
};

/**
 * Track successful order placement (Purchase)
 */
export const trackPurchase = (order, customTotal) => {
  if (!order && customTotal == null) return;

  const orderId = order?._id || order?.orderId || order?.id || ('ORD-' + Date.now());
  const value = customTotal ?? (order?.pricing?.total || order?.total || order?.totalAmount || 0);
  const rawItems = order?.items || [];

  const items = rawItems.map((i) => ({
    id: String(i?.food || i?._id || i?.itemId || i?.name || 'item'),
    name: i?.name || i?.foodName || 'Food Item',
    quantity: i?.quantity || 1,
    item_price: Number(i?.price || i?.itemPrice || 0),
  }));

  fbq('track', 'Purchase', {
    content_type: 'product',
    content_ids: items.map((i) => i.id),
    contents: items,
    num_items: items.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 1,
    value: Number(value) || 0,
    currency: 'INR',
    order_id: String(orderId),
  });
};

/**
 * Track user login / signup registration completed
 */
export const trackCompleteRegistration = (method = 'OTP') => {
  fbq('track', 'CompleteRegistration', {
    registration_method: method,
    status: 'success',
  });
};

// Global event listener for custom order-placed events dispatched in the app
if (typeof window !== 'undefined') {
  window.addEventListener('order-placed', (e) => {
    try {
      const order = e?.detail?.order;
      if (order) {
        trackPurchase(order);
      }
    } catch (err) {
      console.warn('[Meta Pixel] Error handling order-placed event:', err);
    }
  });
}

export default {
  FB_PIXEL_ID,
  fbq,
  initPixel,
  trackPageView,
  trackViewContent,
  trackSearch,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
  trackCompleteRegistration,
};
