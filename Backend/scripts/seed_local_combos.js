import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Use local Mongo if configured or specified
const mongoUri = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function seed() {
    console.log('Connecting to Local MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to Local MongoDB!');

    const db = mongoose.connection.db;
    const restaurantsColl = db.collection('food_restaurants');
    const foodItemsColl = db.collection('food_items');
    const combosColl = db.collection('food_combos');

    const restaurants = await restaurantsColl.find({ status: { $ne: 'rejected' } }).toArray();
    console.log(`Found ${restaurants.length} restaurants in local DB.`);

    if (!restaurants.length) {
        console.log('No restaurants found in local DB. Checking any restaurants...');
        const allRests = await restaurantsColl.find({}).toArray();
        console.log('Total in collection:', allRests.length);
    }

    for (const rest of restaurants) {
        console.log(`\nRestaurant: "${rest.restaurantName}" (ID: ${rest._id})`);
        
        let foodItems = await foodItemsColl.find({ 
            restaurantId: rest._id, 
            isDeleted: { $ne: true } 
        }).limit(10).toArray();

        if (foodItems.length < 2) {
            console.log(`Restaurant has only ${foodItems.length} items. Adding demo food items...`);
            const demoItemsToInsert = [
                {
                    restaurantId: rest._id,
                    name: 'Farmhouse Special Pizza',
                    description: 'Loaded with crisp capsicum, onion, grilled mushroom and fresh tomato.',
                    price: 199,
                    prepaidPrice: 199,
                    codPrice: 199,
                    categoryName: 'Pizza',
                    foodType: 'Veg',
                    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
                    isAvailable: true,
                    approvalStatus: 'approved',
                    isDeleted: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    restaurantId: rest._id,
                    name: 'Crispy Veggie Burger',
                    description: 'Crispy seasoned vegetable patty topped with lettuce and creamy mayo.',
                    price: 119,
                    prepaidPrice: 119,
                    codPrice: 119,
                    categoryName: 'Burgers',
                    foodType: 'Veg',
                    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
                    isAvailable: true,
                    approvalStatus: 'approved',
                    isDeleted: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    restaurantId: rest._id,
                    name: 'Chilled Soft Drink (750ml)',
                    description: 'Refreshing cold beverage served chilled.',
                    price: 60,
                    prepaidPrice: 60,
                    codPrice: 60,
                    categoryName: 'Beverages',
                    foodType: 'Veg',
                    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500',
                    isAvailable: true,
                    approvalStatus: 'approved',
                    isDeleted: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            await foodItemsColl.insertMany(demoItemsToInsert);
            foodItems = await foodItemsColl.find({ restaurantId: rest._id, isDeleted: { $ne: true } }).limit(10).toArray();
        }

        const itemA = foodItems[0];
        const itemB = foodItems[1];
        const itemC = foodItems[2] || null;

        // Combo 1: Pizza + Burger + Cold Drink (Approved and Live for User App)
        const combo1Items = [
            {
                foodId: itemA._id,
                name: itemA.name,
                variantId: '',
                variantName: '',
                quantity: 1,
                unitPrice: Number(itemA.price) || 199,
                image: itemA.image || '',
                foodType: itemA.foodType || 'Veg'
            },
            {
                foodId: itemB._id,
                name: itemB.name,
                variantId: '',
                variantName: '',
                quantity: 1,
                unitPrice: Number(itemB.price) || 119,
                image: itemB.image || '',
                foodType: itemB.foodType || 'Veg'
            }
        ];

        if (itemC && String(itemC._id) !== String(itemA._id) && String(itemC._id) !== String(itemB._id)) {
            combo1Items.push({
                foodId: itemC._id,
                name: itemC.name,
                variantId: '',
                variantName: '',
                quantity: 1,
                unitPrice: Number(itemC.price) || 60,
                image: itemC.image || '',
                foodType: itemC.foodType || 'Veg'
            });
        }

        const originalTotal1 = combo1Items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
        const comboPrice1 = Math.round(originalTotal1 * 0.75); // 25% savings

        const comboPayload1 = {
            name: `${itemA.name} + ${itemB.name}${itemC ? ' + ' + itemC.name : ''} Combo Offer`,
            description: `Delicious super saver combo pack! Includes ${combo1Items.map(i => `${i.quantity}x ${i.name}`).join(', ')}.`,
            image: itemA.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
            images: [itemA.image, itemB.image].filter(Boolean),
            comboPrice: comboPrice1,
            originalPrice: originalTotal1,
            items: combo1Items,
            foodType: combo1Items.every(i => i.foodType === 'Veg') ? 'Veg' : 'Non-Veg'
        };

        await combosColl.updateOne(
            {
                restaurantId: rest._id,
                'draft.name': comboPayload1.name
            },
            {
                $set: {
                    restaurantId: rest._id,
                    draft: comboPayload1,
                    published: comboPayload1,
                    approvalStatus: 'approved',
                    rejectionReason: '',
                    requestedAt: new Date(Date.now() - 3600000),
                    approvedAt: new Date(),
                    rejectedAt: null,
                    isAvailable: true,
                    isDeleted: false,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log(`✓ Seeded Approved Live Combo: "${comboPayload1.name}" (Price: ₹${comboPrice1}, Was: ₹${originalTotal1})`);

        // Combo 2: Pending Approval for Admin testing
        const comboPayload2 = {
            name: `Weekend Special Treat (2x ${itemA.name} + 2x ${itemB.name})`,
            description: `Weekend mega party combo with generous portions! Perfect for family and friends.`,
            image: itemB.image || itemA.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            images: [itemB.image, itemA.image].filter(Boolean),
            comboPrice: Math.round(originalTotal1 * 1.5),
            originalPrice: originalTotal1 * 2,
            items: [
                { ...combo1Items[0], quantity: 2 },
                { ...combo1Items[1], quantity: 2 }
            ],
            foodType: 'Veg'
        };

        await combosColl.updateOne(
            {
                restaurantId: rest._id,
                'draft.name': comboPayload2.name
            },
            {
                $set: {
                    restaurantId: rest._id,
                    draft: comboPayload2,
                    published: null,
                    approvalStatus: 'pending',
                    rejectionReason: '',
                    requestedAt: new Date(),
                    approvedAt: null,
                    rejectedAt: null,
                    isAvailable: true,
                    isDeleted: false,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log(`✓ Seeded Pending Review Combo: "${comboPayload2.name}" (Pending admin approval)`);
    }

    const total = await combosColl.countDocuments({ isDeleted: { $ne: true } });
    console.log(`\nTotal combos in localhost DB now: ${total}`);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
