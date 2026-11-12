import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodCombo } from '../models/foodCombo.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { normalizeStoredUploadPath } from '../../../../services/upload.service.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const normalizePayload = (p) => {
    if (!p) return null;
    return {
        name: p.name || '',
        description: p.description || '',
        image: p.image || '',
        images: Array.isArray(p.images) ? p.images : [],
        comboPrice: Number(p.comboPrice) || 0,
        originalPrice: Number(p.originalPrice) || 0,
        foodType: p.foodType || 'Non-Veg',
        items: Array.isArray(p.items)
            ? p.items.map((it) => ({
                foodId: it.foodId ? String(it.foodId) : '',
                name: it.name || '',
                variantId: it.variantId || '',
                variantName: it.variantName || '',
                quantity: Number(it.quantity) || 1,
                unitPrice: Number(it.unitPrice) || 0,
                image: it.image || '',
                foodType: it.foodType || 'Non-Veg'
            }))
            : []
    };
};

export const normalizeComboDoc = (doc) => {
    if (!doc) return null;
    const draft = normalizePayload(doc.draft) || {};
    return {
        _id: doc._id,
        id: doc._id,
        restaurantId: doc.restaurantId,
        approvalStatus: doc.approvalStatus || 'pending',
        rejectionReason: doc.rejectionReason || '',
        requestedAt: doc.requestedAt,
        approvedAt: doc.approvedAt,
        rejectedAt: doc.rejectedAt,
        isAvailable: doc.isAvailable !== false,
        // Draft fields (what restaurant edits)
        ...draft,
        // Published snapshot (what user app sees)
        published: normalizePayload(doc.published),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
};

/**
 * Resolve the dishes picked by the restaurant against its own catalog and build the
 * snapshot stored in the combo. Throws if any dish does not belong to the restaurant.
 */
export async function buildComboItemsSnapshot(restaurantId, rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    if (list.length < 2) throw new ValidationError('Select at least 2 items for the combo');

    const ids = list.map((it) => String(it?.foodId || ''));
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        throw new ValidationError('Invalid combo item');
    }

    const foods = await FoodItem.find({
        _id: { $in: ids },
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId))
    })
        .select('name price variants image foodType approvalStatus')
        .lean();
    const foodById = new Map(foods.map((f) => [String(f._id), f]));

    const items = list.map((it) => {
        const food = foodById.get(String(it.foodId));
        if (!food) throw new ValidationError('One of the selected items is not on your menu');
        if (food.approvalStatus === 'rejected') {
            throw new ValidationError(`"${food.name}" is rejected and cannot be part of a combo`);
        }
        const variants = Array.isArray(food.variants) ? food.variants : [];
        let variant = null;
        const wantedVariantId = String(it.variantId || '').trim();
        if (variants.length > 0) {
            variant = wantedVariantId
                ? variants.find((v) => String(v._id) === wantedVariantId)
                : variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), variants[0]);
            if (!variant) throw new ValidationError(`Selected size for "${food.name}" was not found`);
        }
        const unitPrice = Number(variant ? variant.price : food.price) || 0;
        return {
            foodId: food._id,
            name: food.name,
            variantId: variant ? String(variant._id) : '',
            variantName: variant ? String(variant.name || '') : '',
            quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
            unitPrice,
            image: food.image || '',
            foodType: food.foodType === 'Veg' ? 'Veg' : 'Non-Veg'
        };
    });

    // Merge duplicate (dish, variant) rows into one line.
    const merged = [];
    for (const item of items) {
        const key = `${item.foodId}::${item.variantId}`;
        const existing = merged.find((m) => `${m.foodId}::${m.variantId}` === key);
        if (existing) existing.quantity += item.quantity;
        else merged.push(item);
    }
    if (merged.reduce((s, m) => s + m.quantity, 0) < 2) {
        throw new ValidationError('A combo needs at least 2 items');
    }

    const originalPrice = round2(merged.reduce((sum, m) => sum + m.unitPrice * m.quantity, 0));
    const foodType = merged.every((m) => m.foodType === 'Veg') ? 'Veg' : 'Non-Veg';
    return { items: merged, originalPrice, foodType };
}

export const assertComboPrice = (comboPrice, originalPrice) => {
    const price = Number(comboPrice);
    if (!Number.isFinite(price) || price <= 0) throw new ValidationError('Combo price must be greater than 0');
    if (originalPrice > 0 && price > originalPrice) {
        throw new ValidationError(`Combo price must not exceed the items total (Rs. ${originalPrice})`);
    }
    return round2(price);
};

export async function listRestaurantCombos(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const status = String(query.status || '').trim();
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';

    const filter = {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
        ...(query.includeDeleted === true ? {} : { isDeleted: { $ne: true } })
    };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.approvalStatus = status;
    if (search) filter['draft.name'] = { $regex: escapeRegex(search), $options: 'i' };

    const [list, total] = await Promise.all([
        FoodCombo.find(filter).sort({ requestedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodCombo.countDocuments(filter)
    ]);

    return { combos: list.map(normalizeComboDoc), total, page, limit };
}

export async function createRestaurantCombo(restaurantId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const name = String(body?.name || '').trim();
    if (!name) throw new ValidationError('Combo name is required');

    const exists = await FoodCombo.findOne({
        restaurantId: rid,
        isDeleted: { $ne: true },
        'draft.name': { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    })
        .select('_id')
        .lean();
    if (exists?._id) throw new ValidationError('A combo with this name already exists');

    const { items, originalPrice, foodType } = await buildComboItemsSnapshot(rid, body.items);
    const comboPrice = assertComboPrice(body.comboPrice, originalPrice);

    const doc = await FoodCombo.create({
        restaurantId: rid,
        draft: {
            name,
            description: String(body.description || '').trim(),
            image: normalizeStoredUploadPath(body.image),
            images: Array.isArray(body.images)
                ? body.images.map((image) => normalizeStoredUploadPath(image)).filter(Boolean).slice(0, 10)
                : [],
            comboPrice,
            originalPrice,
            items,
            foodType
        },
        published: null,
        approvalStatus: 'pending',
        rejectionReason: '',
        requestedAt: new Date(),
        approvedAt: null,
        rejectedAt: null,
        isAvailable: true,
        isDeleted: false
    });

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Combo Approval Request',
            body: `Restaurant has submitted a new combo "${name}" for approval.`,
            data: { type: 'approval_request', subType: 'combo', id: String(doc._id) }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to notify admins of new combo approval request:', e);
    }

    return normalizeComboDoc(doc.toObject());
}

export async function updateRestaurantCombo(restaurantId, comboId, updateDto) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!comboId || !mongoose.Types.ObjectId.isValid(String(comboId))) {
        throw new ValidationError('Invalid combo id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const _id = new mongoose.Types.ObjectId(String(comboId));

    const existing = await FoodCombo.findOne({ _id, restaurantId: rid, isDeleted: { $ne: true } }).lean();
    if (!existing) return null;

    const set = {};
    if (updateDto?.isAvailable !== undefined) set.isAvailable = updateDto.isAvailable !== false;

    if (updateDto?.draft) {
        const d = updateDto.draft;
        if (d.name !== undefined) {
            const name = String(d.name || '').trim();
            if (!name) throw new ValidationError('Combo name is required');
            const dup = await FoodCombo.findOne({
                restaurantId: rid,
                isDeleted: { $ne: true },
                _id: { $ne: _id },
                'draft.name': { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
            })
                .select('_id')
                .lean();
            if (dup?._id) throw new ValidationError('A combo with this name already exists');
            set['draft.name'] = name;
        }
        if (d.description !== undefined) set['draft.description'] = String(d.description || '').trim();
        if (d.image !== undefined) set['draft.image'] = normalizeStoredUploadPath(d.image);
        if (d.images !== undefined && Array.isArray(d.images)) {
            set['draft.images'] = d.images.map((image) => normalizeStoredUploadPath(image)).filter(Boolean).slice(0, 10);
        }

        let originalPrice = Number(existing.draft?.originalPrice) || 0;
        if (d.items !== undefined) {
            const snapshot = await buildComboItemsSnapshot(rid, d.items);
            set['draft.items'] = snapshot.items;
            set['draft.originalPrice'] = snapshot.originalPrice;
            set['draft.foodType'] = snapshot.foodType;
            originalPrice = snapshot.originalPrice;
        }
        const comboPrice = d.comboPrice !== undefined ? d.comboPrice : existing.draft?.comboPrice;
        set['draft.comboPrice'] = assertComboPrice(comboPrice, originalPrice);

        // Any draft content change must go through admin approval again.
        set.approvalStatus = 'pending';
        set.rejectionReason = '';
        set.requestedAt = new Date();
        set.approvedAt = null;
        set.rejectedAt = null;
    }

    if (Object.keys(set).length === 0) return normalizeComboDoc(existing);

    const updated = await FoodCombo.findOneAndUpdate(
        { _id, restaurantId: rid, isDeleted: { $ne: true } },
        { $set: set },
        { new: true }
    ).lean();
    return updated ? normalizeComboDoc(updated) : null;
}

export async function deleteRestaurantCombo(restaurantId, comboId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!comboId || !mongoose.Types.ObjectId.isValid(String(comboId))) {
        throw new ValidationError('Invalid combo id');
    }
    const updated = await FoodCombo.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(String(comboId)),
            restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
            isDeleted: { $ne: true }
        },
        { $set: { isDeleted: true } },
        { new: true }
    ).lean();
    return updated ? { id: updated._id } : null;
}
