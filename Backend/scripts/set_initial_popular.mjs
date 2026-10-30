import { connectDB, disconnectDB } from '../src/config/db.js';
import { SubscriptionPlan } from '../src/modules/food/subscription/models/subscriptionPlan.model.js';

async function setInitialPopular() {
    await connectDB();
    console.log('Connected to DB');

    await SubscriptionPlan.updateMany({}, { isPopular: false });
    const res = await SubscriptionPlan.findOneAndUpdate(
        { name: /Platinum/i },
        { isPopular: true },
        { new: true }
    );

    console.log('Set plan as popular:', res?.name, 'isPopular:', res?.isPopular);
    await disconnectDB();
}

setInitialPopular().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
