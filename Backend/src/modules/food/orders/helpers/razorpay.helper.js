import crypto from 'crypto';

let Razorpay;
try {
    const mod = await import('razorpay');
    Razorpay = mod.default;
} catch {
    Razorpay = null;
}

import { config } from '../../../../config/env.js';

export function getRazorpayKeyId() {
    return config.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '';
}

export function getRazorpayKeySecret() {
    return config.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '';
}

export function isRazorpayConfigured() {
    return Boolean(getRazorpayKeyId() && getRazorpayKeySecret() && Razorpay);
}

export function getRazorpayInstance() {
    if (!isRazorpayConfigured()) return null;
    return new Razorpay({ key_id: getRazorpayKeyId(), key_secret: getRazorpayKeySecret() });
}

export function createRazorpayOrder(amountPaise, currency = 'INR', receipt = '') {
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.orders.create({
        amount: Math.round(amountPaise),
        currency,
        receipt: receipt || undefined
    });
}

export function createPaymentLink({ amountPaise, currency = 'INR', description, orderId, customerName, customerEmail, customerPhone }) {
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.paymentLink.create({
        amount: Math.round(amountPaise),
        currency,
        description: description || `Order ${orderId}`,
        customer: {
            name: customerName || 'Customer',
            email: customerEmail || 'customer@example.com',
            contact: customerPhone ? String(customerPhone).replace(/\D/g, '').slice(-10) : '9999999999'
        }
    });
}

/** Create a fixed-amount, single-use UPI QR owned by Razorpay (Live) or clean UPI fallback (Test/Local). */
export async function createRazorpayQrCode({ amountPaise, closeBy, description, notes }) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');

    const keyId = getRazorpayKeyId();
    const isLiveKey = keyId.startsWith('rzp_live_');

    if (isLiveKey) {
        try {
            return await instance.qrCode.create({
                type: 'upi_qr',
                usage: 'single_use',
                fixed_amount: true,
                payment_amount: Math.round(amountPaise),
                close_by: Math.floor(closeBy),
                description,
                notes
            });
        } catch (err) {
            console.warn('[RazorpayHelper] Live QR creation error, using fallback:', err?.message || err);
        }
    }

    // Test mode fallback or live backup: Generate standard UPI dynamic QR code
    // Razorpay test accounts do not support dynamic UPI QR (/v1/payments/qr_codes),
    // so generate a standard UPI payment URL & QR image
    const amountRupees = (Math.round(amountPaise) / 100).toFixed(2);
    const note = String(description || 'Food Order Payment').slice(0, 40);
    const upiUri = `upi://pay?pa=jharkhandrasoi@icici&pn=Jharkhand%20Rasoi&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(note)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiUri)}`;

    return {
        id: `qr_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entity: 'qr_code',
        created_at: Math.floor(Date.now() / 1000),
        name: description || 'Payment QR',
        usage: 'single_use',
        type: 'upi_qr',
        status: 'active',
        description,
        fixed_amount: true,
        payment_amount: Math.round(amountPaise),
        payments_amount_received: 0,
        payments_count_received: 0,
        notes,
        customer_id: null,
        close_by: Math.floor(closeBy),
        image_url: qrImageUrl,
        isFallback: true,
    };
}

/** Fetch payments associated with one Razorpay QR code. */
export function fetchAllRazorpayQrPayments(qrId) {
    if (!qrId) return Promise.reject(new Error('qrId is required'));
    if (String(qrId).startsWith('qr_test_')) {
        return Promise.resolve({ entity: 'collection', count: 0, items: [] });
    }
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.qrCode.fetchAllPayments(String(qrId));
}

export function fetchRazorpayQrCode(qrId) {
    if (!qrId) return Promise.reject(new Error('qrId is required'));
    if (String(qrId).startsWith('qr_test_')) {
        return Promise.resolve({
            id: String(qrId),
            entity: 'qr_code',
            status: 'active',
            usage: 'single_use',
        });
    }
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.qrCode.fetch(String(qrId));
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
    const secret = getRazorpayKeySecret();
    if (!secret) return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
}

/**
 * Fetch Razorpay payment (server-side) for additional validation (amount/status/order match).
 * @param {string} paymentId - e.g. pay_xxx
 * @returns {Promise<object>} Payment entity from Razorpay API
 */
export async function fetchRazorpayPayment(paymentId) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');
    if (!paymentId) throw new Error('paymentId is required');
    return instance.payments.fetch(paymentId);
}

/**
 * Verify webhook signature from Razorpay.
 * @param {string} body - Raw string body of the request
 * @param {string} signature - Value of x-razorpay-signature header
 * @returns {boolean}
 */
export function verifyWebhookSignature(body, signature) {
    const webhookSecret = config.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || !signature) return false;
    try {
        const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
        return false;
    }
}
