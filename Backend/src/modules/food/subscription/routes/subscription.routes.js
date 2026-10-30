import express from 'express';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';
import * as subCtrl from '../controllers/subscription.controller.js';

// Public and User Router
export const subscriptionUserRouter = express.Router();

// Public: View active subscription plans
subscriptionUserRouter.get('/plans', subCtrl.getActivePlansPublicController);

// User-Authenticated: Get my subscription status
subscriptionUserRouter.get('/my', authMiddleware, requireRoles('USER'), subCtrl.getUserSubscriptionController);

// User-Authenticated: Subscribe to a plan
subscriptionUserRouter.post('/subscribe', authMiddleware, requireRoles('USER'), subCtrl.subscribeUserController);


// Admin Router
export const subscriptionAdminRouter = express.Router();

// Admin: CRUD for subscription plans
subscriptionAdminRouter.get('/plans', subCtrl.getAllPlansAdminController);
subscriptionAdminRouter.post('/plans', subCtrl.createPlanController);
subscriptionAdminRouter.get('/plans/:id', subCtrl.getPlanByIdController);
subscriptionAdminRouter.put('/plans/:id', subCtrl.updatePlanController);
subscriptionAdminRouter.patch('/plans/:id/toggle', subCtrl.togglePlanStatusController);
subscriptionAdminRouter.patch('/plans/:id/popular', subCtrl.togglePopularStatusController);
subscriptionAdminRouter.delete('/plans/:id', subCtrl.deletePlanController);

// Admin: List all subscribers
subscriptionAdminRouter.get('/subscribers', subCtrl.getAllSubscribersAdminController);

export default {
    subscriptionUserRouter,
    subscriptionAdminRouter
};
