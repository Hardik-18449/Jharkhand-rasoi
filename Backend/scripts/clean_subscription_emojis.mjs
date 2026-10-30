import { connectDB, disconnectDB } from '../src/config/db.js';
import { SubscriptionPlan } from '../src/modules/food/subscription/models/subscriptionPlan.model.js';

const stripEmojis = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FAFF}]|[⭐★✨⚡🔥🎉👑💎🚀🛵?]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
};

async function cleanPlans() {
    await connectDB();
    console.log('Connected to DB');

    const plans = await SubscriptionPlan.find();
    for (const plan of plans) {
        plan.name = stripEmojis(plan.name) || plan.name;
        plan.description = stripEmojis(plan.description) || plan.description;
        plan.badgeText = stripEmojis(plan.badgeText) || 'VIP';
        if (Array.isArray(plan.features)) {
            plan.features = plan.features.map(f => stripEmojis(f)).filter(Boolean);
        }
        await plan.save();
        console.log(`Cleaned plan: ${plan.name}, badgeText: ${plan.badgeText}, features:`, plan.features);
    }

    console.log('All plans updated with zero emojis!');
    await disconnectDB();
}

cleanPlans().catch(err => {
    console.error('Clean error:', err);
    process.exit(1);
});
