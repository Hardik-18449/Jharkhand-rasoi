import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: '',
            trim: true
        },
        badgeText: {
            type: String,
            default: '⭐ VIP',
            trim: true
        },
        badgeColor: {
            type: String,
            default: '#F59E0B',
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        originalPrice: {
            type: Number,
            default: 0,
            min: 0
        },
        durationDays: {
            type: Number,
            required: true,
            min: 1,
            default: 30
        },
        /** Higher level = served higher in restaurant kitchen queue */
        priorityLevel: {
            type: Number,
            default: 1,
            min: 1
        },
        features: {
            type: [String],
            default: [
                'Priority Kitchen Cooking - Order Prepared First',
                'VIP High Priority Restaurant Tag',
                'Free Delivery on orders above ₹149',
                'VIP Golden Badge on Profile & Orders',
                'Dedicated Customer Support'
            ]
        },
        freeDeliveryMinOrder: {
            type: Number,
            default: 0
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    {
        collection: 'food_subscription_plans',
        timestamps: true
    }
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1, price: 1 });

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
