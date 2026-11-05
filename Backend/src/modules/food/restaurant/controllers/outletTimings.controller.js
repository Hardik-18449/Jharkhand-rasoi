import { sendResponse } from '../../../../utils/response.js';
import { getOutletTimingsForRestaurant, upsertOutletTimingsForRestaurant } from '../services/outletTimings.service.js';

export const getOutletTimingsByRestaurantIdController = async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        const data = await getOutletTimingsForRestaurant(req.params.id);
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getCurrentRestaurantOutletTimingsController = async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const restaurantId = req.user?.userId;
        const data = await getOutletTimingsForRestaurant(restaurantId);
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const upsertCurrentRestaurantOutletTimingsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await upsertOutletTimingsForRestaurant(restaurantId, req.body?.outletTimings);
        return sendResponse(res, 200, 'Outlet timings saved successfully', data);
    } catch (error) {
        next(error);
    }
};

