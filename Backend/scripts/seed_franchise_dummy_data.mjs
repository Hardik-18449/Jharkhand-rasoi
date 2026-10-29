import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB!');

  const db = mongoose.connection.db;

  // 1. Get or create a Zone
  let zone = await db.collection('food_zones').findOne({ status: true });
  if (!zone) {
    const zoneRes = await db.collection('food_zones').insertOne({
      name: 'Ranchi Central Zone',
      status: true,
      coordinates: {
        type: 'Polygon',
        coordinates: [
          [
            [85.25, 23.30],
            [85.40, 23.30],
            [85.40, 23.45],
            [85.25, 23.45],
            [85.25, 23.30],
          ]
        ]
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    zone = { _id: zoneRes.insertedId, name: 'Ranchi Central Zone' };
    console.log('Created default Zone:', zone.name);
  }

  // 2. Upsert Franchise Outlet 1 (Ranchi Main)
  const ranchiData = {
    restaurantName: 'Jharkhand Rasoi (Ranchi Main Franchise)',
    name: 'Jharkhand Rasoi (Ranchi Main Franchise)',
    phone: '9876543210',
    email: 'ranchi.franchise@jharkhandrasoi.com',
    restaurantType: 'franchise',
    status: 'approved',
    isActive: true,
    isAcceptingOrders: true,
    zoneId: zone._id,
    address: {
      street: 'Main Road, Overbridge Chowk',
      city: 'Ranchi',
      state: 'Jharkhand',
      zipCode: '834001',
      location: { type: 'Point', coordinates: [85.3240, 23.3441] }
    },
    location: { type: 'Point', coordinates: [85.3240, 23.3441] },
    deliverySettings: {
      hasDedicatedDelivery: true,
      openForPublicDelivery: false,
    },
    updatedAt: new Date(),
  };

  const ranchiOutlet = await db.collection('food_restaurants').findOneAndUpdate(
    { phone: '9876543210' },
    { $set: ranchiData, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  const ranchiId = ranchiOutlet._id || (await db.collection('food_restaurants').findOne({ phone: '9876543210' }))._id;
  console.log('Franchise 1 Ready:', ranchiData.restaurantName, ranchiId.toString());

  // 3. Upsert Franchise Outlet 2 (Jamshedpur)
  const jmpData = {
    restaurantName: 'Jharkhand Rasoi (Jamshedpur Franchise)',
    name: 'Jharkhand Rasoi (Jamshedpur Franchise)',
    phone: '9876543211',
    email: 'jamshedpur.franchise@jharkhandrasoi.com',
    restaurantType: 'franchise',
    status: 'approved',
    isActive: true,
    isAcceptingOrders: true,
    zoneId: zone._id,
    address: {
      street: 'Bistupur Main Market',
      city: 'Jamshedpur',
      state: 'Jharkhand',
      zipCode: '831001',
      location: { type: 'Point', coordinates: [86.1821, 22.8046] }
    },
    location: { type: 'Point', coordinates: [86.1821, 22.8046] },
    deliverySettings: {
      hasDedicatedDelivery: true,
      openForPublicDelivery: true,
    },
    updatedAt: new Date(),
  };

  const jmpOutlet = await db.collection('food_restaurants').findOneAndUpdate(
    { phone: '9876543211' },
    { $set: jmpData, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  const jmpId = jmpOutlet._id || (await db.collection('food_restaurants').findOne({ phone: '9876543211' }))._id;
  console.log('Franchise 2 Ready:', jmpData.restaurantName, jmpId.toString());

  // 4. Seed Stock for Ranchi Outlet
  await db.collection('food_franchise_stocks').deleteMany({ restaurantId: { $in: [ranchiId, jmpId] } });

  const ranchiStocks = [
    {
      restaurantId: ranchiId,
      itemName: 'Basmati Biryani Rice (Grade A)',
      category: 'Grains & Rice',
      unit: 'kg',
      currentStock: 45,
      minimumThreshold: 10,
      costPerUnit: 85,
      lastSuppliedQuantity: 50,
      lastSuppliedAt: new Date(Date.now() - 2 * 86400000),
      notes: 'Batch #BR-2026-10, Premium long grain',
      supplyHistory: [
        { quantity: 50, costPerUnit: 85, notes: 'HQ Initial Dispatch', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 2 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: ranchiId,
      itemName: 'Jharkhand Special Spice Blend',
      category: 'Spices',
      unit: 'kg',
      currentStock: 18,
      minimumThreshold: 5,
      costPerUnit: 340,
      lastSuppliedQuantity: 20,
      lastSuppliedAt: new Date(Date.now() - 3 * 86400000),
      notes: 'Secret recipe garam masala mix',
      supplyHistory: [
        { quantity: 20, costPerUnit: 340, notes: 'HQ Special Dispatch', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 3 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: ranchiId,
      itemName: 'Kachi Ghani Mustard Oil',
      category: 'Oils & Fats',
      unit: 'litre',
      currentStock: 28,
      minimumThreshold: 8,
      costPerUnit: 145,
      lastSuppliedQuantity: 30,
      lastSuppliedAt: new Date(Date.now() - 3 * 86400000),
      notes: '15L tins dispatched',
      supplyHistory: [
        { quantity: 30, costPerUnit: 145, notes: 'Mustard oil batch', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 3 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: ranchiId,
      itemName: 'Fresh Malai Paneer',
      category: 'Dairy',
      unit: 'kg',
      currentStock: 3, // LOW STOCK!
      minimumThreshold: 5,
      costPerUnit: 360,
      lastSuppliedQuantity: 10,
      lastSuppliedAt: new Date(Date.now() - 86400000),
      notes: 'Fresh morning delivery',
      supplyHistory: [
        { quantity: 10, costPerUnit: 360, notes: 'Dairy supply', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: ranchiId,
      itemName: 'Branded Food Delivery Boxes (Large)',
      category: 'Packaging',
      unit: 'box',
      currentStock: 320,
      minimumThreshold: 50,
      costPerUnit: 7,
      lastSuppliedQuantity: 500,
      lastSuppliedAt: new Date(Date.now() - 5 * 86400000),
      notes: 'Jharkhand Rasoi logo printed boxes',
      supplyHistory: [
        { quantity: 500, costPerUnit: 7, notes: 'Packaging carton', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 5 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const jmpStocks = [
    {
      restaurantId: jmpId,
      itemName: 'Basmati Biryani Rice (Grade A)',
      category: 'Grains & Rice',
      unit: 'kg',
      currentStock: 8, // LOW STOCK!
      minimumThreshold: 10,
      costPerUnit: 85,
      lastSuppliedQuantity: 30,
      lastSuppliedAt: new Date(Date.now() - 4 * 86400000),
      notes: 'Bistupur store supply',
      supplyHistory: [
        { quantity: 30, costPerUnit: 85, notes: 'Initial consignment', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 4 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: jmpId,
      itemName: 'Kachi Ghani Mustard Oil',
      category: 'Oils & Fats',
      unit: 'litre',
      currentStock: 4, // LOW STOCK!
      minimumThreshold: 8,
      costPerUnit: 145,
      lastSuppliedQuantity: 15,
      lastSuppliedAt: new Date(Date.now() - 4 * 86400000),
      notes: 'Tin delivery',
      supplyHistory: [
        { quantity: 15, costPerUnit: 145, notes: 'Oil dispatch', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 4 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      restaurantId: jmpId,
      itemName: 'Branded Food Delivery Boxes (Large)',
      category: 'Packaging',
      unit: 'box',
      currentStock: 450,
      minimumThreshold: 50,
      costPerUnit: 7,
      lastSuppliedQuantity: 500,
      lastSuppliedAt: new Date(Date.now() - 4 * 86400000),
      notes: 'Branded boxes',
      supplyHistory: [
        { quantity: 500, costPerUnit: 7, notes: 'Box delivery', suppliedBy: 'Super Admin', suppliedAt: new Date(Date.now() - 4 * 86400000) }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.collection('food_franchise_stocks').insertMany([...ranchiStocks, ...jmpStocks]);
  console.log(`Seeded ${ranchiStocks.length + jmpStocks.length} Stock items!`);

  // 5. Seed Daily Shift Reports
  await db.collection('food_franchise_daily_reports').deleteMany({ restaurantId: { $in: [ranchiId, jmpId] } });

  const reports = [
    {
      restaurantId: ranchiId,
      reportDate: new Date(Date.now() - 86400000), // Yesterday
      counterSalesAmount: 22450,
      onlineSalesAmount: 14800,
      totalSalesAmount: 37250,
      customerFootfall: 165,
      notes: 'Dinner rush was very busy. Rice and Paneer consumption was high.',
      submittedBy: 'Amit Kumar (Ranchi Branch Manager)',
      status: 'submitted',
      stockUsage: [
        { itemName: 'Basmati Biryani Rice (Grade A)', unit: 'kg', openingStock: 50, quantityUsed: 5, wastedQuantity: 0, closingStock: 45 },
        { itemName: 'Jharkhand Special Spice Blend', unit: 'kg', openingStock: 20, quantityUsed: 2, wastedQuantity: 0, closingStock: 18 },
        { itemName: 'Kachi Ghani Mustard Oil', unit: 'litre', openingStock: 30, quantityUsed: 2, wastedQuantity: 0, closingStock: 28 },
        { itemName: 'Fresh Malai Paneer', unit: 'kg', openingStock: 10, quantityUsed: 6.5, wastedQuantity: 0.5, closingStock: 3 },
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    },
    {
      restaurantId: ranchiId,
      reportDate: new Date(Date.now() - 2 * 86400000), // 2 days ago
      counterSalesAmount: 18600,
      onlineSalesAmount: 11200,
      totalSalesAmount: 29800,
      customerFootfall: 132,
      notes: 'Smooth operations, good lunch crowd.',
      submittedBy: 'Amit Kumar (Ranchi Branch Manager)',
      status: 'verified',
      stockUsage: [
        { itemName: 'Basmati Biryani Rice (Grade A)', unit: 'kg', openingStock: 55, quantityUsed: 5, wastedQuantity: 0, closingStock: 50 },
        { itemName: 'Branded Food Delivery Boxes (Large)', unit: 'box', openingStock: 420, quantityUsed: 100, wastedQuantity: 0, closingStock: 320 },
      ],
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      restaurantId: jmpId,
      reportDate: new Date(Date.now() - 86400000), // Yesterday
      counterSalesAmount: 19800,
      onlineSalesAmount: 13400,
      totalSalesAmount: 33200,
      customerFootfall: 148,
      notes: 'Need urgent restocking of Mustard Oil and Rice.',
      submittedBy: 'Pooja Verma (Jamshedpur Lead)',
      status: 'submitted',
      stockUsage: [
        { itemName: 'Basmati Biryani Rice (Grade A)', unit: 'kg', openingStock: 18, quantityUsed: 9.5, wastedQuantity: 0.5, closingStock: 8 },
        { itemName: 'Kachi Ghani Mustard Oil', unit: 'litre', openingStock: 10, quantityUsed: 5.8, wastedQuantity: 0.2, closingStock: 4 },
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    },
  ];

  await db.collection('food_franchise_daily_reports').insertMany(reports);
  console.log(`Seeded ${reports.length} Daily Shift Reports!`);

  // 6. Seed Dedicated Rider for Franchise
  await db.collection('food_delivery_partners').findOneAndUpdate(
    { phone: '9876543299' },
    {
      $set: {
        name: 'Ramesh Kumar (Dedicated Rider)',
        phone: '9876543299',
        partnerType: 'dedicated',
        restaurantId: ranchiId,
        status: 'approved',
        isOnline: true,
        zoneId: zone._id,
        currentLocation: { type: 'Point', coordinates: [85.3242, 23.3445] },
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  console.log('Dedicated Rider Ready: Ramesh Kumar (9876543299)');

  console.log('\n======================================================');
  console.log('🎉 FRANCHISE DUMMY DATA SEED COMPLETED 100%!');
  console.log('======================================================');
  console.log('1. Admin Credentials: admin@jharkhandrasoi.com / Admin@123');
  console.log('2. Ranchi Franchise Login: Phone 9876543210 (OTP: 1234)');
  console.log('3. Jamshedpur Franchise Login: Phone 9876543211 (OTP: 1234)');
  console.log('4. Dedicated Rider Login: Phone 9876543299 (OTP: 1234)');
  console.log('5. Admin Records Page: /admin/food/franchise-records');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});
