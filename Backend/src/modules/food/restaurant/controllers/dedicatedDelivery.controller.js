import { sendResponse, sendError } from '../../../../utils/response.js';
import * as dedicatedDeliveryService from '../services/dedicatedDelivery.service.js';

export const getDedicatedRidersController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const data = await dedicatedDeliveryService.getDedicatedDeliveryOverview(restaurantId);
    return sendResponse(res, 200, 'Dedicated delivery overview fetched successfully', data);
  } catch (error) {
    next(error);
  }
};

export const addDedicatedRiderController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const rider = await dedicatedDeliveryService.addDedicatedRider(restaurantId, req.body || {});
    return sendResponse(res, 201, 'Dedicated delivery partner added successfully', { rider });
  } catch (error) {
    next(error);
  }
};

export const removeDedicatedRiderController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const { id: riderId } = req.params;
    const result = await dedicatedDeliveryService.removeDedicatedRider(restaurantId, riderId);
    return sendResponse(res, 200, 'Dedicated delivery partner removed successfully', result);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryDispatchToggleController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const settings = await dedicatedDeliveryService.updateDeliveryDispatchToggle(restaurantId, req.body || {});
    return sendResponse(res, 200, 'Delivery dispatch settings updated successfully', { deliverySettings: settings });
  } catch (error) {
    next(error);
  }
};
