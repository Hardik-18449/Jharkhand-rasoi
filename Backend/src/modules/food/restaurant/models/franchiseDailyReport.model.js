import mongoose from 'mongoose';

const stockUsageItemSchema = new mongoose.Schema(
  {
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodFranchiseStock',
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      default: 'kg',
    },
    openingStock: {
      type: Number,
      required: true,
      default: 0,
    },
    quantityUsed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    wastedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    closingStock: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: true }
);

const franchiseDailyReportSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodRestaurant',
      required: true,
      index: true,
    },
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    stockUsage: [stockUsageItemSchema],
    counterSalesAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    onlineSalesAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSalesAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    customerFootfall: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    submittedBy: {
      type: String,
      trim: true,
      default: 'Franchise Manager',
    },
    status: {
      type: String,
      enum: ['submitted', 'verified', 'flagged'],
      default: 'submitted',
    },
  },
  {
    collection: 'food_franchise_daily_reports',
    timestamps: true,
  }
);

franchiseDailyReportSchema.index({ restaurantId: 1, reportDate: -1 });

export const FoodFranchiseDailyReport = mongoose.model(
  'FoodFranchiseDailyReport',
  franchiseDailyReportSchema
);
