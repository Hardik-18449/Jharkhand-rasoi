import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;

async function seed() {
    if (!mongoUri) {
        throw new Error('MONGODB_URI not defined in Backend/.env');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const restaurantsColl = db.collection('food_restaurants');
    const foodItemsColl = db.collection('food_items');
    const combosColl = db.collection('food_combos');

    // Find restaurants
    const restaurants = await restaurantsColl.find({ status: { $ne: 'rejected' } }).limit(5).toArray();
    if (!restaurants.length) {
        console.log('No restaurants found in food_restaurants.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${restaurants.length} restaurants.`);

    for (const rest of restaurants) {
        console.log(`\nChecking items for restaurant: "${rest.restaurantName}" (ID: ${rest._id})`);
        
        let foodItems = await foodItemsColl.find({ 
            restaurantId: rest._id, 
            isDeleted: { $ne: true } 
        }).limit(10).toArray();

        // If restaurant has fewer than 2 items, let's create a few standard demo items
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
                },
                {
                    restaurantId: rest._id,
                    name: 'Paneer Butter Masala',
                    description: 'Cottage cheese cubes simmered in a rich tomato, butter, and cashew gravy.',
                    price: 240,
                    prepaidPrice: 240,
                    codPrice: 240,
                    categoryName: 'Main Course',
                    foodType: 'Veg',
                    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500',
                    isAvailable: true,
                    approvalStatus: 'approved',
                    isDeleted: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            const insertResult = await foodItemsColl.insertMany(demoItemsToInsert);
            console.log(`Inserted ${insertResult.insertedCount} demo food items.`);
            foodItems = await foodItemsColl.find({ restaurantId: rest._id, isDeleted: { $ne: true } }).limit(10).toArray();
        }

        const itemA = foodItems[0];
        const itemB = foodItems[1];
        const itemC = foodItems[2] || foodItems[0];

        const combo1Items = [
            {
                foodId: itemA._id,
                name: itemA.name,
                variantId: '',
                variantName: '',
                quantity: 1,
                unitPrice: Number(itemA.price) || 150,
                image: itemA.image || '',
                foodType: itemA.foodType || 'Veg'
            },
            {
                foodId: itemB._id,
                name: itemB.name,
                variantId: '',
                variantName: '',
                quantity: 1,
                unitPrice: Number(itemB.price) || 100,
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
        const comboPrice1 = Math.round(originalTotal1 * 0.75); // 25% combo discount

        const comboPayload1 = {
            name: `${itemA.name} + ${itemB.name} Combo Pack`,
            description: `Exclusive combo offer including ${combo1Items.map(i => `${i.quantity}x ${i.name}`).join(', ')}. Freshly prepared together!`,
            image: itemA.image || itemB.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
            images: [itemA.image, itemB.image].filter(Boolean),
            comboPrice: comboPrice1,
            originalPrice: originalTotal1,
            items: combo1Items,
            foodType: combo1Items.every(i => i.foodType === 'Veg') ? 'Veg' : 'Non-Veg'
        };

        // Demo Combo 1: APPROVED & LIVE (visible immediately in user app)
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
        console.log(`✓ Seeded Approved Live Combo: "${comboPayload1.name}" (₹${comboPrice1} vs original ₹${originalTotal1})`);

        // Demo Combo 2: PENDING APPROVAL (visible in Admin Food Approval queue to test approval workflow!)
        const combo2Items = [
            {
                foodId: itemA._id,
                name: itemA.name,
                variantId: '',
                variantName: '',
                quantity: 2,
                unitPrice: Number(itemA.price) || 150,
                image: itemA.image || '',
                foodType: itemA.foodType || 'Veg'
            },
            {
                foodId: itemB._id,
                name: itemB.name,
                variantId: '',
                variantName: '',
                quantity: 2,
                unitPrice: Number(itemB.price) || 100,
                image: itemB.image || '',
                foodType: itemB.foodType || 'Veg'
            }
        ];
        const originalTotal2 = combo2Items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
        const comboPrice2 = Math.round(originalTotal2 * 0.70); // 30% discount

        const comboPayload2 = {
            name: `Family Mega Feast (2x ${itemA.name} + 2x ${itemB.name})`,
            description: `Super saver mega meal for family and friends. Includes double portions with guaranteed savings.`,
            image: itemB.image || itemA.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            images: [itemB.image, itemA.image].filter(Boolean),
            comboPrice: comboPrice2,
            originalPrice: originalTotal2,
            items: combo2Items,
            foodType: combo2Items.every(i => i.foodType === 'Veg') ? 'Veg' : 'Non-Veg'
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
        console.log(`✓ Seeded Pending Review Combo: "${comboPayload2.name}" (In Food Approval Queue for Admin to test)`);
    }

    console.log('\n--- Seeding Complete! ---');
    const totalCombos = await combosColl.countDocuments({ isDeleted: { $ne: true } });
    console.log(`Total active combos in database now: ${totalCombos}`);

    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
