import * as subscriptionService from '../services/subscription.service.js';

/**
 * ==========================================
 * ADMIN CONTROLLERS
 * ==========================================
 */

export async function createPlanController(req, res) {
    try {
        const plan = await subscriptionService.createPlan(req.body);
        return res.status(201).json({
            success: true,
            message: 'Subscription plan created successfully',
            data: plan
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to create subscription plan'
        });
    }
}

export async function getAllPlansAdminController(req, res) {
    try {
        const plans = await subscriptionService.getAllPlansAdmin();
        return res.status(200).json({
            success: true,
            data: plans
        });
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to fetch subscription plans'
        });
    }
}

export async function getPlanByIdController(req, res) {
    try {
        const plan = await subscriptionService.getPlanById(req.params.id);
        return res.status(200).json({
            success: true,
            data: plan
        });
    } catch (err) {
        return res.status(err.status || 404).json({
            success: false,
            message: err.message || 'Subscription plan not found'
        });
    }
}

export async function updatePlanController(req, res) {
    try {
        const plan = await subscriptionService.updatePlan(req.params.id, req.body);
        return res.status(200).json({
            success: true,
            message: 'Subscription plan updated successfully',
            data: plan
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to update subscription plan'
        });
    }
}

export async function togglePlanStatusController(req, res) {
    try {
        const plan = await subscriptionService.togglePlanStatus(req.params.id);
        return res.status(200).json({
            success: true,
            message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
            data: plan
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to toggle plan status'
        });
    }
}

export async function togglePopularStatusController(req, res) {
    try {
        const plan = await subscriptionService.togglePopularStatus(req.params.id);
        return res.status(200).json({
            success: true,
            message: `Plan ${plan.isPopular ? 'marked as Most Popular Choice' : 'unmarked from Most Popular Choice'}`,
            data: plan
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to toggle popular status'
        });
    }
}

export async function deletePlanController(req, res) {
    try {
        const result = await subscriptionService.deletePlan(req.params.id);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to delete subscription plan'
        });
    }
}

export async function getAllSubscribersAdminController(req, res) {
    try {
        const result = await subscriptionService.getAllSubscribersAdmin(req.query);
        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to fetch subscribers'
        });
    }
}

/**
 * ==========================================
 * PUBLIC & USER CONTROLLERS
 * ==========================================
 */

export async function getActivePlansPublicController(req, res) {
    try {
        const plans = await subscriptionService.getActivePlansPublic();
        return res.status(200).json({
            success: true,
            data: plans
        });
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to fetch active plans'
        });
    }
}

export async function getUserSubscriptionController(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        const sub = await subscriptionService.getUserActiveSubscription(userId);
        return res.status(200).json({
            success: true,
            data: sub
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to fetch subscription'
        });
    }
}

export async function subscribeUserController(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        const result = await subscriptionService.subscribeUser(userId, req.body);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to process subscription'
        });
    }
}
