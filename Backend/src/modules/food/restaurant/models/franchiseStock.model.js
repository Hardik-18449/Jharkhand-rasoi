import mongoose from 'mongoose';

const supplyHistoryItemSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 0 },
    costPerUnit: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: '' },
    suppliedBy: { type: String, trim: true, default: 'Admin' },
    suppliedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const franchiseStockSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodRestaurant',
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    unit: {
      type: String,
      trim: true,
      default: 'kg', // kg, litre, packet, box, piece, etc.
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minimumThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    costPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSuppliedQuantity: {
      type: Number,
      default: 0,
    },
    lastSuppliedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    supplyHistory: [supplyHistoryItemSchema],
  },
  {
    collection: 'food_franchise_stocks',
    timestamps: true,
  }
);

franchiseStockSchema.index({ restaurantId: 1, itemName: 1 });

export const FoodFranchiseStock = mongoose.model('FoodFranchiseStock', franchiseStockSchema);
