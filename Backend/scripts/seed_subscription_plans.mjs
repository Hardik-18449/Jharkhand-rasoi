import { connectDB, disconnectDB } from '../src/config/db.js';
import { SubscriptionPlan } from '../src/modules/food/subscription/models/subscriptionPlan.model.js';

async function seed() {
    await connectDB();
    console.log('Connected to DB');

    const count = await SubscriptionPlan.countDocuments();
    console.log('Current plan count:', count);
    if (count > 0) {
        const existing = await SubscriptionPlan.find();
        console.log('Existing plans:', existing.map(p => ({ id: p._id, name: p.name, price: p.price })));
        await disconnectDB();
        return;
    }

    const plans = [
        {
            name: 'VIP Gold Pass',
            description: 'Fastest kitchen cooking priority, free delivery & VIP gold status.',
            badgeText: '⭐ VIP Gold',
            badgeColor: '#F59E0B',
            price: 99,
            originalPrice: 199,
            durationDays: 30,
            priorityLevel: 1,
            freeDeliveryMinOrder: 149,
            discountPercent: 10,
            isActive: true,
            sortOrder: 1,
            features: [
                '🚀 Priority Kitchen Preparation (Orders cooked & served first)',
                '👑 VIP Gold Badge on profile and all orders',
                '🛵 Free Delivery on all orders above ₹149',
                '✨ 10% Extra VIP discount on select restaurants',
                '⚡ Dedicated 24/7 VIP Customer Support'
            ]
        },
        {
            name: 'VIP Platinum Club',
            description: 'Highest kitchen preparation queue rank, 90 days of unlimited perks.',
            badgeText: '💎 VIP Platinum',
            badgeColor: '#3B82F6',
            price: 249,
            originalPrice: 499,
            durationDays: 90,
            priorityLevel: 2,
            freeDeliveryMinOrder: 99,
            discountPercent: 15,
            isActive: true,
            sortOrder: 2,
            features: [
                '⚡ TOP Kitchen Priority (Highest order preparation queue rank)',
                '👑 VIP Platinum Badge on profile and all orders',
                '🛵 Unlimited Free Delivery on all orders above ₹99',
                '✨ 15% Extra VIP discount on all top restaurants',
                '🎁 Surprise Monthly Tasting Treats & Chef Specials',
                '⚡ Instant VIP Concierge & Express Resolution'
            ]
        },
        {
            name: 'Supreme Elite Annual',
            description: 'Supreme priority cooking with zero kitchen delay for 365 days.',
            badgeText: '👑 Supreme Elite',
            badgeColor: '#8B5CF6',
            price: 799,
            originalPrice: 1499,
            durationDays: 365,
            priorityLevel: 3,
            freeDeliveryMinOrder: 0,
            discountPercent: 20,
            isActive: true,
            sortOrder: 3,
            features: [
                '🔥 Supreme Priority Cooking - Zero Kitchen Delay',
                '👑 Supreme Elite Crown Badge',
                '🛵 100% Free Delivery on all orders throughout the year',
                '✨ 20% Extra Elite discount on dining & food orders',
                '🎉 Free Birthday Dinner & Anniversary Special Gift',
                '💎 Dedicated Personal Account Manager'
            ]
        }
    ];

    await SubscriptionPlan.insertMany(plans);
    console.log('Seeded 3 VIP subscription plans successfully!');
    await disconnectDB();
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
