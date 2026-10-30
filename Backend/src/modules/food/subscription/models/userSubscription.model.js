import mongoose from 'mongoose';

const userSubscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true,
            index: true
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },
        planName: {
            type: String,
            required: true,
            trim: true
        },
        badgeText: {
            type: String,
            default: 'VIP'
        },
        pricePaid: {
            type: Number,
            required: true,
            min: 0
        },
        durationDays: {
            type: Number,
            required: true,
            min: 1
        },
        priorityLevel: {
            type: Number,
            default: 1
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active',
            index: true
        },
        paymentMethod: {
            type: String,
            enum: ['wallet', 'razorpay', 'admin_gift', 'free'],
            default: 'wallet'
        },
        paymentTransactionId: {
            type: String,
            default: ''
        },
        features: {
            type: [String],
            default: []
        }
    },
    {
        collection: 'food_user_subscriptions',
        timestamps: true
    }
);

userSubscriptionSchema.index({ userId: 1, status: 1, expiresAt: -1 });

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);
export default UserSubscription;
