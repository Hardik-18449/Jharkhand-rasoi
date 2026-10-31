import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { FoodRestaurant } from '../modules/food/restaurant/models/restaurant.model.js';
import { FoodZone } from '../modules/food/admin/models/zone.model.js';

async function fixData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Fix chitarpur jharkhand rasoi -> Chitarpur bus stand zone (6ae4b7c55a61b5a44a0e0cb0)
  const r1 = await FoodRestaurant.updateOne(
    { _id: new mongoose.Types.ObjectId('6ae1ec83633f9d2cdcafe398') },
    {
      $set: {
        zoneId: new mongoose.Types.ObjectId('6ae4b7c55a61b5a44a0e0cb0'),
        city: 'Chitarpur'
      }
    }
  );
  console.log('Updated chitarpur jharkhand rasoi:', r1.modifiedCount);

  // 2. Fix Jharkhand Rasoi (Ramgarh) -> Ramgarh zone (6ae5906eb29ee7eff14b807c)
  const r2 = await FoodRestaurant.updateOne(
    { _id: new mongoose.Types.ObjectId('6ae1ee71633f9d2cdcafe4a9') },
    {
      $set: {
        zoneId: new mongoose.Types.ObjectId('6ae5906eb29ee7eff14b807c'),
        location: {
          type: 'Point',
          coordinates: [85.5185557, 23.6174376],
          latitude: 23.6174376,
          longitude: 85.5185557,
          formattedAddress: 'Ramgarh, SH2, Cantonment, Ramgarh, Jharkhand, 829103, India',
          address: 'Ramgarh, SH2, Cantonment, Ramgarh, Jharkhand, 829103, India',
          area: 'Cantonment',
          city: 'Ramgarh',
          state: 'Jharkhand',
          pincode: '829103'
        }
      }
    }
  );
  console.log('Updated Jharkhand Rasoi (Ramgarh):', r2.modifiedCount);

  // 3. Add coordinates to Ranchi restaurants if missing
  await FoodRestaurant.updateOne(
    { _id: new mongoose.Types.ObjectId('6adb49240da3cb1c3891f909'), 'location.coordinates': { $exists: false } },
    {
      $set: {
        location: {
          type: 'Point',
          coordinates: [85.329249, 23.345318],
          latitude: 23.345318,
          longitude: 85.329249,
          formattedAddress: 'Main Road, Ranchi, Jharkhand, 834001, India',
          address: 'Main Road, Ranchi, Jharkhand',
          city: 'Ranchi',
          state: 'Jharkhand',
          pincode: '834001'
        }
      }
    }
  );

  await FoodRestaurant.updateOne(
    { _id: new mongoose.Types.ObjectId('6adb49250da3cb1c3891f918'), 'location.coordinates': { $exists: false } },
    {
      $set: {
        location: {
          type: 'Point',
          coordinates: [85.324249, 23.341318],
          latitude: 23.341318,
          longitude: 85.324249,
          formattedAddress: 'Circular Road, Ranchi, Jharkhand, 834001, India',
          address: 'Circular Road, Ranchi, Jharkhand',
          city: 'Ranchi',
          state: 'Jharkhand',
          pincode: '834001'
        }
      }
    }
  );

  // 4. Fix Bokaro dummy coordinates so it stays strictly within Bokaro
  // Bokaro coordinates: 23.6693, 86.1511.
  await FoodZone.updateOne(
    { _id: new mongoose.Types.ObjectId('6adb49230da3cb1c3891f8e2') },
    {
      $set: {
        centerPoint: { latitude: 23.6693, longitude: 86.1511 },
        serviceRadius: 10,
        isRadiusEnabled: true,
        unit: 'kilometer',
        coordinates: [
          { latitude: 23.64, longitude: 86.12 },
          { latitude: 23.70, longitude: 86.12 },
          { latitude: 23.70, longitude: 86.18 },
          { latitude: 23.64, longitude: 86.18 },
          { latitude: 23.64, longitude: 86.12 }
        ]
      }
    }
  );
  console.log('Fixed Bokaro zone boundaries.');

  // 5. Also fix Dhanbad dummy coordinates so it stays strictly within Dhanbad
  // Dhanbad coordinates: 23.7957, 86.4304.
  await FoodZone.updateOne(
    { _id: new mongoose.Types.ObjectId('6adb49230da3cb1c3891f8df') },
    {
      $set: {
        centerPoint: { latitude: 23.7957, longitude: 86.4304 },
        serviceRadius: 10,
        isRadiusEnabled: true,
        unit: 'kilometer',
        coordinates: [
          { latitude: 23.76, longitude: 86.40 },
          { latitude: 23.83, longitude: 86.40 },
          { latitude: 23.83, longitude: 86.46 },
          { latitude: 23.76, longitude: 86.46 },
          { latitude: 23.76, longitude: 86.40 }
        ]
      }
    }
  );
  console.log('Fixed Dhanbad zone boundaries.');

  console.log('Database fix complete!');
  await mongoose.disconnect();
}

fixData().catch(console.error);
