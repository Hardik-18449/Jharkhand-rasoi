import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodCombo } from '../models/foodCombo.model.js';
import { FoodItem } from '../../admin/models/food.model.js';

const resolveApprovedRestaurant = async (restaurantIdOrSlug) => {
    const value = String(restaurantIdOrSlug || '').trim();
    if (!value) throw new ValidationError('Restaurant id is required');
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        return FoodRestaurant.findOne({ _id: value, status: 'approved' }).select('_id').lean();
    }
    const normalized = value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
    return FoodRestaurant.findOne({ restaurantNameNormalized: normalized, status: 'approved' }).select('_id').lean();
};

export const toPublicCombo = (doc) => {
    const p = doc.published;
    const comboPrice = Number(p.comboPrice) || 0;
    const originalPrice = Number(p.originalPrice) || 0;
    return {
        id: doc._id,
        _id: doc._id,
        name: p.name || '',
        description: p.description || '',
        image: p.image || '',
        images: Array.isArray(p.images) ? p.images : [],
        comboPrice,
        price: comboPrice,
        originalPrice,
        savings: Math.max(0, Math.round((originalPrice - comboPrice) * 100) / 100),
        foodType: p.foodType || 'Non-Veg',
        isVeg: p.foodType === 'Veg',
        items: (Array.isArray(p.items) ? p.items : []).map((it) => ({
            foodId: String(it.foodId || ''),
            name: it.name || '',
            variantId: it.variantId || '',
            variantName: it.variantName || '',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            image: it.image || '',
            foodType: it.foodType || 'Non-Veg'
        }))
    };
};

/**
 * Approved, available combos for the user app. A combo is hidden while any of its
 * dishes is out of stock or no longer approved, so customers never order a combo
 * the kitchen cannot make.
 */
export async function getPublicApprovedRestaurantCombos(restaurantIdOrSlug) {
    const restaurant = await resolveApprovedRestaurant(restaurantIdOrSlug);
    if (!restaurant?._id) return null;

    const combos = await FoodCombo.find({
        restaurantId: new mongoose.Types.ObjectId(String(restaurant._id)),
        isDeleted: { $ne: true },
        approvalStatus: 'approved',
        isAvailable: true,
        published: { $ne: null }
    })
        .sort({ approvedAt: -1, updatedAt: -1 })
        .select('_id published')
        .lean();

    const valid = (combos || []).filter(
        (c) => c?.published && Array.isArray(c.published.items) && c.published.items.length
    );
    if (valid.length === 0) return [];

    const foodIds = [
        ...new Set(valid.flatMap((c) => c.published.items.map((it) => String(it.foodId || ''))))
    ].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const foods = await FoodItem.find({ _id: { $in: foodIds } }).select('isAvailable approvalStatus').lean();
    const foodState = new Map(foods.map((f) => [String(f._id), f]));

    return valid
        .filter((c) =>
            c.published.items.every((it) => {
                const f = foodState.get(String(it.foodId || ''));
                return f && f.isAvailable !== false && (f.approvalStatus || 'approved') === 'approved';
            })
        )
        .map(toPublicCombo);
}
