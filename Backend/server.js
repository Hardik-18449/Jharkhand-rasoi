import http from 'http';
import app from './src/app.js';
import dns from "node:dns/promises";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import { config } from './src/config/env.js';
import { validateConfig } from './src/config/validateEnv.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { connectRedis, closeRedis, getRedisClient } from './src/config/redis.js';
import { initializeQueues, closeBullMQConnection } from './src/queues/index.js';

import { logger } from './src/utils/logger.js';
import { initializeFirebaseRealtime } from './src/config/firebase.js';
import { loadEnvFromDb } from './src/config/envLoader.js';
import { initRedisEmitter } from './src/config/socket.js';
import { logVoipConfigurationWarnings } from './src/core/notifications/voip.service.js';

const SHUTDOWN_TIMEOUT_MS = 10000;
let server = null;

const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, starting graceful shutdown`);
    if (!server) {
        process.exit(0);
        return;
    }
    server.close(async () => {
        try {
            await disconnectDB();
            await closeRedis();
            await closeBullMQConnection();
            logger.info('Graceful shutdown complete');
            process.exit(0);
        } catch (err) {
            logger.error(`Shutdown error: ${err.message}`);
            process.exit(1);
        }
    });
    setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
};

const startServer = async () => {
    try {
        validateConfig();
        logger.info(
            `[Bootstrap] Starting API server with socketMode=external redisEnabled=${config.redisEnabled} bullmqEnabled=${config.bullmqEnabled} host=${config.host} port=${config.port} socketPort=${config.socketPort}`
        );
        // 1. Connect to Database (MongoDB)
        await connectDB();

        // 1.5 Load Environment Variables from Database overrides
        await loadEnvFromDb();
        initializeFirebaseRealtime();
        logVoipConfigurationWarnings();

        // 2. Create HTTP server from Express app
        const httpServer = http.createServer(app);

        let redisConnected = false;
        if (config.redisEnabled) {
            logger.info('[Bootstrap] Redis is enabled for API server; connecting Redis client for socket emitter/queues');
            try {
                const client = await connectRedis();
                if (client && client.isOpen) {
                    initRedisEmitter(client);
                    redisConnected = true;
                    logger.info('[Bootstrap] Redis emitter setup successfully on API server');
                } else {
                    logger.warn('[Bootstrap] Redis connection failed; falling back to embedded Socket.IO');
                }
            } catch (err) {
                logger.warn(`[Bootstrap] Redis connection error: ${err.message}; falling back to embedded Socket.IO`);
            }
        }

        if (!redisConnected) {
            const { initSocket } = await import('./src/config/socket.js');
            await initSocket(httpServer);
            logger.info(`[Bootstrap] Embedded Socket.IO initialized on API server port ${config.port}`);
        }

        // Watchdog recovered stuck orders is moved to scheduler-server.js

        // 5. Conditionally initialize BullMQ queues.
        // BullMQ requires Redis; skip queue bootstrap when Redis is disabled or offline.
        if (config.bullmqEnabled && config.redisEnabled && redisConnected) {
            try {
                initializeQueues();
            } catch (err) {
                logger.error(`BullMQ initialization error (server continues): ${err.message}`);
            }
        } else if (config.bullmqEnabled && (!config.redisEnabled || !redisConnected)) {
            logger.warn('BullMQ is enabled but Redis is disabled or offline. Queue initialization skipped.');
        }

        // 6. Start the HTTP server
        server = httpServer.listen(config.port, config.host, () => {
            logger.info(`Server running in ${config.nodeEnv} mode on ${config.host}:${config.port}`);
            console.log(`🌐 [URL] http://localhost:${config.port}`);
        });

        // Schedulers (expire offers, fssai sync, call alerts) are in scheduler-server.js
        if (config.nodeEnv !== 'production' && process.env.RUN_SCHEDULER_IN_DEV === 'true') {
            try {
                const { pollAndTriggerRestaurantCallAlerts } = await import('./src/modules/food/orders/services/order-call-alert.service.js');
                setInterval(pollAndTriggerRestaurantCallAlerts, 30 * 1000);
                logger.info('[Dev] Restaurant OBD call alert poller active in API server');
            } catch (err) {
                logger.error(`[Dev] Call alert poller startup error: ${err.message}`);
            }
        }

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

        // Handle server errors (like EADDRINUSE)
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use. Please kill the process or use a different port.`);
            } else {
                logger.error(`Server Error: ${err.message}`);
            }
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err) => {
            logger.error(`Unhandled Rejection: ${err?.message || err}`);
            if (config.nodeEnv === 'production') {
                if (server) server.close(() => process.exit(1));
                else process.exit(1);
            }
        });

        process.on('uncaughtException', (err) => {
            logger.error(`Uncaught Exception: ${err?.message || err}`);
            if (config.nodeEnv === 'production') {
                process.exit(1);
            }
        });

    } catch (error) {
        logger.error(`Error starting server: ${error.message}`);
        process.exit(1);
    }
};

startServer();


