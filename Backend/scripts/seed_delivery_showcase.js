import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function seedDeliveryShowcase() {
  try {
    console.log('Connecting to MongoDB at:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // 1. Fetch reference restaurants
    const corpRest = await db.collection('food_restaurants').findOne({ ownerPhone: '9755633147' }) ||
      await db.collection('food_restaurants').findOne({ restaurantName: 'Corporate Kitchen' });
    const royalRest = await db.collection('food_restaurants').findOne({ ownerPhone: '9000000000' }) ||
      await db.collection('food_restaurants').findOne({ restaurantName: 'The Royal Maratha' });
    const sarafaRest = await db.collection('food_restaurants').findOne({ restaurantName: 'Sarafa Street Bites' }) ||
      await db.collection('food_restaurants').findOne({});

    const rest1Id = corpRest?._id || new mongoose.Types.ObjectId('6adc83fb76a3aff70eb6c258');
    const rest2Id = royalRest?._id || new mongoose.Types.ObjectId('6adc57f468c6be4802bd81d5');
    const rest3Id = sarafaRest?._id || new mongoose.Types.ObjectId('6adc57f468c6be4802bd81e2');

    // 2. Fetch or create users
    let user1 = await db.collection('food_users').findOne({ phone: '9876543210' });
    if (!user1) {
      const uRes = await db.collection('food_users').insertOne({
        name: 'Rahul Sharma',
        phone: '9876543210',
        email: 'rahul.sharma@example.com',
        role: 'USER',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user1 = { _id: uRes.insertedId, name: 'Rahul Sharma', phone: '9876543210' };
    }

    let user2 = await db.collection('food_users').findOne({ phone: '9827653542' });
    if (!user2) {
      const uRes = await db.collection('food_users').insertOne({
        name: 'Priya Patel',
        phone: '9827653542',
        email: 'priya.patel@example.com',
        role: 'USER',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user2 = { _id: uRes.insertedId, name: 'Priya Patel', phone: '9827653542' };
    }

    let user3 = await db.collection('food_users').findOne({ phone: '9898989898' });
    if (!user3) {
      const uRes = await db.collection('food_users').insertOne({
        name: 'Aman Gupta',
        phone: '9898989898',
        email: 'aman.gupta@example.com',
        role: 'USER',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user3 = { _id: uRes.insertedId, name: 'Aman Gupta', phone: '9898989898' };
    }

    // 3. Setup Rider 1 (8000000000)
    console.log('Upserting Rider 1 (8000000000 - Jharkhand Rasoi Rider Indore)...');
    const rider1Data = {
      name: 'Jharkhand Rasoi Rider Indore',
      phone: '8000000000',
      countryCode: '+91',
      email: 'rider.indore@jharkhandrasoi.in',
      city: 'Indore',
      state: 'Madhya Pradesh',
      address: 'Plot 102, New Palasia, Indore, Madhya Pradesh 452001',
      vehicleType: 'Bike',
      vehicleName: 'Hero Splendor Plus',
      vehicleNumber: 'MP09AB8000',
      panNumber: 'ABCDE8000F',
      aadharNumber: '800012345678',
      drivingLicenseNumber: 'MP0920248000000',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      aadharPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      aadharFrontPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      aadharBackPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      panPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      drivingLicenseFrontPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      drivingLicenseBackPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      rcPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      bankAccountHolderName: 'Jharkhand Rasoi Rider Indore',
      bankAccountNumber: '98765432101234',
      bankIfscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      upiId: 'indorerider@okaxis',
      status: 'approved',
      approvedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      availabilityStatus: 'online',
      shiftStartTime: new Date(Date.now() - 4 * 3600 * 1000),
      shiftStartAddress: 'Treasure Island Mall, MG Road, Indore',
      shiftStartPic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      lastLocation: { type: 'Point', coordinates: [75.8732, 22.7169] },
      lastLat: 22.7169,
      lastLng: 75.8732,
      lastLocationAt: new Date(),
      rating: 4.9,
      totalRatings: 78,
      referralCode: 'RIDER8000',
      referralCount: 3,
      updatedAt: new Date()
    };

    let rider1 = await db.collection('food_delivery_partners').findOne({ phone: '8000000000' });
    if (rider1) {
      await db.collection('food_delivery_partners').updateOne({ _id: rider1._id }, { $set: rider1Data });
      rider1 = await db.collection('food_delivery_partners').findOne({ _id: rider1._id });
    } else {
      const r1Res = await db.collection('food_delivery_partners').insertOne({
        ...rider1Data,
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000)
      });
      rider1 = await db.collection('food_delivery_partners').findOne({ _id: r1Res.insertedId });
    }

    // 4. Setup Rider 2 (9755633147)
    console.log('Upserting Rider 2 (9755633147 - Corporate Delivery Express)...');
    const rider2Data = {
      name: 'Corporate Delivery Express',
      phone: '9755633147',
      countryCode: '+91',
      email: 'corporate.rider@jharkhandrasoi.in',
      city: 'Indore',
      state: 'Madhya Pradesh',
      address: 'Corporate House, 169, RNT Marg, Indore, Madhya Pradesh 452001',
      vehicleType: 'Bike',
      vehicleName: 'Honda Activa 6G',
      vehicleNumber: 'MP09AB9755',
      panNumber: 'ABCDE9755F',
      aadharNumber: '975563314712',
      drivingLicenseNumber: 'MP0920249755633',
      profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      aadharPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      aadharFrontPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      aadharBackPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      panPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      drivingLicenseFrontPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      drivingLicenseBackPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      rcPhoto: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      bankAccountHolderName: 'Corporate Delivery Express',
      bankAccountNumber: '12345678909755',
      bankIfscCode: 'ICIC0000975',
      bankName: 'ICICI Bank',
      upiId: 'corporate9755@icici',
      status: 'approved',
      approvedAt: new Date(Date.now() - 40 * 24 * 3600 * 1000),
      availabilityStatus: 'online',
      shiftStartTime: new Date(Date.now() - 3 * 3600 * 1000),
      shiftStartAddress: 'Corporate House, 169, RNT Marg, Indore',
      shiftStartPic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      lastLocation: { type: 'Point', coordinates: [75.8750, 22.7180] },
      lastLat: 22.7180,
      lastLng: 75.8750,
      lastLocationAt: new Date(),
      rating: 4.9,
      totalRatings: 45,
      referralCode: 'CORP9755',
      referralCount: 1,
      updatedAt: new Date()
    };

    let rider2 = await db.collection('food_delivery_partners').findOne({ phone: '9755633147' });
    if (rider2) {
      await db.collection('food_delivery_partners').updateOne({ _id: rider2._id }, { $set: rider2Data });
      rider2 = await db.collection('food_delivery_partners').findOne({ _id: rider2._id });
    } else {
      const r2Res = await db.collection('food_delivery_partners').insertOne({
        ...rider2Data,
        createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000)
      });
      rider2 = await db.collection('food_delivery_partners').findOne({ _id: r2Res.insertedId });
    }

    const rider1Id = rider1._id;
    const rider2Id = rider2._id;

    // 5. Clean prior test orders for these riders to prevent clutter
    await db.collection('food_orders').deleteMany({
      'dispatch.deliveryPartnerId': { $in: [rider1Id, rider2Id] }
    });
    await db.collection('payment_delivery_withdrawals').deleteMany({
      deliveryPartnerId: { $in: [rider1Id, rider2Id] }
    });
    await db.collection('payment_delivery_cash_deposits').deleteMany({
      deliveryPartnerId: { $in: [rider1Id, rider2Id] }
    });
    await db.collection('payment_delivery_bonus_transactions').deleteMany({
      deliveryPartnerId: { $in: [rider1Id, rider2Id] }
    });
    await db.collection('food_delivery_support_tickets').deleteMany({
      deliveryPartnerId: { $in: [rider1Id, rider2Id] }
    });

    const now = Date.now();

    // 6. Seed Orders for Rider 1 (8000000000)
    console.log('Seeding orders for Rider 1...');

    // 6A. ACTIVE ONGOING ORDER: FOD-LIVE-801 (picked_up, en_route_to_delivery, COD collection)
    const activeOrderDoc = {
      order_id: 'FOD-LIVE-801',
      orderId: 'FOD-LIVE-801',
      userId: user1._id,
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      restaurantId: rest1Id,
      restaurantName: 'Corporate Kitchen',
      restaurantPhone: '9755633147',
      restaurantAddress: 'Corporate House, 169, RNT Marg, Indore, Madhya Pradesh 452001',
      restaurantLocation: {
        type: 'Point',
        coordinates: [75.8732, 22.7169],
        latitude: 22.7169,
        longitude: 75.8732
      },
      orderStatus: 'picked_up',
      riderEarning: 65,
      deliveryDistanceKm: 3.4,
      items: [
        { itemId: new mongoose.Types.ObjectId(), name: 'Paneer Butter Masala', price: 220, quantity: 1, isVeg: true },
        { itemId: new mongoose.Types.ObjectId(), name: 'Butter Naan', price: 45, quantity: 2, isVeg: true },
        { itemId: new mongoose.Types.ObjectId(), name: 'Dal Makhani', price: 150, quantity: 1, isVeg: true }
      ],
      pricing: {
        subtotal: 460,
        tax: 23,
        packagingFee: 15,
        deliveryFee: 40,
        platformFee: 5,
        total: 543,
        currency: 'INR'
      },
      payment: {
        method: 'cash',
        status: 'cod_pending',
        amountDue: 543
      },
      deliveryAddress: {
        label: 'Home',
        name: 'Rahul Sharma',
        phone: '9876543210',
        street: 'Flat 302, Silver Heights, Vijay Nagar',
        area: 'Vijay Nagar',
        city: 'Indore',
        state: 'Madhya Pradesh',
        zipCode: '452010',
        location: {
          type: 'Point',
          coordinates: [75.8920, 22.7533],
          latitude: 22.7533,
          longitude: 75.8920
        }
      },
      dispatch: {
        modeAtCreation: 'auto',
        status: 'accepted',
        deliveryPartnerId: rider1Id,
        assignedAt: new Date(now - 20 * 60 * 1000),
        acceptedAt: new Date(now - 18 * 60 * 1000),
        offeredTo: [{ partnerId: rider1Id, action: 'offered', at: new Date(now - 20 * 60 * 1000) }]
      },
      deliveryState: {
        currentPhase: 'en_route_to_delivery',
        pickedUpAt: new Date(now - 8 * 60 * 1000),
        pickupOtpVerified: true
      },
      deliveryOtp: '1234',
      createdAt: new Date(now - 30 * 60 * 1000),
      updatedAt: new Date(now - 8 * 60 * 1000)
    };
    const activeOrderRes = await db.collection('food_orders').insertOne(activeOrderDoc);

    // Corresponding FoodTransaction
    await db.collection('payment_food_transactions').insertOne({
      orderId: activeOrderRes.insertedId,
      userId: user1._id,
      restaurantId: rest1Id,
      deliveryPartnerId: rider1Id,
      paymentMethod: 'cash',
      status: 'pending',
      currency: 'INR',
      pricing: activeOrderDoc.pricing,
      payment: {
        method: 'cash',
        status: 'cod_pending',
        amountDue: 543
      },
      createdAt: activeOrderDoc.createdAt,
      updatedAt: activeOrderDoc.updatedAt
    });

    // 6B. NEW INCOMING ORDER OFFER: FOD-OFFER-802 (unassigned, offered to rider 1)
    const offerOrderDoc = {
      order_id: 'FOD-OFFER-802',
      orderId: 'FOD-OFFER-802',
      userId: user2._id,
      customerName: 'Priya Patel',
      customerPhone: '9827653542',
      restaurantId: rest2Id,
      restaurantName: 'The Royal Maratha',
      restaurantPhone: '9000000000',
      restaurantAddress: '56 Dukan, New Palasia, Indore, Madhya Pradesh 452001',
      restaurantLocation: {
        type: 'Point',
        coordinates: [75.8820, 22.7230],
        latitude: 22.7230,
        longitude: 75.8820
      },
      orderStatus: 'ready_for_pickup',
      riderEarning: 75,
      deliveryDistanceKm: 4.8,
      items: [
        { itemId: new mongoose.Types.ObjectId(), name: 'Special Chicken Thali', price: 320, quantity: 1, isVeg: false },
        { itemId: new mongoose.Types.ObjectId(), name: 'Sol Kadhi', price: 60, quantity: 2, isVeg: true }
      ],
      pricing: {
        subtotal: 440,
        tax: 22,
        packagingFee: 20,
        deliveryFee: 50,
        platformFee: 5,
        total: 537,
        currency: 'INR'
      },
      payment: {
        method: 'online',
        status: 'paid',
        amountDue: 0
      },
      deliveryAddress: {
        label: 'Office',
        name: 'Priya Patel',
        phone: '9827653542',
        street: 'Building 4, Apollo DB City, Nipania',
        area: 'Nipania',
        city: 'Indore',
        state: 'Madhya Pradesh',
        zipCode: '452016',
        location: {
          type: 'Point',
          coordinates: [75.9080, 22.7480],
          latitude: 22.7480,
          longitude: 75.9080
        }
      },
      dispatch: {
        modeAtCreation: 'auto',
        status: 'unassigned',
        offeredTo: [{ partnerId: rider1Id, action: 'offered', at: new Date(now - 1 * 60 * 1000) }]
      },
      deliveryState: {
        currentPhase: 'at_pickup'
      },
      createdAt: new Date(now - 15 * 60 * 1000),
      updatedAt: new Date(now - 1 * 60 * 1000)
    };
    const offerRes = await db.collection('food_orders').insertOne(offerOrderDoc);
    await db.collection('payment_food_transactions').insertOne({
      orderId: offerRes.insertedId,
      userId: user2._id,
      restaurantId: rest2Id,
      paymentMethod: 'razorpay',
      status: 'captured',
      currency: 'INR',
      pricing: offerOrderDoc.pricing,
      payment: {
        method: 'razorpay',
        status: 'paid',
        amountDue: 0
      },
      createdAt: offerOrderDoc.createdAt,
      updatedAt: offerOrderDoc.updatedAt
    });

    // 6C. DELIVERED COMPLETED ORDERS (for Trip History & Wallet Earnings)
    const completedRider1Trips = [
      {
        orderId: 'FOD-HIST-701',
        deliveredMinutesAgo: 90,
        restId: rest1Id,
        restName: 'Corporate Kitchen',
        customer: 'Aman Gupta',
        phone: '9898989898',
        address: '12, Geeta Bhawan Square, Indore',
        earning: 55,
        total: 380,
        method: 'cash',
        dist: 2.1
      },
      {
        orderId: 'FOD-HIST-702',
        deliveredMinutesAgo: 210,
        restId: rest3Id,
        restName: 'Sarafa Street Bites',
        customer: 'Neha Sharma',
        phone: '9876543210',
        address: 'B-24, Old Palasia, Indore',
        earning: 45,
        total: 260,
        method: 'online',
        dist: 1.8
      },
      {
        orderId: 'FOD-HIST-703',
        deliveredMinutesAgo: 24 * 60 + 30, // yesterday
        restId: rest1Id,
        restName: 'Corporate Kitchen',
        customer: 'Vikas Joshi',
        phone: '9827653542',
        address: 'Flat 101, Sky Park, AB Road, Indore',
        earning: 65,
        total: 510,
        method: 'online',
        dist: 3.5
      },
      {
        orderId: 'FOD-HIST-704',
        deliveredMinutesAgo: 26 * 60, // yesterday
        restId: rest2Id,
        restName: 'The Royal Maratha',
        customer: 'Pooja Verma',
        phone: '9876543210',
        address: '45, Scheme 54, Vijay Nagar, Indore',
        earning: 70,
        total: 480,
        method: 'cash',
        dist: 4.2
      },
      {
        orderId: 'FOD-HIST-705',
        deliveredMinutesAgo: 48 * 60 + 40, // 2 days ago
        restId: rest3Id,
        restName: 'Sarafa Street Bites',
        customer: 'Rajesh Rathore',
        phone: '9898989898',
        address: 'Sector C, Mahalaxmi Nagar, Indore',
        earning: 50,
        total: 340,
        method: 'online',
        dist: 3.0
      },
      {
        orderId: 'FOD-HIST-706',
        deliveredMinutesAgo: 72 * 60 + 10, // 3 days ago
        restId: rest1Id,
        restName: 'Corporate Kitchen',
        customer: 'Kavita Jain',
        phone: '9827653542',
        address: 'Shalimar Township, Indore',
        earning: 80,
        total: 690,
        method: 'cash',
        dist: 5.2
      }
    ];

    for (const trip of completedRider1Trips) {
      const deliveredTime = new Date(now - trip.deliveredMinutesAgo * 60 * 1000);
      const createdTime = new Date(deliveredTime.getTime() - 40 * 60 * 1000);

      const ordDoc = {
        order_id: trip.orderId,
        orderId: trip.orderId,
        userId: user1._id,
        customerName: trip.customer,
        customerPhone: trip.phone,
        restaurantId: trip.restId,
        restaurantName: trip.restName,
        restaurantAddress: 'Indore, Madhya Pradesh',
        restaurantLocation: { type: 'Point', coordinates: [75.8732, 22.7169] },
        orderStatus: 'delivered',
        riderEarning: trip.earning,
        deliveryDistanceKm: trip.dist,
        items: [
          { itemId: new mongoose.Types.ObjectId(), name: 'Delicious Specialty Meal', price: trip.total - 60, quantity: 1, isVeg: true }
        ],
        pricing: {
          subtotal: trip.total - 60,
          tax: 15,
          packagingFee: 15,
          deliveryFee: 30,
          total: trip.total,
          currency: 'INR'
        },
        payment: {
          method: trip.method,
          status: 'paid',
          amountDue: 0
        },
        deliveryAddress: {
          label: 'Delivery Point',
          name: trip.customer,
          phone: trip.phone,
          street: trip.address,
          city: 'Indore',
          state: 'Madhya Pradesh',
          zipCode: '452001',
          location: { type: 'Point', coordinates: [75.8850, 22.7300] }
        },
        dispatch: {
          modeAtCreation: 'auto',
          status: 'accepted',
          deliveryPartnerId: rider1Id,
          assignedAt: new Date(createdTime.getTime() + 5 * 60 * 1000),
          acceptedAt: new Date(createdTime.getTime() + 7 * 60 * 1000),
        },
        deliveryState: {
          currentPhase: 'delivered',
          pickedUpAt: new Date(createdTime.getTime() + 20 * 60 * 1000),
          deliveredAt: deliveredTime
        },
        createdAt: createdTime,
        updatedAt: deliveredTime
      };

      const ins = await db.collection('food_orders').insertOne(ordDoc);
      await db.collection('payment_food_transactions').insertOne({
        orderId: ins.insertedId,
        userId: user1._id,
        restaurantId: trip.restId,
        deliveryPartnerId: rider1Id,
        paymentMethod: trip.method === 'cash' ? 'cash' : 'razorpay',
        status: 'captured',
        currency: 'INR',
        pricing: ordDoc.pricing,
        payment: {
          method: trip.method,
          status: 'paid',
          amountDue: 0
        },
        createdAt: createdTime,
        updatedAt: deliveredTime
      });
    }

    // 7. Seed Financial Transactions for Rider 1 (Withdrawals, Deposits, Bonus)
    console.log('Seeding financial records for Rider 1...');
    // 7A. Bonus
    await db.collection('payment_delivery_bonus_transactions').insertOne({
      deliveryPartnerId: rider1Id,
      transactionId: `BONUS-${now}-801`,
      amount: 200,
      reference: 'Weekend Peak Hours Incentive Bonus',
      createdAt: new Date(now - 12 * 3600 * 1000),
      updatedAt: new Date(now - 12 * 3600 * 1000)
    });

    // 7B. Completed Cash Deposit (Rider deposited cash collected back to platform)
    await db.collection('payment_delivery_cash_deposits').insertOne({
      deliveryPartnerId: rider1Id,
      amount: 1000,
      paymentMethod: 'cash',
      status: 'Completed',
      razorpayOrderId: `dep_order_${now}_801`,
      razorpayPaymentId: `pay_${now}_dep801`,
      adminNote: 'Cash limit settlement deposited at branch',
      createdAt: new Date(now - 24 * 3600 * 1000),
      updatedAt: new Date(now - 24 * 3600 * 1000)
    });

    // 7C. Approved Withdrawal
    await db.collection('payment_delivery_withdrawals').insertOne({
      deliveryPartnerId: rider1Id,
      amount: 200,
      status: 'approved',
      paymentMethod: 'bank_transfer',
      bankDetails: {
        accountNumber: '98765432101234',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        accountHolderName: 'Jharkhand Rasoi Rider Indore'
      },
      upiId: 'indorerider@okaxis',
      transactionId: `TXN-BANK-${now}-801`,
      adminNote: 'Processed via IMPS',
      processedAt: new Date(now - 36 * 3600 * 1000),
      createdAt: new Date(now - 38 * 3600 * 1000),
      updatedAt: new Date(now - 36 * 3600 * 1000)
    });

    // 7D. Support Tickets
    await db.collection('food_delivery_support_tickets').insertOne({
      deliveryPartnerId: rider1Id,
      ticketId: `TICK-8001`,
      subject: 'Weekly Incentive Payout Query',
      description: 'Requesting confirmation on credit of the weekend peak hours incentive bonus.',
      category: 'payment',
      priority: 'medium',
      status: 'resolved',
      adminResponse: 'Your incentive bonus of ₹200 has been approved and credited to your pocket balance.',
      respondedAt: new Date(now - 6 * 3600 * 1000),
      createdAt: new Date(now - 14 * 3600 * 1000),
      updatedAt: new Date(now - 6 * 3600 * 1000)
    });

    await db.collection('food_delivery_support_tickets').insertOne({
      deliveryPartnerId: rider1Id,
      ticketId: `TICK-8002`,
      subject: 'Rain Surge Allowance Clarification',
      description: 'Wanted to know if rain surge is automatically calculated for rainy weather slots.',
      category: 'other',
      priority: 'low',
      status: 'open',
      createdAt: new Date(now - 2 * 3600 * 1000),
      updatedAt: new Date(now - 2 * 3600 * 1000)
    });

    // 8. Seed Orders and Financials for Rider 2 (9755633147)
    console.log('Seeding orders and records for Rider 2 (9755633147)...');
    const rider2ActiveOrderDoc = {
      order_id: 'FOD-LIVE-971',
      orderId: 'FOD-LIVE-971',
      userId: user2._id,
      customerName: 'Anjali Dave',
      customerPhone: '9827653542',
      restaurantId: rest1Id,
      restaurantName: 'Corporate Kitchen',
      restaurantPhone: '9755633147',
      restaurantAddress: 'Corporate House, 169, RNT Marg, Indore, Madhya Pradesh 452001',
      restaurantLocation: {
        type: 'Point',
        coordinates: [75.8732, 22.7169],
        latitude: 22.7169,
        longitude: 75.8732
      },
      orderStatus: 'picked_up',
      riderEarning: 70,
      deliveryDistanceKm: 3.8,
      items: [
        { itemId: new mongoose.Types.ObjectId(), name: 'Executive Veg Thali', price: 280, quantity: 2, isVeg: true }
      ],
      pricing: {
        subtotal: 560,
        tax: 28,
        packagingFee: 20,
        deliveryFee: 40,
        total: 648,
        currency: 'INR'
      },
      payment: {
        method: 'online',
        status: 'paid',
        amountDue: 0
      },
      deliveryAddress: {
        label: 'Home',
        name: 'Anjali Dave',
        phone: '9827653542',
        street: '14, South Tukoganj, Near Chhavani',
        area: 'South Tukoganj',
        city: 'Indore',
        state: 'Madhya Pradesh',
        zipCode: '452001',
        location: {
          type: 'Point',
          coordinates: [75.8790, 22.7120],
          latitude: 22.7120,
          longitude: 75.8790
        }
      },
      dispatch: {
        modeAtCreation: 'auto',
        status: 'accepted',
        deliveryPartnerId: rider2Id,
        assignedAt: new Date(now - 15 * 60 * 1000),
        acceptedAt: new Date(now - 14 * 60 * 1000),
      },
      deliveryState: {
        currentPhase: 'en_route_to_delivery',
        pickedUpAt: new Date(now - 5 * 60 * 1000),
        pickupOtpVerified: true
      },
      createdAt: new Date(now - 25 * 60 * 1000),
      updatedAt: new Date(now - 5 * 60 * 1000)
    };
    rider2ActiveOrderDoc.deliveryOtp = '1234';
    const r2Ins = await db.collection('food_orders').insertOne(rider2ActiveOrderDoc);
    await db.collection('payment_food_transactions').insertOne({
      orderId: r2Ins.insertedId,
      userId: user2._id,
      restaurantId: rest1Id,
      deliveryPartnerId: rider2Id,
      paymentMethod: 'razorpay',
      status: 'captured',
      currency: 'INR',
      pricing: rider2ActiveOrderDoc.pricing,
      payment: {
        method: 'razorpay',
        status: 'paid',
        amountDue: 0
      },
      createdAt: rider2ActiveOrderDoc.createdAt,
      updatedAt: rider2ActiveOrderDoc.updatedAt
    });

    // 4 past delivered trips for Rider 2
    const rider2PastTrips = [
      { orderId: 'FOD-HIST-901', minutesAgo: 80, earning: 60, total: 390, method: 'cash' },
      { orderId: 'FOD-HIST-902', minutesAgo: 220, earning: 50, total: 290, method: 'online' },
      { orderId: 'FOD-HIST-903', minutesAgo: 24 * 60, earning: 75, total: 620, method: 'cash' },
      { orderId: 'FOD-HIST-904', minutesAgo: 48 * 60, earning: 55, total: 350, method: 'online' }
    ];

    for (const trip of rider2PastTrips) {
      const deliveredTime = new Date(now - trip.minutesAgo * 60 * 1000);
      const createdTime = new Date(deliveredTime.getTime() - 35 * 60 * 1000);

      const oDoc = {
        order_id: trip.orderId,
        orderId: trip.orderId,
        userId: user2._id,
        customerName: 'Corporate Client',
        customerPhone: '9827653542',
        restaurantId: rest1Id,
        restaurantName: 'Corporate Kitchen',
        restaurantAddress: 'RNT Marg, Indore',
        restaurantLocation: { type: 'Point', coordinates: [75.8732, 22.7169] },
        orderStatus: 'delivered',
        riderEarning: trip.earning,
        deliveryDistanceKm: 2.8,
        items: [{ itemId: new mongoose.Types.ObjectId(), name: 'Combo Meal', price: trip.total - 50, quantity: 1, isVeg: true }],
        pricing: { subtotal: trip.total - 50, tax: 15, deliveryFee: 35, total: trip.total, currency: 'INR' },
        payment: { method: trip.method, status: 'paid', amountDue: 0 },
        deliveryAddress: {
          label: 'Office',
          name: 'Corporate Client',
          phone: '9827653542',
          street: 'MG Road, Indore',
          city: 'Indore',
          state: 'Madhya Pradesh',
          zipCode: '452001',
          location: { type: 'Point', coordinates: [75.8760, 22.7200] }
        },
        dispatch: {
          modeAtCreation: 'auto',
          status: 'accepted',
          deliveryPartnerId: rider2Id,
          assignedAt: new Date(createdTime.getTime() + 5 * 60 * 1000),
          acceptedAt: new Date(createdTime.getTime() + 7 * 60 * 1000),
        },
        deliveryState: {
          currentPhase: 'delivered',
          pickedUpAt: new Date(createdTime.getTime() + 18 * 60 * 1000),
          deliveredAt: deliveredTime
        },
        createdAt: createdTime,
        updatedAt: deliveredTime
      };

      const ins = await db.collection('food_orders').insertOne(oDoc);
      await db.collection('payment_food_transactions').insertOne({
        orderId: ins.insertedId,
        userId: user2._id,
        restaurantId: rest1Id,
        deliveryPartnerId: rider2Id,
        paymentMethod: trip.method === 'cash' ? 'cash' : 'razorpay',
        status: 'captured',
        currency: 'INR',
        pricing: oDoc.pricing,
        payment: { method: trip.method, status: 'paid', amountDue: 0 },
        createdAt: createdTime,
        updatedAt: deliveredTime
      });
    }

    await db.collection('payment_delivery_bonus_transactions').insertOne({
      deliveryPartnerId: rider2Id,
      transactionId: `BONUS-${now}-971`,
      amount: 250,
      reference: 'Corporate Express High-Rating Bonus',
      createdAt: new Date(now - 18 * 3600 * 1000),
      updatedAt: new Date(now - 18 * 3600 * 1000)
    });

    await db.collection('payment_delivery_cash_deposits').insertOne({
      deliveryPartnerId: rider2Id,
      amount: 800,
      paymentMethod: 'cash',
      status: 'Completed',
      razorpayOrderId: `dep_order_${now}_971`,
      razorpayPaymentId: `pay_${now}_dep971`,
      adminNote: 'Cash limit settlement deposited via UPI',
      createdAt: new Date(now - 20 * 3600 * 1000),
      updatedAt: new Date(now - 20 * 3600 * 1000)
    });

    await db.collection('payment_delivery_withdrawals').insertOne({
      deliveryPartnerId: rider2Id,
      amount: 300,
      status: 'approved',
      paymentMethod: 'bank_transfer',
      bankDetails: {
        accountNumber: '12345678909755',
        ifscCode: 'ICIC0000975',
        bankName: 'ICICI Bank',
        accountHolderName: 'Corporate Delivery Express'
      },
      upiId: 'corporate9755@icici',
      transactionId: `TXN-BANK-${now}-971`,
      adminNote: 'Processed to ICICI account',
      processedAt: new Date(now - 28 * 3600 * 1000),
      createdAt: new Date(now - 30 * 3600 * 1000),
      updatedAt: new Date(now - 28 * 3600 * 1000)
    });

    // 9. Admin Settings: Cash Limit, Multi-Order, Emergency Help, Earning Addon
    console.log('Seeding Admin Delivery Settings...');

    // 9A. Cash Limit Settings
    await db.collection('payment_delivery_cash_limits').deleteMany({});
    await db.collection('payment_delivery_cash_limits').insertOne({
      deliveryCashLimit: 3000,
      deliveryWithdrawalLimit: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 9B. Multi Order Settings
    await db.collection('food_delivery_multi_order_settings').deleteMany({});
    await db.collection('food_delivery_multi_order_settings').insertOne({
      enabled: true,
      maxConcurrentOrders: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 9C. Emergency Help Numbers
    await db.collection('food_delivery_emergency_help').deleteMany({});
    await db.collection('food_delivery_emergency_help').insertOne({
      medicalEmergency: '108',
      accidentHelpline: '1073',
      contactPolice: '112',
      insurance: '1800-258-9999',
      teamLeader: '+91 9755633147',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 9D. Live Target Offer / Earning Addon for Pocket page
    await db.collection('food_earning_addons').deleteMany({});
    await db.collection('food_earning_addons').insertOne({
      title: 'Weekend Super Target',
      description: 'Complete 10 deliveries this week to unlock an extra ₹300 incentive bonus!',
      requiredOrders: 10,
      earningAmount: 300,
      startDate: new Date(now - 2 * 24 * 3600 * 1000),
      endDate: new Date(now + 5 * 24 * 3600 * 1000),
      maxRedemptions: 50,
      currentRedemptions: 4,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('========================================================');
    console.log(' Delivery App Showcase Data Seeded Successfully!');
    console.log('========================================================');
    console.log('Rider 1:');
    console.log('  Phone: 8000000000');
    console.log('  Name: Jharkhand Rasoi Rider Indore');
    console.log('  Active Order: FOD-LIVE-801 (picked_up, COD)');
    console.log('  Offer Available: FOD-OFFER-802 (The Royal Maratha)');
    console.log('  Completed Trips: 6 trips in history');
    console.log('--------------------------------------------------------');
    console.log('Rider 2:');
    console.log('  Phone: 9755633147');
    console.log('  Name: Corporate Delivery Express');
    console.log('  Active Order: FOD-LIVE-971 (picked_up, Online)');
    console.log('  Completed Trips: 4 trips in history');
    console.log('--------------------------------------------------------');
    console.log('Test OTP: 123456 (USE_DEFAULT_OTP=true)');
    console.log('Cash Limit: ₹3,000 | Min Withdrawal: ₹100');
    console.log('Multi-Order: Enabled (Max 3 concurrent)');
    console.log('========================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed delivery showcase:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDeliveryShowcase();
