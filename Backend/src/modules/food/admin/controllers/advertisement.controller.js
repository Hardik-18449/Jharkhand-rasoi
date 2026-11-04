import mongoose from 'mongoose';
import { FoodAdvertisement } from '../models/advertisement.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function getAdminAdvertisements(req, res, next) {
    try {
        const ads = await FoodAdvertisement.find({})
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();
        res.status(200).json({
            success: true,
            data: { advertisements: ads }
        });
    } catch (error) {
        next(error);
    }
}

export async function createAdvertisement(req, res, next) {
    try {
        const { title, posterUrl, isActive, sortOrder } = req.body;
        const trimmedTitle = String(title || '').trim();
        const trimmedPoster = String(posterUrl || '').trim();

        if (!trimmedTitle) {
            throw new ValidationError('Offer / Ad name is required');
        }
        if (!trimmedPoster) {
            throw new ValidationError('Poster image is required');
        }

        const ad = await FoodAdvertisement.create({
            title: trimmedTitle,
            posterUrl: trimmedPoster,
            isActive: isActive !== false,
            sortOrder: Number(sortOrder) || 0
        });

        res.status(201).json({
            success: true,
            message: 'Advertisement created successfully',
            data: { advertisement: ad }
        });
    } catch (error) {
        next(error);
    }
}

export async function updateAdvertisement(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError('Invalid advertisement ID');
        }

        const { title, posterUrl, isActive, sortOrder } = req.body;
        const update = {};
        if (title !== undefined) update.title = String(title).trim();
        if (posterUrl !== undefined) update.posterUrl = String(posterUrl).trim();
        if (isActive !== undefined) update.isActive = Boolean(isActive);
        if (sortOrder !== undefined) update.sortOrder = Number(sortOrder) || 0;

        const updated = await FoodAdvertisement.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true }
        ).lean();

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Advertisement not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Advertisement updated successfully',
            data: { advertisement: updated }
        });
    } catch (error) {
        next(error);
    }
}

export async function toggleAdvertisementStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError('Invalid advertisement ID');
        }

        const ad = await FoodAdvertisement.findById(id);
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Advertisement not found' });
        }

        ad.isActive = !ad.isActive;
        await ad.save();

        res.status(200).json({
            success: true,
            message: `Advertisement ${ad.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { advertisement: ad }
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteAdvertisement(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            throw new ValidationError('Invalid advertisement ID');
        }

        const deleted = await FoodAdvertisement.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Advertisement not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Advertisement deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}

export async function getPublicAdvertisements(req, res, next) {
    try {
        const ads = await FoodAdvertisement.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .select('_id title posterUrl sortOrder createdAt')
            .lean();

        res.status(200).json({
            success: true,
            data: { advertisements: ads }
        });
    } catch (error) {
        next(error);
    }
}
