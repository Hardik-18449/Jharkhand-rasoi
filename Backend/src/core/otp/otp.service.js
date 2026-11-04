import crypto from 'crypto';
import ms from 'ms';
import { FoodOtp } from './otp.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../auth/errors.js';

const generateOtpCode = () => {
    // 6-digit OTP as expected by Jharkhand Rasoi user, restaurant and rider apps
    const code = crypto.randomInt(100000, 999999);
    return String(code);
};

const maskPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 4 ? `******${digits.slice(-4)}` : 'unknown';
};

/** Shown to the user whenever the SMS could not be handed to the operator. */
const SMS_SEND_FAILED_MESSAGE = 'We could not send the OTP SMS right now. Please try again in a minute.';

/**
 * "91" + the last 10 digits for Indian mobiles.
 */
export const toIndianMsisdn = (phone) => `91${String(phone || '').replace(/\D/g, '').slice(-10)}`;

/*
 * The SMS text must match the TRAI DLT template registered for
 * SMS_INDIA_HUB_DLT_TEMPLATE_ID character for character. Approved DLT template:
 *   "Welcome to ##var##, powered by ##var##. Your OTP for registration ##var##. This OTP is valid for 10 minutes. Please do not share it with anyone.BGADPL"
 * Override with SMS_INDIA_HUB_OTP_TEMPLATE ({otp} is replaced) if the approved text changes.
 */
const DEFAULT_INDIA_HUB_OTP_TEMPLATE =
    'Welcome to Jharkhand Rasoi, powered by BGADPL. Your OTP for registration is {otp}. This OTP is valid for 10 minutes. Please do not share it with anyone.BGADPL';

export const buildIndiaHubOtpMessage = (otp) =>
    String(config.smsIndiaHubOtpTemplate || process.env.SMS_INDIA_HUB_OTP_TEMPLATE || DEFAULT_INDIA_HUB_OTP_TEMPLATE)
        .split('{otp}')
        .join(String(otp));

/**
 * SMS India Hub answers HTTP 200 for failures too. Success is the JSON
 * `{"ErrorCode":"000", ...}`; failures arrive either as JSON with another code
 * or as plain text such as "Failed#Parameter Missing".
 */
export const parseIndiaHubResponse = (status, text) => {
    const body = String(text || '').trim();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch (_) { /* plain text */ }
    if (parsed && typeof parsed === 'object' && 'ErrorCode' in parsed) {
        const code = String(parsed.ErrorCode);
        return code === '000'
            ? { ok: true, data: parsed }
            : { ok: false, code, reason: parsed.ErrorMessage || body };
    }
    if (status < 200 || status >= 300) return { ok: false, code: `HTTP_${status}`, reason: body };
    if (!body || /fail|error|invalid|missing|denied|insufficient|blocked/i.test(body)) {
        return { ok: false, code: 'TEXT', reason: body || 'empty response' };
    }
    return { ok: true, unverified: true };
};

/**
 * Sends the OTP via SMS India Hub (cloud.smsindiahub.in).
 * Throws when the SMS was not accepted so caller can report error to user.
 */
export const sendSmsViaIndiaHub = async (phone, otp) => {
    const msisdn = toIndianMsisdn(phone);
    const apiKey = String(config.smsApiKey || '').trim();
    const senderId = String(config.smsSenderId || '').trim();
    const templateId = String(config.smsDltTemplateId || '').trim();

    if (!apiKey || !senderId) {
        logger.error('[SMS] SMS India Hub is enabled but SMS_INDIA_HUB_API_KEY / SMS_INDIA_HUB_SENDER_ID is missing.');
        throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
    }

    const url = new URL('https://cloud.smsindiahub.in/vendorsms/pushsms.aspx');
    url.searchParams.append('APIKey', apiKey);
    url.searchParams.append('sid', senderId);
    url.searchParams.append('msisdn', msisdn);
    url.searchParams.append('msg', buildIndiaHubOtpMessage(otp));
    url.searchParams.append('gwid', '2');
    url.searchParams.append('fl', '0');
    if (config.smsIndiaHubUsername) {
        url.searchParams.append('uname', String(config.smsIndiaHubUsername).trim());
    }
    if (templateId) {
        // SMS India Hub uses TemplateID for DLT matching
        url.searchParams.append('TemplateID', templateId);
        url.searchParams.append('DLT_TE_ID', templateId);
    }

    logger.info(`[SMS] Sending OTP to ${maskPhone(msisdn)} via SMS India Hub...`);
    let status;
    let resultText;
    try {
        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        status = response.status;
        resultText = await response.text();
    } catch (error) {
        logger.error(`[SMS] SMS India Hub unreachable for ${maskPhone(msisdn)}: ${error.message}`);
        throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
    }
    logger.info(`[SMS] Raw response for ${maskPhone(msisdn)}: ${resultText}`);

    const result = parseIndiaHubResponse(status, resultText);
    if (!result.ok) {
        const errMsg = `SMS India Hub rejected OTP for ${maskPhone(msisdn)}: [${result.code}] ${result.reason}`;
        logger.error(errMsg);
        // eslint-disable-next-line no-console
        console.error(`❌ [SMS ERROR] ${errMsg}`);
        if (result.code === '006') {
            // eslint-disable-next-line no-console
            console.error('❌ [SMS ERROR] ErrorCode 006 = DLT template mismatch. The SMS text must EXACTLY match the approved DLT template, and SMS_INDIA_HUB_SENDER_ID must be the DLT header linked to that template.');
        }
        throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
    }

    logger.info(
        result.unverified
            ? `[SMS] Unrecognised SMS India Hub response for ${maskPhone(msisdn)}; treating as sent.`
            : `✅ SMS accepted by SMS India Hub for ${maskPhone(msisdn)}`
    );
};

/**
 * Sends SMS via MSG91 OTP API (optional fallback)
 */
export const sendSmsViaMsg91 = async (phone, otp) => {
    try {
        const msisdn = toIndianMsisdn(phone);
        logger.info(`[SMS] Sending OTP to ${maskPhone(msisdn)} via MSG91 OTP API...`);

        const response = await fetch('https://control.msg91.com/api/v5/otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authkey': config.msg91AuthKey
            },
            body: JSON.stringify({
                template_id: config.msg91TemplateId,
                mobile: msisdn,
                otp: otp
            })
        });

        const resultText = await response.text();
        logger.info(`[SMS] MSG91 raw response for ${maskPhone(msisdn)}: ${resultText}`);

        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch (_) { /* plain text response */ }

        if (parsed && parsed.type === 'error') {
            const errMsg = `MSG91 ERROR for ${maskPhone(phone)}: ${parsed.message || resultText}`;
            logger.error(errMsg);
            // eslint-disable-next-line no-console
            console.error(`❌ [SMS ERROR] ${errMsg}`);
            throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
        } else if (!response.ok) {
            logger.error(`MSG91 API HTTP error for ${maskPhone(phone)}: ${response.status} – ${resultText}`);
            throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
        } else {
            logger.info(`✅ MSG91 SMS sent successfully to ${maskPhone(msisdn)}`);
        }
    } catch (error) {
        logger.error(`Error sending SMS via MSG91 to ${maskPhone(phone)}: ${error.message}`);
        throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
    }
};

/**
 * Sends a DLT-approved OTP message through legacy SMSWala India.
 */
export const sendSmsViaSmsWala = async (phone, otp) => {
    const requiredConfig = {
        SMSWALA_API_KEY: config.smsWalaApiKey,
        SMSWALA_SENDER_ID: config.smsWalaSenderId,
        SMSWALA_TEMPLATE_ID: config.smsWalaTemplateId,
        SMSWALA_PE_ID: config.smsWalaPeId,
    };
    const missing = Object.entries(requiredConfig)
        .filter(([, value]) => !String(value || '').trim())
        .map(([key]) => key);
    if (missing.length > 0) {
        throw new Error(`SMSWala configuration missing: ${missing.join(', ')}`);
    }

    const digits = String(phone || '').replace(/\D/g, '');
    const mobile = digits.slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        throw new ValidationError('A valid Indian mobile number is required');
    }

    const form = new URLSearchParams({
        key: config.smsWalaApiKey,
        campaign: String(config.smsWalaCampaignId || '16541'),
        routeid: String(config.smsWalaRouteId || '30'),
        type: 'text',
        contacts: mobile,
        senderid: config.smsWalaSenderId,
        msg: `Welcome to TUGGO IT Services, Your OTP is ${otp} for Verification.`,
        template_id: config.smsWalaTemplateId,
        pe_id: config.smsWalaPeId,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        logger.info(`[SMS] Sending OTP to ${maskPhone(mobile)} via SMSWala...`);
        const response = await fetch(config.smsWalaApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
            signal: controller.signal,
        });
        const resultText = (await response.text()).trim();
        const indicatesFailure = /\b(error|invalid|failed|failure|insufficient|unauthori[sz]ed)\b/i.test(resultText);

        if (!response.ok || !resultText || indicatesFailure) {
            logger.error(`[SMS] SMSWala rejected OTP for ${maskPhone(mobile)} (HTTP ${response.status})`);
            throw new Error('SMS provider rejected the OTP request');
        }

        logger.info(`[SMS] OTP accepted by SMSWala for ${maskPhone(mobile)}`);
    } catch (error) {
        const message = error?.name === 'AbortError'
            ? 'SMS provider request timed out'
            : error.message;
        logger.error(`[SMS] SMSWala OTP delivery failed for ${maskPhone(mobile)}: ${message}`);
        throw new Error(message);
    } finally {
        clearTimeout(timeoutId);
    }
};

const normalizePhoneForOtp = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.slice(-10);
};

const DEFAULT_STATIC_TEST_PHONES = [
    '9755633147',
    '8624862400',
    '8000000000',
    '8000000001',
    '8000000002',
    '8000000003',
    '8000000004',
    '8000000005',
    '9999999999',
    '8888888888',
    '7777777777'
];

/** True for designated developer test numbers when USE_DEFAULT_TEST_PHONE is enabled */
const isDefaultTestPhone = (normalizedPhone) => {
    if (!normalizedPhone) return false;
    if (config.useDefaultTestPhone === false) return false;
    if (DEFAULT_STATIC_TEST_PHONES.includes(normalizedPhone)) return true;
    if (/^80000000\d{2}$/.test(normalizedPhone)) return true;
    if (/^99999999\d{2}$/.test(normalizedPhone)) return true;
    const testPhones = config.defaultTestPhones || [];
    if (testPhones.includes(normalizedPhone)) return true;
    if (config.defaultTestPhone && normalizedPhone === config.defaultTestPhone) return true;
    return false;
};

/**
 * Static OTP (123456) when:
 * - USE_DEFAULT_OTP=true (all phones), OR
 * - USE_DEFAULT_TEST_PHONE=true and phone is in DEFAULT_TEST_PHONES
 */
export const shouldUseStaticOtp = (phone) => {
    const normalizedPhone = normalizePhoneForOtp(phone);
    return Boolean(config.useDefaultOtp || isDefaultTestPhone(normalizedPhone));
};

export const createOrUpdateOtp = async (phone) => {
    const normalizedPhone = normalizePhoneForOtp(phone);
    if (!normalizedPhone) throw new ValidationError('Valid phone number is required');

    const existing = await FoodOtp.findOne({ phone: normalizedPhone });
    const now = new Date();
    const useStaticOtp = shouldUseStaticOtp(normalizedPhone);

    // Rate Limiting Window
    if (existing) {
        const windowMs = (config.otpRateWindow || 600) * 1000;
        const windowStart = existing.windowStartedAt || existing.lastRequestAt || now;
        const isInWindow = now - windowStart < windowMs;

        if (isInWindow) {
            const isDev = config.nodeEnv === 'development';
            const limit = isDev ? 10 : (config.otpRateLimit || 5);
            if (!useStaticOtp && existing.requestCount >= limit) {
                const remainingSec = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
                const mm = Math.floor(remainingSec / 60);
                const ss = String(remainingSec % 60).padStart(2, '0');
                logger.warn(`Rate limit exceeded for phone ${normalizedPhone}; ${remainingSec}s left`);
                throw new ValidationError(`Too many OTP requests. Please try again after ${mm}:${ss} minutes.`);
            }
            existing.requestCount += 1;
            if (!existing.windowStartedAt) existing.windowStartedAt = windowStart;
        } else {
            existing.requestCount = 1;
            existing.windowStartedAt = now;
        }
    }

    let otp;
    let reusedCode = false;

    if (useStaticOtp) {
        otp = '123456';
        logger.info(
            `${config.useDefaultOtp ? 'Default OTP mode' : 'Default test phone'} enabled – OTP is ${otp} for phone ${maskPhone(normalizedPhone)}`
        );
    } else if (
        existing?.otp &&
        existing.expiresAt > now &&
        (existing.attempts || 0) < Math.max(1, config.otpMaxAttempts || 5)
    ) {
        otp = existing.otp;
        reusedCode = true;
    } else {
        otp = generateOtpCode();
    }

    // Expiry calculation
    let ttlMs;
    if (config.otpExpirySeconds) {
        ttlMs = config.otpExpirySeconds * 1000;
    } else if (config.otpExpiryMinutes) {
        ttlMs = config.otpExpiryMinutes * 60 * 1000;
    } else {
        ttlMs = ms(config.otpExpiry || '5m');
    }
    const expiresAt = new Date(now.getTime() + ttlMs);
    const dbRecordExpiresAt = new Date(now.getTime() + Math.max(3600000, ttlMs));

    if (existing) {
        existing.otp = otp;
        existing.otpExpiresAt = expiresAt;
        existing.expiresAt = dbRecordExpiresAt;
        if (!reusedCode) existing.attempts = 0;
        existing.lastRequestAt = now;
        await existing.save();
    } else {
        await FoodOtp.create({
            phone: normalizedPhone,
            otp,
            otpExpiresAt: expiresAt,
            expiresAt: dbRecordExpiresAt,
            attempts: 0,
            requestCount: 1,
            lastRequestAt: now,
            windowStartedAt: now
        });
    }

    // Dispatch SMS if not static OTP
    if (!useStaticOtp) {
        if (config.smsHubEnabled) {
            await sendSmsViaIndiaHub(phone, otp);
        } else if (config.msg91Enabled) {
            await sendSmsViaMsg91(phone, otp);
        } else if (config.smsWalaEnabled) {
            await sendSmsViaSmsWala(phone, otp);
        } else {
            logger.error('[SMS] No SMS provider enabled (SMS_HUB_ENABLED, MSG91_ENABLED, or SMSWALA_ENABLED).');
            throw new ValidationError(SMS_SEND_FAILED_MESSAGE);
        }
    }

    return otp;
};

/**
 * Verifies OTP.
 * Supports both options object `{ consume: true/false }` (Jharkhand Rasoi)
 * and boolean `preserveOtp` (Eatiefy).
 */
export const verifyOtp = async (phone, otp, options = { consume: true }) => {
    const normalizedPhone = normalizePhoneForOtp(phone);
    const record = await FoodOtp.findOne({ phone: normalizedPhone });
    const now = new Date();

    const shouldConsume = typeof options === 'boolean'
        ? !options
        : (options?.consume !== false);

    // Static OTP Bypass for dev/test
    if (shouldUseStaticOtp(normalizedPhone) && (otp === '123456' || otp === '1234')) {
        logger.info(`✅ [OTP-Verify] Static OTP bypass for ${maskPhone(normalizedPhone)}`);
        if (record && shouldConsume) {
            await record.deleteOne();
        }
        return { valid: true };
    }

    if (!record) {
        return { valid: false, reason: 'OTP not found. Please request a new OTP.' };
    }

    const expiryTime = record.otpExpiresAt || record.expiresAt;
    if (expiryTime < now) {
        return { valid: false, reason: 'OTP expired. Please request a new OTP.' };
    }

    const maxAttempts = Math.max(1, config.otpMaxAttempts || 5);
    if ((record.attempts || 0) >= maxAttempts) {
        return { valid: false, reason: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    record.attempts = (record.attempts || 0) + 1;

    const enteredOtp = String(otp || '').trim();
    if (record.otp !== enteredOtp) {
        await record.save();
        return { valid: false, reason: 'Invalid OTP' };
    }

    if (shouldConsume) {
        await record.deleteOne();
    } else {
        await record.save();
    }

    return { valid: true };
};
