import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { config } from '../src/config/env.js';

const ZONES_FIX = [
  {
    name: 'Ranchi',
    centerPoint: { latitude: 23.3441, longitude: 85.3096 },
    serviceRadius: 50,
    isRadiusEnabled: true,
    coordinates: [
      { latitude: 23.10, longitude: 85.10 },
      { latitude: 23.10, longitude: 85.55 },
      { latitude: 23.60, longitude: 85.55 },
      { latitude: 23.60, longitude: 85.10 },
      { latitude: 23.10, longitude: 85.10 }
    ]
  },
  {
    name: 'Indore',
    centerPoint: { latitude: 22.7196, longitude: 75.8577 },
    serviceRadius: 50,
    isRadiusEnabled: true,
    coordinates: [
      { latitude: 22.50, longitude: 75.65 },
      { latitude: 22.50, longitude: 76.10 },
      { latitude: 22.95, longitude: 76.10 },
      { latitude: 22.95, longitude: 75.65 },
      { latitude: 22.50, longitude: 75.65 }
    ]
  },
  {
    name: 'Jamshedpur',
    centerPoint: { latitude: 22.8046, longitude: 86.2029 },
    serviceRadius: 50,
    isRadiusEnabled: true,
    coordinates: [
      { latitude: 22.60, longitude: 86.00 },
      { latitude: 22.60, longitude: 86.40 },
      { latitude: 23.00, longitude: 86.40 },
      { latitude: 23.00, longitude: 86.00 },
      { latitude: 22.60, longitude: 86.00 }
    ]
  },
  {
    name: 'Dhanbad',
    centerPoint: { latitude: 23.7957, longitude: 86.4304 },
    serviceRadius: 50,
    isRadiusEnabled: true,
    coordinates: [
      { latitude: 23.60, longitude: 86.20 },
      { latitude: 23.60, longitude: 86.65 },
      { latitude: 24.00, longitude: 86.65 },
      { latitude: 24.00, longitude: 86.20 },
      { latitude: 23.60, longitude: 86.20 }
    ]
  },
  {
    name: 'Bokaro',
    centerPoint: { latitude: 23.6693, longitude: 86.1511 },
    serviceRadius: 50,
    isRadiusEnabled: true,
    coordinates: [
      { latitude: 23.45, longitude: 85.95 },
      { latitude: 23.45, longitude: 86.35 },
      { latitude: 23.85, longitude: 86.35 },
      { latitude: 23.85, longitude: 85.95 },
      { latitude: 23.45, longitude: 85.95 }
    ]
  }
];

async function run() {
  const uri = config.mongodbUri || process.env.MONGO_URI_PRODUCTION || process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  for (const z of ZONES_FIX) {
    const res = await mongoose.connection.db.collection('food_zones').updateOne(
      {
        $or: [
          { name: new RegExp(z.name, 'i') },
          { zoneName: new RegExp(z.name, 'i') }
        ]
      },
      {
        $set: {
          centerPoint: z.centerPoint,
          serviceRadius: z.serviceRadius,
          isRadiusEnabled: z.isRadiusEnabled,
          coordinates: z.coordinates,
          isActive: true
        }
      }
    );
    console.log(`Updated zone ${z.name}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(console.error);
