import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveUploadRoot } from '../utils/uploadPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config();
dotenv.config({ path: backendEnvPath, override: false });

/** true/false for true|1|yes|on / false|0|no|off (any case, quotes ok); undefined when unset. */
function readEnvFlag(name) {
    const raw = String(process.env[name] ?? '').trim().replace(/^["']|["']$/g, '').trim();
    if (!raw) return undefined;
    if (/^(true|1|yes|on)$/i.test(raw)) return true;
    if (/^(false|0|no|off)$/i.test(raw)) return false;
    return undefined;
}

const resolveMongoUri = () => {
    const mongoEnv = (process.env.MONGO_ENV || '').toLowerCase().trim();
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();

    // When on domain / production, use production MongoDB
    if (mongoEnv === 'production' || mongoEnv === 'prod' || nodeEnv === 'production') {
        return process.env.MONGO_URI_PRODUCTION || process.env.MONGODB_URI;
    }
    // When on localhost (development / local), use local MongoDB
    if (mongoEnv === 'local' || mongoEnv === 'dev' || nodeEnv === 'development') {
        return process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';
    }
    return process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';
};

export const resolveRazorpayKeys = () => {
    const mongoEnv = (process.env.MONGO_ENV || '').toLowerCase().trim();
    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
    const razorpayMode = (process.env.RAZORPAY_MODE || '').toLowerCase().trim();
    const testModeFlag = readEnvFlag('RAZORPAY_TEST_MODE');
    const explicitKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();

    const liveKeyId = process.env.RAZORPAY_LIVE_KEY_ID || 'rzp_live_Tu71kQFx3AofXH';
    const liveKeySecret = process.env.RAZORPAY_LIVE_KEY_SECRET || 'ixU3NeYyW5A6sXdzeC3GY090';

    const testKeyId = process.env.RAZORPAY_TEST_KEY_ID || 'rzp_test_SbjooFQK8nvU6V';
    const testKeySecret = process.env.RAZORPAY_TEST_KEY_SECRET || 'Av7Mz5DBxwD5C6sUGw66qAGE';

    // 1. Explicit TEST mode requested (via RAZORPAY_MODE=test or RAZORPAY_TEST_MODE=true)
    if (razorpayMode === 'test' || testModeFlag === true) {
        return {
            keyId: explicitKeyId.startsWith('rzp_test_') ? explicitKeyId : testKeyId,
            keySecret: (explicitKeyId.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET)
                ? process.env.RAZORPAY_KEY_SECRET
                : testKeySecret,
            isLive: false,
        };
    }

    // 2. Explicit LIVE mode requested (via RAZORPAY_MODE=live or RAZORPAY_TEST_MODE=false)
    if (razorpayMode === 'live' || testModeFlag === false) {
        return {
            keyId: explicitKeyId.startsWith('rzp_live_') ? explicitKeyId : liveKeyId,
            keySecret: (explicitKeyId.startsWith('rzp_live_') && process.env.RAZORPAY_KEY_SECRET)
                ? process.env.RAZORPAY_KEY_SECRET
                : liveKeySecret,
            isLive: true,
        };
    }

    // 3. Key ID explicitly provided in environment
    if (explicitKeyId) {
        const isLive = explicitKeyId.startsWith('rzp_live_');
        return {
            keyId: explicitKeyId,
            keySecret: process.env.RAZORPAY_KEY_SECRET || (isLive ? liveKeySecret : testKeySecret),
            isLive,
        };
    }

    // 4. Default: Use test keys for safe testing across all environments.
    // To switch to live mode, set RAZORPAY_MODE=live in .env
    return {
        keyId: testKeyId,
        keySecret: testKeySecret,
        isLive: false,
    };
};

export const config = {
    // Basic server config
    port: process.env.PORT || 5000,
    socketPort: process.env.SOCKET_PORT || 5001,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    mongoEnv: (process.env.MONGO_ENV || 'local').toLowerCase().trim(),
    mongodbUri: resolveMongoUri(),

    // JWT
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '365d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '365d',

    // OTP
    otpExpiry: process.env.OTP_EXPIRY || '5m',
    otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
    otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
    otpExpirySeconds: Number(process.env.OTP_EXPIRY_SECONDS || 300),
    otpRateLimit: Number(process.env.OTP_RATE_LIMIT || 3),
    otpRateWindow: Number(process.env.OTP_RATE_WINDOW || 600),
    useDefaultOtp: readEnvFlag('USE_DEFAULT_OTP') ?? (process.env.NODE_ENV === 'development'),
    useDefaultTestPhone: readEnvFlag('USE_DEFAULT_TEST_PHONE') ?? true,
    defaultTestPhone: String(process.env.DEFAULT_TEST_PHONE || '9755633147').replace(/\D/g, '').slice(-10),
    defaultTestPhones: (() => {
        const rawPhones = [
            '9755633147',
            '8624862400',
            ...(process.env.DEFAULT_TEST_PHONE ? String(process.env.DEFAULT_TEST_PHONE).split(',') : []),
            ...(process.env.DEFAULT_TEST_PHONES ? String(process.env.DEFAULT_TEST_PHONES).split(',') : []),
        ];
        return [...new Set(rawPhones.map((p) => String(p).replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10))];
    })(),

    // SMS India Hub
    smsIndiaHubUsername: process.env.SMS_INDIA_HUB_USERNAME || 'JHARKHANDRASOI',
    smsApiKey: process.env.SMS_INDIA_HUB_API_KEY,
    smsSenderId: process.env.SMS_INDIA_HUB_SENDER_ID || 'BGADPL',
    smsDltTemplateId: process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || '1077104580057767222',
    smsIndiaHubOtpTemplate: process.env.SMS_INDIA_HUB_OTP_TEMPLATE,

    // Service Toggles
    smsHubEnabled: (() => {
        const flag = readEnvFlag('SMS_HUB_ENABLED');
        if (flag !== undefined) return flag;
        if (readEnvFlag('MSG91_ENABLED') === true) return false;
        return Boolean(
            String(process.env.SMS_INDIA_HUB_API_KEY || '').trim() &&
            String(process.env.SMS_INDIA_HUB_SENDER_ID || '').trim()
        );
    })(),
    msg91Enabled: readEnvFlag('MSG91_ENABLED') === true,
    smsWalaEnabled: readEnvFlag('SMSWALA_ENABLED') === true,

    // MSG91
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91SenderId: process.env.MSG91_SENDER_ID,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,

    // SMSWala India
    smsWalaApiUrl: process.env.SMSWALA_API_URL || 'https://sms.smswala.in/app/smsapi/index.php',
    smsWalaApiKey: process.env.SMSWALA_API_KEY,
    smsWalaCampaignId: process.env.SMSWALA_CAMPAIGN_ID || '16541',
    smsWalaRouteId: process.env.SMSWALA_ROUTE_ID || '30',
    smsWalaSenderId: process.env.SMSWALA_SENDER_ID,
    smsWalaTemplateId: process.env.SMSWALA_TEMPLATE_ID,
    smsWalaPeId: process.env.SMSWALA_PE_ID,

    // Rate limiting
    rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW || 15),
    rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
    authRateLimitWindowMinutes: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 15),
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),

    // Security
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),

    // Uploads
    uploadPath: resolveUploadRoot(),

    // Redis
    redisEnabled: process.env.REDIS_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL,

    // BullMQ
    bullmqEnabled: process.env.BULLMQ_ENABLED === 'true',

    // Firebase / FCM
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    firebaseDatabaseUrl: process.env.VITE_FIREBASE_DATABASE_URL,
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
    firebaseWebApiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    firebaseWebAuthDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    firebaseWebStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    firebaseWebMessagingSenderId:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseWebAppId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    firebaseWebMeasurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID,
    firebaseWebVapidKey: process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY,

    // Apple VoIP / APNs
    apnsVoipPfxPath: process.env.APNS_VOIP_PFX_PATH || process.env.APNS_VOIP_CERT_PATH,
    apnsVoipCertPassword: process.env.APNS_VOIP_CERT_PASSWORD || process.env.VOIP_CERT_PASSWORD,
    apnsVoipTopic: process.env.APNS_VOIP_TOPIC || process.env.APNS_TOPIC,
    apnsVoipTopicRestaurant: process.env.APNS_VOIP_TOPIC_RESTAURANT || process.env.APNS_TOPIC_RESTAURANT,
    apnsVoipTopicDelivery: process.env.APNS_VOIP_TOPIC_DELIVERY || process.env.APNS_TOPIC_DELIVERY,
    apnsProduction: process.env.APNS_PRODUCTION || 'true',

    // Socket.io
    socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',

    // Razorpay (payments)
    get razorpayKeyId() {
        return resolveRazorpayKeys().keyId;
    },
    get razorpayKeySecret() {
        return resolveRazorpayKeys().keySecret;
    },
    get isRazorpayLive() {
        return resolveRazorpayKeys().isLive;
    },
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,

    // Email (SMTP) – for admin forgot password OTP etc.
    emailHost: process.env.EMAIL_HOST,
    emailPort: Number(process.env.EMAIL_PORT) || 587,
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS ? String(process.env.EMAIL_PASS).replace(/\s/g, '') : '',
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@example.com',

    // Petpooja POS
    petpoojaSyncEnabled: process.env.PETPOOJA_SYNC_ENABLED === 'true',
    petpoojaAppKey: process.env.PETPOOJA_APP_KEY,
    petpoojaAppSecret: process.env.PETPOOJA_APP_SECRET,

    // Google Maps
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY,

    // OBD Call Alert Configuration
    obd: {
        apiUrl: process.env.OBD_API_URL || 'http://202.89.79.132/OBDAPI/webresources/CreateOBDCampaignPost',
        ukey: process.env.OBD_UKEY || 'xI4u4NTPUK2kji8yevL7gUtBL',
        serviceno: process.env.OBD_SERVICENO || '7557132559',
        voicefile: process.env.OBD_VOICEFILE || 'Ravi.wav',
        sourcetype: process.env.OBD_SOURCETYPE || '0',
        campaigntype: process.env.OBD_CAMPAIGNTYPE || '4',
        filetype: process.env.OBD_FILETYPE || '2',
        ivrtemplateid: process.env.OBD_IVRTEMPLATEID || '1',
        retryduration: Number(process.env.OBD_RETRYDURATION || 0),
        dtmflength: process.env.OBD_DTMFLENGTH || '1',
        waitduration: process.env.OBD_WAITDURATION || '5'
    }
};

export const updateConfig = () => {
    config.port = process.env.PORT || config.port;
    config.socketPort = process.env.SOCKET_PORT || config.socketPort;
    config.host = process.env.HOST || config.host;
    config.nodeEnv = process.env.NODE_ENV || config.nodeEnv;
    config.mongoEnv = (process.env.MONGO_ENV || config.mongoEnv || 'local').toLowerCase().trim();
    config.mongodbUri = resolveMongoUri();
    config.jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || config.jwtAccessSecret;
    config.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || config.jwtRefreshSecret;
    config.jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES || config.jwtAccessExpiresIn;
    config.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES || config.jwtRefreshExpiresIn;
    config.otpExpiry = process.env.OTP_EXPIRY || config.otpExpiry;
    config.otpMaxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || config.otpMaxAttempts);
    config.otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || config.otpExpiryMinutes);
    config.otpExpirySeconds = Number(process.env.OTP_EXPIRY_SECONDS || config.otpExpirySeconds);
    config.otpRateLimit = Number(process.env.OTP_RATE_LIMIT || config.otpRateLimit);
    config.otpRateWindow = Number(process.env.OTP_RATE_WINDOW || config.otpRateWindow);
    config.useDefaultOtp = readEnvFlag('USE_DEFAULT_OTP') ?? (process.env.NODE_ENV === 'development');
    config.useDefaultTestPhone = readEnvFlag('USE_DEFAULT_TEST_PHONE') ?? true;
    config.defaultTestPhone = String(process.env.DEFAULT_TEST_PHONE || '9755633147').replace(/\D/g, '').slice(-10);
    config.smsIndiaHubUsername = process.env.SMS_INDIA_HUB_USERNAME || 'JHARKHANDRASOI';
    config.smsApiKey = process.env.SMS_INDIA_HUB_API_KEY || config.smsApiKey;
    config.smsSenderId = process.env.SMS_INDIA_HUB_SENDER_ID || config.smsSenderId || 'BGADPL';
    config.smsDltTemplateId = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || config.smsDltTemplateId || '1077104580057767222';
    config.smsIndiaHubOtpTemplate = process.env.SMS_INDIA_HUB_OTP_TEMPLATE || config.smsIndiaHubOtpTemplate;
    config.smsHubEnabled = Boolean(
        process.env.SMS_HUB_ENABLED === 'true' ||
        (process.env.SMS_INDIA_HUB_API_KEY && process.env.SMS_INDIA_HUB_SENDER_ID)
    );
    config.msg91Enabled = readEnvFlag('MSG91_ENABLED') === true;
    config.smsWalaEnabled = readEnvFlag('SMSWALA_ENABLED') === true;
    config.msg91AuthKey = process.env.MSG91_AUTH_KEY || config.msg91AuthKey;
    config.msg91SenderId = process.env.MSG91_SENDER_ID || config.msg91SenderId;
    config.msg91TemplateId = process.env.MSG91_TEMPLATE_ID || config.msg91TemplateId;
    config.smsWalaApiUrl = process.env.SMSWALA_API_URL || config.smsWalaApiUrl;
    config.smsWalaApiKey = process.env.SMSWALA_API_KEY || config.smsWalaApiKey;
    config.smsWalaCampaignId = process.env.SMSWALA_CAMPAIGN_ID || config.smsWalaCampaignId;
    config.smsWalaRouteId = process.env.SMSWALA_ROUTE_ID || config.smsWalaRouteId;
    config.smsWalaSenderId = process.env.SMSWALA_SENDER_ID || config.smsWalaSenderId;
    config.smsWalaTemplateId = process.env.SMSWALA_TEMPLATE_ID || config.smsWalaTemplateId;
    config.smsWalaPeId = process.env.SMSWALA_PE_ID || config.smsWalaPeId;
    config.rateLimitWindowMinutes = Number(process.env.RATE_LIMIT_WINDOW || config.rateLimitWindowMinutes);
    config.rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX || config.rateLimitMaxRequests);
    config.authRateLimitWindowMinutes = Number(process.env.AUTH_RATE_LIMIT_WINDOW || config.authRateLimitWindowMinutes);
    config.authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || config.authRateLimitMax);
    config.bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || config.bcryptSaltRounds);
    config.uploadPath = resolveUploadRoot();
    config.redisEnabled = process.env.REDIS_ENABLED === 'true';
    config.redisUrl = process.env.REDIS_URL || config.redisUrl;
    config.bullmqEnabled = process.env.BULLMQ_ENABLED === 'true';

    config.firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || config.firebaseProjectId;
    config.firebaseDatabaseUrl = process.env.VITE_FIREBASE_DATABASE_URL || config.firebaseDatabaseUrl;
    config.firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || config.firebaseServiceAccountPath;
    config.firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || config.firebaseServiceAccount;
    config.firebaseWebApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || config.firebaseWebApiKey;
    config.firebaseWebAuthDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || config.firebaseWebAuthDomain;
    config.firebaseWebStorageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || config.firebaseWebStorageBucket;
    config.firebaseWebMessagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || config.firebaseWebMessagingSenderId;
    config.firebaseWebAppId = process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || config.firebaseWebAppId;
    config.firebaseWebMeasurementId = process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || config.firebaseWebMeasurementId;
    config.firebaseWebVapidKey = process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || config.firebaseWebVapidKey;
    config.apnsVoipPfxPath = process.env.APNS_VOIP_PFX_PATH || process.env.APNS_VOIP_CERT_PATH || config.apnsVoipPfxPath;
    config.apnsVoipCertPassword = process.env.APNS_VOIP_CERT_PASSWORD || process.env.VOIP_CERT_PASSWORD || config.apnsVoipCertPassword;
    config.apnsVoipTopic = process.env.APNS_VOIP_TOPIC || process.env.APNS_TOPIC || config.apnsVoipTopic;
    config.apnsVoipTopicRestaurant = process.env.APNS_VOIP_TOPIC_RESTAURANT || process.env.APNS_TOPIC_RESTAURANT || config.apnsVoipTopicRestaurant;
    config.apnsVoipTopicDelivery = process.env.APNS_VOIP_TOPIC_DELIVERY || process.env.APNS_TOPIC_DELIVERY || config.apnsVoipTopicDelivery;
    config.apnsProduction = process.env.APNS_PRODUCTION || config.apnsProduction;
    config.socketCorsOrigin = process.env.SOCKET_CORS_ORIGIN || config.socketCorsOrigin;
    config.razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || config.razorpayWebhookSecret;
    config.emailHost = process.env.EMAIL_HOST || config.emailHost;
    config.emailPort = Number(process.env.EMAIL_PORT) || config.emailPort;
    config.emailUser = process.env.EMAIL_USER || config.emailUser;
    config.emailPass = process.env.EMAIL_PASS ? String(process.env.EMAIL_PASS).replace(/\s/g, '') : config.emailPass;
    config.emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || config.emailFrom;
    config.petpoojaSyncEnabled = process.env.PETPOOJA_SYNC_ENABLED === 'true';
    config.petpoojaAppKey = process.env.PETPOOJA_APP_KEY || config.petpoojaAppKey;
    config.petpoojaAppSecret = process.env.PETPOOJA_APP_SECRET || config.petpoojaAppSecret;
    config.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || config.googleMapsApiKey;

    if (config.obd) {
        config.obd.apiUrl = process.env.OBD_API_URL || config.obd.apiUrl;
        config.obd.ukey = process.env.OBD_UKEY || config.obd.ukey;
        config.obd.serviceno = process.env.OBD_SERVICENO || config.obd.serviceno;
        config.obd.voicefile = process.env.OBD_VOICEFILE || config.obd.voicefile;
        config.obd.sourcetype = process.env.OBD_SOURCETYPE || config.obd.sourcetype;
        config.obd.campaigntype = process.env.OBD_CAMPAIGNTYPE || config.obd.campaigntype;
        config.obd.filetype = process.env.OBD_FILETYPE || config.obd.filetype;
        config.obd.ivrtemplateid = process.env.OBD_IVRTEMPLATEID || config.obd.ivrtemplateid;
        config.obd.retryduration = Number(process.env.OBD_RETRYDURATION ?? config.obd.retryduration);
        config.obd.dtmflength = process.env.OBD_DTMFLENGTH || config.obd.dtmflength;
        config.obd.waitduration = process.env.OBD_WAITDURATION || config.obd.waitduration;
    }
};
