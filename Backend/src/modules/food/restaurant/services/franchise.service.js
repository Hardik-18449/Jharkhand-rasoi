import mongoose from 'mongoose';
import { FoodFranchiseStock } from '../models/franchiseStock.model.js';
import { FoodFranchiseDailyReport } from '../models/franchiseDailyReport.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Get all stock inventory for a franchise restaurant.
 */
export async function getFranchiseStock(restaurantId) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const stocks = await FoodFranchiseStock.find({ restaurantId: new mongoose.Types.ObjectId(restaurantId) })
    .sort({ itemName: 1 })
    .lean();

  const formatted = stocks.map((item) => ({
    ...item,
    isLowStock: Number(item.currentStock || 0) <= Number(item.minimumThreshold || 0),
  }));

  const totalItems = formatted.length;
  const lowStockCount = formatted.filter((item) => item.isLowStock).length;

  return { stocks: formatted, totalItems, lowStockCount };
}

/**
 * Allocate or replenish stock for a franchise restaurant (Called by Admin).
 */
export async function allocateFranchiseStock(restaurantId, data = {}) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const restaurant = await FoodRestaurant.findById(restaurantId).select('restaurantName restaurantType').lean();
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  const itemName = String(data.itemName || '').trim();
  if (!itemName) {
    throw new ValidationError('Item name is required');
  }

  const quantity = Math.max(0, Number(data.quantity || 0));
  if (quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0');
  }

  const unit = String(data.unit || 'kg').trim().toLowerCase();
  const category = String(data.category || 'General').trim();
  const costPerUnit = Math.max(0, Number(data.costPerUnit || 0));
  const minimumThreshold = Math.max(0, Number(data.minimumThreshold ?? 5));
  const notes = String(data.notes || '').trim();
  const suppliedBy = String(data.suppliedBy || 'Admin').trim();

  // Check if item already exists
  let stockDoc = await FoodFranchiseStock.findOne({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    itemName: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });

  const historyEntry = {
    quantity,
    costPerUnit,
    notes,
    suppliedBy,
    suppliedAt: new Date(),
  };

  if (stockDoc) {
    stockDoc.currentStock = Number(stockDoc.currentStock || 0) + quantity;
    stockDoc.lastSuppliedQuantity = quantity;
    stockDoc.lastSuppliedAt = new Date();
    stockDoc.unit = unit || stockDoc.unit;
    stockDoc.costPerUnit = costPerUnit > 0 ? costPerUnit : stockDoc.costPerUnit;
    stockDoc.minimumThreshold = minimumThreshold;
    if (category) stockDoc.category = category;
    if (notes) stockDoc.notes = notes;
    stockDoc.supplyHistory.push(historyEntry);
    await stockDoc.save();
    logger.info(`[FranchiseStock] Replenished ${quantity} ${unit} of "${itemName}" for restaurant ${restaurantId}`);
  } else {
    stockDoc = await FoodFranchiseStock.create({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      itemName,
      category,
      unit,
      currentStock: quantity,
      minimumThreshold,
      costPerUnit,
      lastSuppliedQuantity: quantity,
      lastSuppliedAt: new Date(),
      notes,
      supplyHistory: [historyEntry],
    });
    logger.info(`[FranchiseStock] Created new stock item "${itemName}" with ${quantity} ${unit} for restaurant ${restaurantId}`);
  }

  return stockDoc.toObject();
}

/**
 * Remove a franchise stock item (Admin only).
 */
export async function removeFranchiseStock(restaurantId, stockId) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(stockId)) {
    throw new ValidationError('Invalid IDs provided');
  }

  const deleted = await FoodFranchiseStock.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(stockId),
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!deleted) {
    throw new NotFoundError('Stock item not found');
  }

  return { success: true };
}

/**
 * Submit daily sales and stock usage update (Called by Franchise Holder).
 */
export async function submitFranchiseDailyReport(restaurantId, reportData = {}) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const reportDate = reportData.reportDate ? new Date(reportData.reportDate) : new Date();
  reportDate.setHours(0, 0, 0, 0);

  const counterSalesAmount = Math.max(0, Number(reportData.counterSalesAmount || 0));
  const onlineSalesAmount = Math.max(0, Number(reportData.onlineSalesAmount || 0));
  const totalSalesAmount = counterSalesAmount + onlineSalesAmount;
  const customerFootfall = Math.max(0, Number(reportData.customerFootfall || 0));
  const notes = String(reportData.notes || '').trim();
  const submittedBy = String(reportData.submittedBy || 'Franchise Holder').trim();

  const rawUsage = Array.isArray(reportData.stockUsage) ? reportData.stockUsage : [];
  const stockUsage = [];

  for (const item of rawUsage) {
    const itemName = String(item.itemName || '').trim();
    if (!itemName) continue;

    const openingStock = Math.max(0, Number(item.openingStock || 0));
    const quantityUsed = Math.max(0, Number(item.quantityUsed || 0));
    const wastedQuantity = Math.max(0, Number(item.wastedQuantity || 0));
    const closingStock = Math.max(0, Number(item.closingStock ?? (openingStock - quantityUsed - wastedQuantity)));

    stockUsage.push({
      stockId: item.stockId && mongoose.Types.ObjectId.isValid(item.stockId) ? new mongoose.Types.ObjectId(item.stockId) : undefined,
      itemName,
      unit: String(item.unit || 'kg').trim(),
      openingStock,
      quantityUsed,
      wastedQuantity,
      closingStock,
    });

    // Automatically update the live FoodFranchiseStock currentStock
    try {
      let query = null;
      if (item.stockId && mongoose.Types.ObjectId.isValid(item.stockId)) {
        query = { _id: new mongoose.Types.ObjectId(item.stockId), restaurantId: new mongoose.Types.ObjectId(restaurantId) };
      } else {
        query = {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          itemName: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        };
      }

      await FoodFranchiseStock.findOneAndUpdate(
        query,
        { $set: { currentStock: closingStock } }
      );
    } catch (err) {
      logger.warn(`Failed to auto-update stock balance for ${itemName}: ${err.message}`);
    }
  }

  const report = await FoodFranchiseDailyReport.create({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    reportDate,
    stockUsage,
    counterSalesAmount,
    onlineSalesAmount,
    totalSalesAmount,
    customerFootfall,
    notes,
    submittedBy,
    status: 'submitted',
  });

  logger.info(`[FranchiseReport] Daily report submitted for restaurant ${restaurantId} on ${reportDate.toISOString().slice(0, 10)}`);
  return report.toObject();
}

/**
 * List daily reports for a franchise outlet.
 */
export async function getFranchiseDailyReports(restaurantId, query = {}) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 30, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const filter = { restaurantId: new mongoose.Types.ObjectId(restaurantId) };

  if (query.startDate || query.endDate) {
    filter.reportDate = {};
    if (query.startDate) filter.reportDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.reportDate.$lte = new Date(query.endDate);
  }

  const [reports, total] = await Promise.all([
    FoodFranchiseDailyReport.find(filter)
      .sort({ reportDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodFranchiseDailyReport.countDocuments(filter),
  ]);

  return { reports, total, page, limit };
}
