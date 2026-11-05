import { sendResponse } from '../../../../utils/response.js';
import { getUserLocation, updateUserLocation, clearUserLocation } from '../services/userLocation.service.js';

export const getUserLocationController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await getUserLocation(userId);
        // Per-user, frequently changing data: never let the browser or a proxy reuse it (no 304s).
        res.set('Cache-Control', 'no-store, private, max-age=0');
        return sendResponse(res, 200, 'Location retrieved successfully', result);
    } catch (error) {
        next(error);
    }
};

export const clearUserLocationController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await clearUserLocation(userId);
        return sendResponse(res, 200, 'Location cleared successfully', result);
    } catch (error) {
        next(error);
    }
};

export const updateUserLocationController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await updateUserLocation(userId, req.body ?? {});
        return sendResponse(res, 200, 'Location updated successfully', result);
    } catch (error) {
        next(error);
    }
};
