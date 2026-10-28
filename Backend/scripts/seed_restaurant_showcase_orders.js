import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function seedRestaurantShowcase() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // 1. Get restaurants
    const corporateRest = await db.collection('food_restaurants').findOne({ ownerPhone: '9755633147' });
    const royalRest = await db.collection('food_restaurants').findOne({ ownerPhone: '9000000000' });

    const targetRestaurants = [corporateRest, royalRest].filter(Boolean);

    for (const rest of targetRestaurants) {
      console.log(`Seeding live demo orders for: ${rest.restaurantName} (${rest.ownerPhone})...`);

      // Clear existing orders for this restaurant to keep fresh
      await db.collection('food_orders').deleteMany({ restaurantId: rest._id });

      // Fetch items for this restaurant
      let items = await db.collection('food_items').find({ restaurantId: rest._id }).toArray();
      if (items.length === 0) {
        items = await db.collection('food_items').find({}).limit(5).toArray();
      }

      const item1 = items[0] || { name: 'Special Thali', price: 250 };
      const item2 = items[1] || { name: 'Paneer Butter Masala', price: 220 };
      const item3 = items[2] || { name: 'Butter Naan', price: 45 };

      const now = Date.now();
      const mockOrders = [
        {
          orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: rest._id,
          restaurantName: rest.restaurantName,
          customerName: 'Aarav Patel',
          customerPhone: '9876543210',
          deliveryAddress: {
            address: 'Flat 402, Lotus Pride, Indore',
            area: 'Vijay Nagar',
            city: 'Indore',
            pincode: '452010'
          },
          items: [
            { id: item1._id || item1.id, name: item1.name, price: item1.price || 250, quantity: 2, foodType: item1.foodType || 'Veg' },
            { id: item3._id || item3.id, name: item3.name, price: item3.price || 45, quantity: 3, foodType: 'Veg' }
          ],
          subtotal: (item1.price || 250) * 2 + (item3.price || 45) * 3,
          deliveryFee: 30,
          taxes: 25,
          totalAmount: (item1.price || 250) * 2 + (item3.price || 45) * 3 + 55,
          status: 'pending',
          orderStatus: 'pending',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          createdAt: new Date(now - 3 * 60 * 1000), // 3 mins ago
          updatedAt: new Date(now - 3 * 60 * 1000)
        },
        {
          orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: rest._id,
          restaurantName: rest.restaurantName,
          customerName: 'Priya Sharma',
          customerPhone: '9876501234',
          deliveryAddress: {
            address: 'Plot 18, Scheme 54, Indore',
            area: 'Scheme 54',
            city: 'Indore',
            pincode: '452010'
          },
          items: [
            { id: item2._id || item2.id, name: item2.name, price: item2.price || 220, quantity: 1, foodType: item2.foodType || 'Veg' },
            { id: item3._id || item3.id, name: item3.name, price: item3.price || 45, quantity: 2, foodType: 'Veg' }
          ],
          subtotal: (item2.price || 220) + (item3.price || 45) * 2,
          deliveryFee: 25,
          taxes: 20,
          totalAmount: (item2.price || 220) + (item3.price || 45) * 2 + 45,
          status: 'preparing',
          orderStatus: 'preparing',
          preparationTimeMinutes: 20,
          paymentStatus: 'paid',
          paymentMethod: 'online',
          createdAt: new Date(now - 12 * 60 * 1000), // 12 mins ago
          updatedAt: new Date(now - 5 * 60 * 1000)
        },
        {
          orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: rest._id,
          restaurantName: rest.restaurantName,
          customerName: 'Kunal Verma',
          customerPhone: '9876598765',
          deliveryAddress: {
            address: '12-B, Old Palasia, Indore',
            area: 'Old Palasia',
            city: 'Indore',
            pincode: '452001'
          },
          items: [
            { id: item1._id || item1.id, name: item1.name, price: item1.price || 250, quantity: 1, foodType: 'Veg' }
          ],
          subtotal: item1.price || 250,
          deliveryFee: 20,
          taxes: 15,
          totalAmount: (item1.price || 250) + 35,
          status: 'ready_for_pickup',
          orderStatus: 'ready_for_pickup',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          createdAt: new Date(now - 25 * 60 * 1000),
          updatedAt: new Date(now - 2 * 60 * 1000)
        },
        {
          orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: rest._id,
          restaurantName: rest.restaurantName,
          customerName: 'Ananya Joshi',
          customerPhone: '9876511223',
          deliveryAddress: {
            address: 'A-201, Silver Springs, Bypass Road, Indore',
            area: 'Bypass Road',
            city: 'Indore',
            pincode: '452020'
          },
          items: [
            { id: item2._id || item2.id, name: item2.name, price: item2.price || 220, quantity: 2, foodType: 'Veg' }
          ],
          subtotal: (item2.price || 220) * 2,
          deliveryFee: 40,
          taxes: 30,
          totalAmount: (item2.price || 220) * 2 + 70,
          status: 'delivered',
          orderStatus: 'delivered',
          paymentStatus: 'paid',
          paymentMethod: 'online',
          createdAt: new Date(now - 2 * 60 * 60 * 1000), // 2 hrs ago
          updatedAt: new Date(now - 90 * 60 * 1000)
        },
        {
          orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          restaurantId: rest._id,
          restaurantName: rest.restaurantName,
          customerName: 'Rohan Mehra',
          customerPhone: '9876533445',
          deliveryAddress: {
            address: '304, Sapphire Heights, AB Road, Indore',
            area: 'AB Road',
            city: 'Indore',
            pincode: '452001'
          },
          items: [
            { id: item1._id || item1.id, name: item1.name, price: item1.price || 250, quantity: 1, foodType: 'Veg' },
            { id: item2._id || item2.id, name: item2.name, price: item2.price || 220, quantity: 1, foodType: 'Veg' }
          ],
          subtotal: (item1.price || 250) + (item2.price || 220),
          deliveryFee: 35,
          taxes: 28,
          totalAmount: (item1.price || 250) + (item2.price || 220) + 63,
          status: 'delivered',
          orderStatus: 'delivered',
          paymentStatus: 'paid',
          paymentMethod: 'cod',
          createdAt: new Date(now - 24 * 60 * 60 * 1000), // Yesterday
          updatedAt: new Date(now - 23 * 60 * 60 * 1000)
        }
      ];

      await db.collection('food_orders').insertMany(mockOrders);
      console.log(`✅ Seeded ${mockOrders.length} showcase orders (pending, preparing, ready, delivered) for ${rest.restaurantName}!`);
    }

    console.log('\n🎉 ALL RESTAURANT DEMO DATA READY!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding showcase:', err);
    process.exit(1);
  }
}

seedRestaurantShowcase();
