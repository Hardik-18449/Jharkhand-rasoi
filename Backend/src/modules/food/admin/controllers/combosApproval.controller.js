import mongoose from 'mongoose';
import * as comboApprovalService from '../services/comboApproval.service.js';
import { validateAddonAdminListQuery, validateAddonRejectDto } from '../validators/addonApproval.validator.js';

const badId = (res) => res.status(400).json({ success: false, message: 'Invalid combo id' });
const notFound = (res) => res.status(404).json({ success: false, message: 'Combo not found' });

export async function getRestaurantCombos(req, res, next) {
    try {
        const query = validateAddonAdminListQuery(req.query || {});
        const data = await comboApprovalService.getRestaurantCombosAdmin(query);
        res.status(200).json({ success: true, message: 'Restaurant combos fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveRestaurantCombo(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return badId(res);
        const updated = await comboApprovalService.approveRestaurantCombo(id);
        if (!updated) return notFound(res);
        res.status(200).json({ success: true, message: 'Combo approved successfully', data: { combo: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectRestaurantCombo(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return badId(res);
        const { reason } = validateAddonRejectDto(req.body || {});
        const updated = await comboApprovalService.rejectRestaurantCombo(id, reason);
        if (!updated) return notFound(res);
        res.status(200).json({ success: true, message: 'Combo rejected successfully', data: { combo: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateRestaurantCombo(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return badId(res);
        const updated = await comboApprovalService.updateRestaurantComboAdmin(id, req.body || {});
        if (!updated) return notFound(res);
        res.status(200).json({ success: true, message: 'Combo updated successfully', data: { combo: updated } });
    } catch (error) {
        next(error);
    }
}
