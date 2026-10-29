import { sendResponse, sendError } from '../../../../utils/response.js';
import * as franchiseService from '../services/franchise.service.js';

// ---- Restaurant Controllers (Franchise Holder Panel) ----

export const getMyFranchiseStockController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const data = await franchiseService.getFranchiseStock(restaurantId);
    return sendResponse(res, 200, 'Franchise stock fetched successfully', data);
  } catch (error) {
    next(error);
  }
};

export const submitMyFranchiseDailyReportController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const report = await franchiseService.submitFranchiseDailyReport(restaurantId, {
      ...req.body,
      submittedBy: req.user?.name || req.body?.submittedBy || 'Franchise Holder',
    });
    return sendResponse(res, 201, 'Daily sales & stock usage report submitted successfully', { report });
  } catch (error) {
    next(error);
  }
};

export const getMyFranchiseDailyReportsController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const data = await franchiseService.getFranchiseDailyReports(restaurantId, req.query);
    return sendResponse(res, 200, 'Daily reports fetched successfully', data);
  } catch (error) {
    next(error);
  }
};

// ---- Admin Controllers ----

export const getAdminFranchiseStockController = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const data = await franchiseService.getFranchiseStock(restaurantId);
    return sendResponse(res, 200, 'Franchise stock fetched successfully', data);
  } catch (error) {
    next(error);
  }
};

export const allocateAdminFranchiseStockController = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const stock = await franchiseService.allocateFranchiseStock(restaurantId, {
      ...req.body,
      suppliedBy: req.user?.name || req.user?.email || 'Admin',
    });
    return sendResponse(res, 200, 'Stock allocated successfully', { stock });
  } catch (error) {
    next(error);
  }
};

export const removeAdminFranchiseStockController = async (req, res, next) => {
  try {
    const { restaurantId, stockId } = req.params;
    const result = await franchiseService.removeFranchiseStock(restaurantId, stockId);
    return sendResponse(res, 200, 'Stock item removed successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getAdminFranchiseReportsController = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const data = await franchiseService.getFranchiseDailyReports(restaurantId, req.query);
    return sendResponse(res, 200, 'Franchise daily reports fetched successfully', data);
  } catch (error) {
    next(error);
  }
};
