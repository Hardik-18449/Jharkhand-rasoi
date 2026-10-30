import mongoose from 'mongoose';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { UserSubscription } from '../models/userSubscription.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { deductWalletBalance, getUserWallet } from '../../user/services/userWallet.service.js';

/**
 * =====================================================================
 * ADMIN PLAN MANAGEMENT
 * =====================================================================
 */

export async function createPlan(data) {
    const {
        name,
        description = '',
        badgeText = 'VIP',
        badgeColor = '#F59E0B',
        price,
        originalPrice = 0,
        durationDays = 30,
        priorityLevel = 1,
        features = [],
        freeDeliveryMinOrder = 0,
        discountPercent = 0,
        isActive = true,
        sortOrder = 0
    } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ValidationError('Plan name is required');
    }

    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
        throw new ValidationError('Price must be a valid non-negative number');
    }

    const numDuration = Number(durationDays);
    if (!Number.isFinite(numDuration) || numDuration < 1) {
        throw new ValidationError('Duration must be at least 1 day');
    }

    const plan = await SubscriptionPlan.create({
        name: name.trim(),
        description: (description || '').trim(),
        badgeText: (badgeText || 'VIP').trim(),
        badgeColor: (badgeColor || '#F59E0B').trim(),
        price: numPrice,
        originalPrice: Number(originalPrice) || 0,
        durationDays: numDuration,
        priorityLevel: Number(priorityLevel) || 1,
        features: Array.isArray(features) && features.length > 0 ? features : [
            'Priority Kitchen Cooking - Order Prepared First',
            'VIP High Priority Restaurant Tag',
            'Free Delivery on orders above ₹149',
            'VIP Badge on Profile & Orders',
            'Dedicated Customer Support'
        ],
        freeDeliveryMinOrder: Number(freeDeliveryMinOrder) || 0,
        discountPercent: Number(discountPercent) || 0,
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0
    });

    return plan;
}

export async function getAllPlansAdmin() {
    return SubscriptionPlan.find().sort({ sortOrder: 1, price: 1, createdAt: -1 }).lean();
}

export async function getPlanById(planId) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ValidationError('Invalid Plan ID');
    }
    const plan = await SubscriptionPlan.findById(planId).lean();
    if (!plan) throw new NotFoundError('Subscription plan not found');
    return plan;
}

export async function updatePlan(planId, data) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ValidationError('Invalid Plan ID');
    }
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new NotFoundError('Subscription plan not found');

    if (data.name !== undefined) plan.name = String(data.name).trim();
    if (data.description !== undefined) plan.description = String(data.description).trim();
    if (data.badgeText !== undefined) plan.badgeText = String(data.badgeText).trim();
    if (data.badgeColor !== undefined) plan.badgeColor = String(data.badgeColor).trim();
    if (data.price !== undefined) plan.price = Math.max(0, Number(data.price));
    if (data.originalPrice !== undefined) plan.originalPrice = Math.max(0, Number(data.originalPrice));
    if (data.durationDays !== undefined) plan.durationDays = Math.max(1, Number(data.durationDays));
    if (data.priorityLevel !== undefined) plan.priorityLevel = Math.max(1, Number(data.priorityLevel));
    if (data.features !== undefined && Array.isArray(data.features)) plan.features = data.features;
    if (data.freeDeliveryMinOrder !== undefined) plan.freeDeliveryMinOrder = Math.max(0, Number(data.freeDeliveryMinOrder));
    if (data.discountPercent !== undefined) plan.discountPercent = Math.min(100, Math.max(0, Number(data.discountPercent)));
    if (data.isActive !== undefined) plan.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) plan.sortOrder = Number(data.sortOrder);

    await plan.save();
    return plan;
}

export async function togglePlanStatus(planId) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ValidationError('Invalid Plan ID');
    }
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new NotFoundError('Subscription plan not found');

    plan.isActive = !plan.isActive;
    await plan.save();
    return plan;
}

export async function deletePlan(planId) {
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ValidationError('Invalid Plan ID');
    }
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) throw new NotFoundError('Subscription plan not found');

    // Check if there are active subscribers
    const activeSubscribersCount = await UserSubscription.countDocuments({
        planId: plan._id,
        status: 'active',
        expiresAt: { $gt: new Date() }
    });

    if (activeSubscribersCount > 0) {
        plan.isActive = false;
        await plan.save();
        return { message: 'Plan deactivated as active subscribers exist', plan, softDeleted: true };
    }

    await SubscriptionPlan.findByIdAndDelete(planId);
    return { message: 'Plan deleted successfully', planId, softDeleted: false };
}

export async function getAllSubscribersAdmin(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status) {
        filter.status = query.status;
    }

    const [docs, total] = await Promise.all([
        UserSubscription.find(filter)
            .populate('userId', 'name phone email profileImage')
            .populate('planId', 'name badgeText badgeColor price priorityLevel')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        UserSubscription.countDocuments(filter)
    ]);

    return {
        data: docs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
}

/**
 * =====================================================================
 * PUBLIC & CUSTOMER SUBSCRIPTION METHODS
 * =====================================================================
 */

export async function getActivePlansPublic() {
    return SubscriptionPlan.find({ isActive: true })
        .sort({ sortOrder: 1, price: 1 })
        .lean();
}

export async function getUserActiveSubscription(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID');
    }

    const user = await FoodUser.findById(userId)
        .select('name phone isSubscribed subscriptionPlanId subscriptionPlanName subscriptionBadge subscriptionPriority subscriptionExpiresAt')
        .lean();

    if (!user) throw new NotFoundError('User not found');

    const now = new Date();
    const isCurrentlySubscribed = Boolean(
        user.isSubscribed &&
        user.subscriptionExpiresAt &&
        new Date(user.subscriptionExpiresAt) > now
    );

    let activeRecord = null;
    if (isCurrentlySubscribed) {
        activeRecord = await UserSubscription.findOne({
            userId: user._id,
            status: 'active',
            expiresAt: { $gt: now }
        })
            .sort({ expiresAt: -1 })
            .lean();
    }

    const daysRemaining = isCurrentlySubscribed
        ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    return {
        isSubscribed: isCurrentlySubscribed,
        planName: isCurrentlySubscribed ? (user.subscriptionPlanName || activeRecord?.planName || 'VIP Club') : null,
        badgeText: isCurrentlySubscribed ? (user.subscriptionBadge || activeRecord?.badgeText || 'VIP') : null,
        priorityLevel: isCurrentlySubscribed ? (user.subscriptionPriority || activeRecord?.priorityLevel || 1) : 0,
        expiresAt: isCurrentlySubscribed ? user.subscriptionExpiresAt : null,
        daysRemaining,
        subscriptionDetails: activeRecord
    };
}

export async function subscribeUser(userId, { planId, paymentMethod = 'wallet' }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ValidationError('Invalid user ID');
    }
    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
        throw new ValidationError('Valid Plan ID is required');
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
        throw new ValidationError('Selected subscription plan is not available');
    }

    const user = await FoodUser.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const price = Number(plan.price) || 0;

    // Process payment
    let paymentTransactionId = '';
    if (price > 0) {
        if (paymentMethod === 'wallet') {
            const walletInfo = await getUserWallet(userId);
            const currentBalance = Number(walletInfo?.wallet?.balance || walletInfo?.balance || 0);
            if (currentBalance < price) {
                throw new ValidationError(`Insufficient wallet balance (Available: ₹${currentBalance.toFixed(2)}, Required: ₹${price.toFixed(2)}). Please add money to wallet first.`);
            }

            await deductWalletBalance(
                userId,
                price,
                `Subscription purchase: ${plan.name} (${plan.durationDays} Days)`,
                { planId: String(plan._id), planName: plan.name, durationDays: plan.durationDays }
            );
            paymentTransactionId = `SUB-WLT-${Date.now()}`;
        } else if (paymentMethod === 'razorpay') {
            paymentTransactionId = `SUB-RZP-${Date.now()}`;
        } else {
            paymentTransactionId = `SUB-${paymentMethod.toUpperCase()}-${Date.now()}`;
        }
    } else {
        paymentTransactionId = `SUB-FREE-${Date.now()}`;
    }

    const now = new Date();
    let startDate = now;
    let baseTime = now.getTime();
    if (user.isSubscribed && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
        baseTime = new Date(user.subscriptionExpiresAt).getTime();
    }

    const durationMs = plan.durationDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(baseTime + durationMs);

    const userSub = await UserSubscription.create({
        userId: user._id,
        planId: plan._id,
        planName: plan.name,
        badgeText: plan.badgeText || 'VIP',
        pricePaid: price,
        durationDays: plan.durationDays,
        priorityLevel: plan.priorityLevel || 1,
        startDate,
        expiresAt,
        status: 'active',
        paymentMethod,
        paymentTransactionId,
        features: plan.features || []
    });

    user.isSubscribed = true;
    user.subscriptionPlanId = plan._id;
    user.subscriptionPlanName = plan.name;
    user.subscriptionBadge = plan.badgeText || 'VIP';
    user.subscriptionPriority = plan.priorityLevel || 1;
    user.subscriptionExpiresAt = expiresAt;
    await user.save();

    return {
        success: true,
        message: `Congratulations! You are now subscribed to ${plan.name}. Your orders will be given High Priority in all kitchens.`,
        subscription: userSub,
        user: {
            _id: user._id,
            isSubscribed: user.isSubscribed,
            subscriptionPlanName: user.subscriptionPlanName,
            subscriptionBadge: user.subscriptionBadge,
            subscriptionPriority: user.subscriptionPriority,
            subscriptionExpiresAt: user.subscriptionExpiresAt
        }
    };
}
