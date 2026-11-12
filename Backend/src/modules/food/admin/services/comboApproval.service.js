import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodCombo } from '../../restaurant/models/foodCombo.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { normalizeStoredUploadPath } from '../../../../services/upload.service.js';
import { invalidateCache } from '../../../../middleware/cache.js';
import { assertComboPrice, buildComboItemsSnapshot } from '../../restaurant/services/restaurantCombo.service.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const bustPublicCombos = async () => {
    try {
        await invalidateCache('restaurant_combos:*');
    } catch (e) {
        // best-effort
    }
};

const serializeAdminCombo = (c) => ({
    id: c._id,
    _id: c._id,
    restaurantId: c.restaurantId?._id ? String(c.restaurantId._id) : String(c.restaurantId),
    restaurant: c.restaurantId?._id
        ? {
            _id: c.restaurantId._id,
            name: c.restaurantId.restaurantName || '',
            ownerName: c.restaurantId.ownerName || '',
            ownerPhone: c.restaurantId.ownerPhone || ''
        }
        : null,
    approvalStatus: c.approvalStatus || 'pending',
    rejectionReason: c.rejectionReason || '',
    requestedAt: c.requestedAt,
    approvedAt: c.approvedAt,
    rejectedAt: c.rejectedAt,
    isAvailable: c.isAvailable !== false,
    draft: c.draft || null,
    published: c.published || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
});

export async function getRestaurantCombosAdmin(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };
    const approvalStatus = String(query.approvalStatus || '').trim();
    if (approvalStatus && ['pending', 'approved', 'rejected'].includes(approvalStatus)) {
        filter.approvalStatus = approvalStatus;
    }
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(String(query.restaurantId))) {
        filter.restaurantId = new mongoose.Types.ObjectId(String(query.restaurantId));
    }
    if (query.search && String(query.search).trim()) {
        const term = escapeRegex(String(query.search).trim().slice(0, 80));
        const matchingRestaurants = await FoodRestaurant.find({ restaurantName: { $regex: term, $options: 'i' } })
            .select('_id')
            .lean();
        filter.$or = [
            { 'draft.name': { $regex: term, $options: 'i' } },
            { restaurantId: { $in: matchingRestaurants.map((r) => r._id) } }
        ];
    }

    const [list, total] = await Promise.all([
        FoodCombo.find(filter)
            .sort({ requestedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('restaurantId', 'restaurantName ownerName ownerPhone')
            .lean(),
        FoodCombo.countDocuments(filter)
    ]);

    return { combos: list.map(serializeAdminCombo), total, page, limit };
}

/**
 * Admin edit. Applies to the draft, and to the published copy too when the combo is
 * already approved, so the change goes live without another approval round.
 */
export async function updateRestaurantComboAdmin(comboId, body = {}) {
    if (!comboId || !mongoose.Types.ObjectId.isValid(String(comboId))) return null;
    const combo = await FoodCombo.findOne({ _id: comboId, isDeleted: { $ne: true } });
    if (!combo) return null;

    const patch = {};
    if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Combo name is required');
        patch.name = name;
    }
    if (body.description !== undefined) patch.description = String(body.description || '').trim();
    if (body.image !== undefined) patch.image = normalizeStoredUploadPath(body.image);
    if (body.images !== undefined && Array.isArray(body.images)) {
        patch.images = body.images
            .map((img) => normalizeStoredUploadPath(typeof img === 'string' ? img : img?.url))
            .filter(Boolean);
    } else if (patch.image) {
        patch.images = [patch.image];
    }
    if (body.items !== undefined) {
        const snapshot = await buildComboItemsSnapshot(combo.restaurantId, body.items);
        patch.items = snapshot.items;
        patch.originalPrice = snapshot.originalPrice;
        patch.foodType = snapshot.foodType;
    }
    if (body.comboPrice !== undefined || patch.originalPrice !== undefined) {
        const originalPrice = patch.originalPrice ?? (Number(combo.draft?.originalPrice) || 0);
        const price = body.comboPrice !== undefined ? body.comboPrice : combo.draft?.comboPrice;
        patch.comboPrice = assertComboPrice(price, originalPrice);
    }

    if (Object.keys(patch).length > 0) {
        combo.draft = { ...(combo.draft?.toObject ? combo.draft.toObject() : combo.draft || {}), ...patch };
        if (combo.approvalStatus === 'approved') {
            combo.published = { ...(combo.published?.toObject ? combo.published.toObject() : combo.published || {}), ...patch };
        }
    }
    if (body.isAvailable !== undefined) combo.isAvailable = body.isAvailable === true;

    await combo.save();
    await bustPublicCombos();
    return serializeAdminCombo(combo.toObject());
}

export async function approveRestaurantCombo(comboId) {
    if (!comboId || !mongoose.Types.ObjectId.isValid(String(comboId))) return null;

    const updated = await FoodCombo.findOneAndUpdate(
        { _id: comboId, isDeleted: { $ne: true } },
        [
            {
                $set: {
                    published: '$draft',
                    approvalStatus: 'approved',
                    approvedAt: '$$NOW',
                    rejectedAt: null,
                    rejectionReason: ''
                }
            }
        ],
        { new: true }
    ).lean();

    if (updated?.restaurantId) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely([{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }], {
                title: 'Combo Approved!',
                body: `Your combo "${updated.published?.name || 'New Combo'}" has been approved and is now live.`,
                data: {
                    type: 'combo_approved',
                    comboId: String(updated._id),
                    restaurantId: String(updated.restaurantId)
                }
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to send combo approval notification:', e);
        }
    }

    await bustPublicCombos();
    return updated || null;
}

export async function rejectRestaurantCombo(comboId, reason) {
    if (!comboId || !mongoose.Types.ObjectId.isValid(String(comboId))) return null;
    const rejectionReason = String(reason || '').trim();
    if (!rejectionReason) throw new ValidationError('Rejection reason is required');

    const updated = await FoodCombo.findOneAndUpdate(
        { _id: comboId, isDeleted: { $ne: true } },
        { $set: { approvalStatus: 'rejected', rejectionReason, rejectedAt: new Date() } },
        { new: true }
    ).lean();

    if (updated?.restaurantId) {
        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely([{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }], {
                title: 'Combo Rejected',
                body: `Your combo request for "${updated.draft?.name || 'New Combo'}" was rejected. Reason: ${rejectionReason}`,
                data: {
                    type: 'combo_rejected',
                    comboId: String(updated._id),
                    restaurantId: String(updated.restaurantId),
                    reason: rejectionReason
                }
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to send combo rejection notification:', e);
        }
    }

    await bustPublicCombos();
    return updated || null;
}
