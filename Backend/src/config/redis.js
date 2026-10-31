import { createClient } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;

/**
 * Creates a new Redis client instance based on configuration.
 * @returns {import('redis').RedisClientType|null}
 */
export const createRedisClient = () => {
    if (!config.redisUrl) {
        logger.warn('Redis URL not provided, Redis client will not be created.');
        return null;
    }

    const client = createClient({
        url: config.redisUrl,
        socket: {
            connectTimeout: 4000,
            reconnectStrategy: (retries) => {
                if (retries > 2) {
                    logger.warn('[Redis] Max connection retries exceeded (2). Stopping reconnect loop.');
                    return false;
                }
                return Math.min(retries * 500, 1500);
            }
        }
    });

    client.on('error', (err) => logger.error(`Redis Client Error: ${err.message}`));
    client.on('connect', () => logger.info('Redis connecting...'));
    client.on('ready', () => logger.info('Redis client ready'));
    client.on('end', () => logger.warn('Redis client disconnected'));

    return client;
};

/**
 * Connects to Redis if REDIS_ENABLED is true.
 * Times out gracefully after 4s so the API server is never blocked from starting.
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
export const connectRedis = async () => {
    const isRedisEnabled = config.redisEnabled;

    if (!isRedisEnabled) {
        logger.info('Redis is disabled via REDIS_ENABLED flag.');
        return null;
    }

    try {
        if (!redisClient) {
            redisClient = createRedisClient();
        }

        if (redisClient) {
            const connectPromise = redisClient.connect();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Redis connection timed out after 4000ms')), 4000)
            );
            await Promise.race([connectPromise, timeoutPromise]);
            logger.info('Successfully connected to Redis');
            return redisClient;
        }
        return null;
    } catch (error) {
        logger.error(`Failed to connect to Redis: ${error.message}`);
        if (redisClient) {
            try {
                await redisClient.disconnect();
            } catch (_) {}
            redisClient = null;
        }
        return null;
    }
};

/**
 * Returns the existing Redis client.
 * @returns {import('redis').RedisClientType|null}
 */
export const getRedisClient = () => {
    return redisClient;
};

/**
 * Close Redis connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis connection closed');
    }
};
