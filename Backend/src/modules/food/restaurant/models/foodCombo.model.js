import mongoose from 'mongoose';

// One dish inside a combo. Snapshot of the catalog entry at the time the restaurant
// saved the combo, so the user app and orders can show the contents even if the dish
// is later renamed or repriced.
const comboItemSchema = new mongoose.Schema(
    {
        foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
        name: { type: String, required: true, trim: true },
        variantId: { type: String, trim: true, default: '' },
        variantName: { type: String, trim: true, default: '' },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        image: { type: String, trim: true, default: '' },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' }
    },
    { _id: false }
);

const comboPayloadSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        image: { type: String, trim: true, default: '' },
        images: { type: [String], default: [] },
        // Price the customer pays for the whole combo.
        comboPrice: { type: Number, required: true, min: 0 },
        // Sum of (unitPrice * quantity) for the dishes, used to show the saving.
        originalPrice: { type: Number, required: true, min: 0 },
        items: {
            type: [comboItemSchema],
            required: true,
            validate: {
                validator: (v) => Array.isArray(v) && v.length >= 2,
                message: 'A combo needs at least 2 items'
            }
        },
        // 'Veg' only when every dish in the combo is veg.
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' }
    },
    { _id: false }
);

const foodComboSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        // Draft is what restaurant is editing and what admin approves/rejects.
        draft: { type: comboPayloadSchema, required: true },
        // Published is what the user app can see (kept while draft is pending).
        published: { type: comboPayloadSchema, default: null },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true
        },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date, default: null, index: true },
        approvedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        // Operational toggle controlled by restaurant; user app filters on this.
        isAvailable: { type: Boolean, default: true, index: true },
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { collection: 'food_combos', timestamps: true }
);

foodComboSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: -1 });
foodComboSchema.index({ approvalStatus: 1, isDeleted: 1, requestedAt: -1 });
foodComboSchema.index({ restaurantId: 1, approvalStatus: 1, isDeleted: 1, requestedAt: -1 });

export const FoodCombo = mongoose.model('FoodCombo', foodComboSchema);
