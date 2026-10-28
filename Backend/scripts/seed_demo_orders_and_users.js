import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function seedOrdersAndUsers() {
    try {
        console.log('Connecting to database:', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;

        // 1. Ensure Demo Customer User exists
        let user = await db.collection('food_users').findOne({ phone: '9876543210' });
        if (!user) {
            const userDoc = {
                name: 'Rahul Sharma',
                phone: '9876543210',
                email: 'rahul.sharma@example.com',
                status: 'active',
                isPhoneVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await db.collection('food_users').insertOne(userDoc);
            user = { ...userDoc, _id: result.insertedId };
            console.log('✅ Created Demo User: Rahul Sharma (9876543210)');
        } else {
            console.log('Found Demo User:', user.name);
        }

        // 2. Fetch Restaurants and Items
        const restaurants = await db.collection('food_restaurants').find({}).toArray();
        if (restaurants.length === 0) {
            console.error('No restaurants found. Please run seed_jharkhandrasoi_demo.js first.');
            process.exit(1);
        }

        const items = await db.collection('food_items').find({}).toArray();
        const riders = await db.collection('food_delivery_partners').find({}).toArray();

        // 3. Clear existing demo orders to avoid duplication
        await db.collection('food_orders').deleteMany({ customerPhone: '9876543210' });
        console.log('Cleared previous demo orders.');

        // 4. Create realistic demo orders
        const orderDefinitions = [
            {
                status: 'delivered',
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                hoursAgo: 48,
                riderIdx: 0,
                rating: 5,
                comment: 'Super fast delivery and delicious food!'
            },
            {
                status: 'delivered',
                paymentStatus: 'paid',
                paymentMethod: 'cash',
                hoursAgo: 24,
                riderIdx: 1,
                rating: 4,
                comment: 'Tasty food, nicely packaged.'
            },
            {
                status: 'delivered',
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                hoursAgo: 16,
                riderIdx: 2,
                rating: 5,
                comment: 'Loved the biryani!'
            },
            {
                status: 'delivered',
                paymentStatus: 'paid',
                paymentMethod: 'wallet',
                hoursAgo: 6,
                riderIdx: 3,
                rating: 5,
                comment: 'Awesome service.'
            },
            {
                status: 'picked_up',
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                hoursAgo: 0.5,
                riderIdx: 0
            },
            {
                status: 'ready_for_pickup',
                paymentStatus: 'paid',
                paymentMethod: 'cash',
                hoursAgo: 0.3,
                riderIdx: 1
            },
            {
                status: 'preparing',
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                hoursAgo: 0.2
            },
            {
                status: 'confirmed',
                paymentStatus: 'paid',
                paymentMethod: 'cash',
                hoursAgo: 0.1
            }
        ];

        let counter = 1001;
        const now = Date.now();

        for (let i = 0; i < orderDefinitions.length; i++) {
            const def = orderDefinitions[i];
            const rest = restaurants[i % restaurants.length];
            const restItems = items.filter(it => String(it.restaurantId) === String(rest._id));
            const selectedItems = (restItems.length > 0 ? restItems : items).slice(0, 2);

            const orderDate = new Date(now - def.hoursAgo * 3600 * 1000);
            const orderCode = `FOD-${counter++}`;

            const orderItems = selectedItems.map(item => ({
                itemId: String(item._id),
                name: item.name,
                price: item.price || 199,
                originalPrice: (item.price || 199) + 50,
                quantity: Math.floor(Math.random() * 2) + 1,
                isVeg: item.foodType === 'Veg',
                image: item.image || ''
            }));

            const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const deliveryFee = 35;
            const packagingFee = 15;
            const platformFee = 5;
            const tax = Math.round(subtotal * 0.05);
            const total = subtotal + deliveryFee + packagingFee + platformFee + tax;

            const rider = def.riderIdx !== undefined && riders[def.riderIdx] ? riders[def.riderIdx] : null;

            const orderDoc = {
                order_id: orderCode,
                orderId: orderCode,
                userId: user._id,
                customerName: user.name,
                customerPhone: user.phone,
                restaurantId: rest._id,
                zoneId: rest.zoneId,
                orderStatus: def.status,
                items: orderItems,
                pricing: {
                    subtotal,
                    tax,
                    packagingFee,
                    deliveryFee,
                    platformFee,
                    restaurantCommission: Math.round(subtotal * 0.15),
                    total,
                    currency: 'INR'
                },
                payment: {
                    method: def.paymentMethod,
                    status: def.paymentStatus,
                    amountDue: def.paymentStatus === 'paid' ? 0 : total
                },
                deliveryAddress: {
                    label: 'Home',
                    name: user.name,
                    phone: user.phone,
                    street: 'Flat 402, Sunshine Apartments, MG Road',
                    city: rest.city || 'Indore',
                    state: 'Madhya Pradesh',
                    zipCode: '452001',
                    location: {
                        type: 'Point',
                        coordinates: [75.8577, 22.7196]
                    }
                },
                dispatch: {
                    status: rider ? 'assigned' : 'unassigned',
                    deliveryPartnerId: rider ? rider._id : null,
                    assignedAt: rider ? orderDate : null
                },
                ratings: def.rating ? {
                    restaurant: {
                        rating: def.rating,
                        comment: def.comment,
                        ratedAt: orderDate
                    }
                } : {},
                createdAt: orderDate,
                updatedAt: orderDate
            };

            await db.collection('food_orders').insertOne(orderDoc);
        }

        console.log(`✅ Seeded ${orderDefinitions.length} Realistic Showcase Orders!`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error seeding orders:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seedOrdersAndUsers();
