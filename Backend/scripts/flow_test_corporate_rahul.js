import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';

async function runCorporateRahulFlowTest() {
  console.log('================================================================');
  console.log('🚀 TESTING FULL END-TO-END FLOW: RAHUL -> CORPORATE KITCHEN -> RIDER -> DELIVERED');
  console.log('================================================================');

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const { FoodOrder } = await import('../src/modules/food/orders/models/order.model.js');
  const { FoodTransaction } = await import('../src/modules/food/orders/models/foodTransaction.model.js');
  const { FoodRestaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js');
  const { FoodDeliveryPartner } = await import('../src/modules/food/delivery/models/deliveryPartner.model.js');
  const { FoodUser } = await import('../src/core/users/user.model.js');
  const orderService = await import('../src/modules/food/orders/services/order.service.js');
  const orderDeliveryService = await import('../src/modules/food/orders/services/order-delivery.service.js');

  // 1. Fetch Actors
  const corpRest = await FoodRestaurant.findOne({ ownerPhone: '9755633147' });
  if (!corpRest) throw new Error('Corporate Kitchen restaurant not found!');

  let userRahul = await FoodUser.findOne({ phone: '9876543210' });
  if (!userRahul) {
    userRahul = await FoodUser.create({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul.sharma@example.com',
      role: 'USER',
      isActive: true,
      isVerified: true
    });
  }

  const rider = await FoodDeliveryPartner.findOne({ phone: '8000000000' });
  if (!rider) throw new Error('Rider 8000000000 not found!');

  console.log('✅ Actors Loaded:');
  console.log(`   Customer:   ${userRahul.name} (${userRahul.phone})`);
  console.log(`   Restaurant: ${corpRest.restaurantName} (Phone: ${corpRest.ownerPhone}, ID: ${corpRest._id})`);
  console.log(`   Rider:      ${rider.name} (Phone: ${rider.phone}, ID: ${rider._id})`);

  // Ensure restaurant is active and accepting orders
  corpRest.status = 'approved';
  corpRest.isAcceptingOrders = true;
  await corpRest.save();

  // 2. Step 1: User Rahul Places Order
  console.log('\n--- Step 1: Placing Order FOD-RAHUL-FLOW-1 from Rahul ---');
  const orderId = 'FOD-RAHUL-FLOW-1';

  // Remove any previous test order with this ID
  const prevOrder = await FoodOrder.findOne({ orderId });
  if (prevOrder) {
    await FoodTransaction.deleteMany({ orderId: prevOrder._id });
    await FoodOrder.deleteOne({ _id: prevOrder._id });
  }

  const orderPricing = {
    subtotal: 420,
    tax: 21,
    packagingFee: 15,
    deliveryFee: 35,
    platformFee: 4,
    restaurantCommission: 63,
    discount: 0,
    total: 495,
    currency: 'INR'
  };

  const newOrderDoc = new FoodOrder({
    order_id: orderId,
    orderId: orderId,
    userId: userRahul._id,
    customerName: userRahul.name,
    customerPhone: userRahul.phone,
    restaurantId: corpRest._id,
    restaurantName: corpRest.restaurantName,
    restaurantPhone: corpRest.ownerPhone,
    restaurantAddress: corpRest.formattedAddress || corpRest.addressLine1 || 'RNT Marg, Indore',
    restaurantLocation: corpRest.location || {
      type: 'Point',
      coordinates: [75.8732, 22.7169],
      latitude: 22.7169,
      longitude: 75.8732
    },
    orderStatus: 'created',
    riderEarning: 60,
    deliveryDistanceKm: 3.2,
    items: [
      { itemId: new mongoose.Types.ObjectId(), name: 'Paneer Butter Masala', price: 240, quantity: 1, isVeg: true },
      { itemId: new mongoose.Types.ObjectId(), name: 'Butter Naan', price: 45, quantity: 2, isVeg: true },
      { itemId: new mongoose.Types.ObjectId(), name: 'Chilled Cold Coffee', price: 90, quantity: 1, isVeg: true }
    ],
    pricing: orderPricing,
    paymentMethod: 'cash',
    payment: {
      method: 'cash',
      status: 'cod_pending',
      amountDue: 495
    },
    deliveryAddress: {
      formattedAddress: 'Flat 402, Shalimar Palms, Pipliyahana, Indore, MP 452016',
      addressLine1: 'Flat 402, Shalimar Palms',
      street: 'Flat 402, Shalimar Palms',
      area: 'Pipliyahana',
      city: 'Indore',
      state: 'Madhya Pradesh',
      zipCode: '452016',
      location: {
        type: 'Point',
        coordinates: [75.8920, 22.7150],
        latitude: 22.7150,
        longitude: 75.8920
      }
    },
    dispatch: {
      modeAtCreation: 'auto',
      status: 'unassigned',
      offeredTo: [{ partnerId: rider._id, action: 'offered', at: new Date() }]
    },
    deliveryVerification: {
      dropOtp: { required: true, verified: false, code: '1234' },
      pickupOtp: { required: true, verified: false, code: '1234' }
    },
    deliveryOtp: '1234',
    pickupOtp: '1234',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const savedOrder = await newOrderDoc.save();

  const makeAmounts = (pricing) => ({
    totalCustomerPaid: pricing.total,
    restaurantShare: (pricing.subtotal || 0) - (pricing.restaurantCommission || 0),
    restaurantCommission: pricing.restaurantCommission || 0,
    riderShare: pricing.deliveryFee || 40,
    platformNetProfit: (pricing.platformFee || 5) + (pricing.restaurantCommission || 0),
    gstOnItem: pricing.tax || 0,
    gstOnCommission: 0,
    paymentGatewayFee: 0,
    tcs: 0,
    taxAmount: pricing.tax || 0
  });

  // Create corresponding transaction in payment_food_transactions
  const newTx = new FoodTransaction({
    orderId: savedOrder._id,
    userId: userRahul._id,
    restaurantId: corpRest._id,
    paymentMethod: 'cash',
    status: 'pending',
    currency: 'INR',
    pricing: orderPricing,
    amounts: makeAmounts(orderPricing),
    payment: {
      method: 'cash',
      status: 'cod_pending',
      amountDue: 495
    }
  });
  await newTx.save();

  console.log(`✅ Order ${orderId} created (Mongo ID: ${savedOrder._id})`);
  console.log(`   Initial Status: ${savedOrder.orderStatus} | Payment: ${savedOrder.payment?.status} (₹${orderPricing.total})`);

  // 3. Step 2: Restaurant Accepts the Order
  console.log('\n--- Step 2: Restaurant Corporate Kitchen Accepts Order ---');
  await orderService.updateOrderStatusRestaurant(savedOrder._id.toString(), corpRest._id.toString(), 'preparing', 'Kitchen accepted order, cooking started');
  let currentOrder = await FoodOrder.findById(savedOrder._id);
  console.log(`✅ Order status updated by restaurant: ${currentOrder.orderStatus}`);

  // Restaurant Marks Order as Ready for Pickup
  console.log('\n--- Step 3: Restaurant Marks Order Ready for Pickup ---');
  await orderService.updateOrderStatusRestaurant(savedOrder._id.toString(), corpRest._id.toString(), 'ready_for_pickup', 'Food packed and ready for delivery partner');
  currentOrder = await FoodOrder.findById(savedOrder._id);
  console.log(`✅ Order status updated to: ${currentOrder.orderStatus}`);

  // 4. Step 4: Delivery Partner Accepts Order
  console.log('\n--- Step 4: Delivery Partner (8000000000) Accepts Order ---');
  await orderDeliveryService.acceptOrderDelivery(savedOrder._id.toString(), rider._id.toString());
  currentOrder = await FoodOrder.findById(savedOrder._id);
  console.log(`✅ Delivery partner accepted order. Status: ${currentOrder.orderStatus} | Dispatch: ${currentOrder.dispatch?.status}`);

  // 5. Step 5: Delivery Partner Reaches Restaurant & Picks Up Food
  console.log('\n--- Step 5: Rider Reaches Pickup & Picks Up Food ---');
  await orderDeliveryService.updateOrderStatusDelivery(savedOrder._id.toString(), rider._id.toString(), 'reached_pickup');
  console.log('✅ Rider reached restaurant (reached_pickup)');

  await orderDeliveryService.updateOrderStatusDelivery(savedOrder._id.toString(), rider._id.toString(), 'picked_up');
  currentOrder = await FoodOrder.findById(savedOrder._id);
  console.log(`✅ Food picked up! Order status: ${currentOrder.orderStatus} | Phase: ${currentOrder.deliveryState?.currentPhase}`);

  // 6. Step 6: Rider Reaches Customer Drop
  console.log('\n--- Step 6: Rider Reaches Customer Drop ---');
  await orderDeliveryService.confirmReachedDropDelivery(savedOrder._id.toString(), rider._id.toString());
  currentOrder = await FoodOrder.findById(savedOrder._id);
  console.log(`✅ Reached drop confirmed. Phase: ${currentOrder.deliveryState?.currentPhase}`);

  // 7. Step 7: Verify Handover Code (1234)
  console.log('\n--- Step 7: Verifying Handover Code (1234) ---');
  const otpRes = await orderDeliveryService.verifyDropOtpDelivery(savedOrder._id.toString(), rider._id.toString(), '1234');
  console.log(`✅ Handover OTP 1234 verified successfully!`);

  // 8. Step 8: Confirm Cash Collection & Complete Delivery
  console.log('\n--- Step 8: Complete Delivery & Cash Settlement (₹495) ---');
  const finalOrder = await orderDeliveryService.completeDelivery(savedOrder._id.toString(), rider._id.toString(), {
    otp: '1234',
    paymentMethod: 'cash',
    paymentOverride: 'cash',
    ratings: { rating: 5, review: 'Super fast delivery and hot food!' }
  });

  const finalTx = await FoodTransaction.findOne({ orderId: savedOrder._id });
  console.log(`✅ ORDER SUCCESSFULLY DELIVERED!`);
  console.log(`   Final Order Status:   ${finalOrder.orderStatus}`);
  console.log(`   Payment Status:       ${finalOrder.payment?.status}`);
  console.log(`   Transaction Status:   ${finalTx?.status} (Payment: ${finalTx?.payment?.status})`);
  console.log(`   Delivery Phase:       ${finalOrder.deliveryState?.currentPhase}`);

  // 9. Step 9: Seed LIVE Interactive Order for the User to test in UI
  console.log('\n================================================================');
  console.log('🍽️ CREATING FRESH INCOMING ORDER FOR UI TESTING (FOD-RAHUL-CORP-02)');
  console.log('================================================================');

  const liveUiOrderId = 'FOD-RAHUL-CORP-02';
  const prevUiOrder = await FoodOrder.findOne({ orderId: liveUiOrderId });
  if (prevUiOrder) {
    await FoodTransaction.deleteMany({ orderId: prevUiOrder._id });
    await FoodOrder.deleteOne({ _id: prevUiOrder._id });
  }

  const uiOrderDoc = new FoodOrder({
    order_id: liveUiOrderId,
    orderId: liveUiOrderId,
    userId: userRahul._id,
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    restaurantId: corpRest._id,
    restaurantName: corpRest.restaurantName,
    restaurantPhone: corpRest.ownerPhone,
    restaurantAddress: corpRest.formattedAddress || 'Corporate House, 169, RNT Marg, Indore, Madhya Pradesh 452001',
    restaurantLocation: {
      type: 'Point',
      coordinates: [75.8732, 22.7169],
      latitude: 22.7169,
      longitude: 75.8732
    },
    orderStatus: 'created',
    riderEarning: 65,
    deliveryDistanceKm: 3.5,
    items: [
      { itemId: new mongoose.Types.ObjectId(), name: 'Hyderabadi Chicken Dum Biryani', price: 280, quantity: 1, isVeg: false },
      { itemId: new mongoose.Types.ObjectId(), name: 'Hot Gulab Jamun (2 Pcs)', price: 70, quantity: 2, isVeg: true }
    ],
    pricing: {
      subtotal: 420,
      tax: 21,
      packagingFee: 20,
      deliveryFee: 40,
      platformFee: 5,
      restaurantCommission: 63,
      discount: 0,
      total: 506,
      currency: 'INR'
    },
    paymentMethod: 'cash',
    payment: {
      method: 'cash',
      status: 'cod_pending',
      amountDue: 506
    },
    deliveryAddress: {
      formattedAddress: 'Flat 301, Silver Crest, South Tukoganj, Indore, MP 452001',
      addressLine1: 'Flat 301, Silver Crest',
      street: 'Flat 301, Silver Crest',
      area: 'South Tukoganj',
      city: 'Indore',
      state: 'Madhya Pradesh',
      zipCode: '452001',
      location: {
        type: 'Point',
        coordinates: [75.8812, 22.7180],
        latitude: 22.7180,
        longitude: 75.8812
      }
    },
    dispatch: {
      modeAtCreation: 'auto',
      status: 'unassigned',
      offeredTo: [{ partnerId: rider._id, action: 'offered', at: new Date() }]
    },
    deliveryVerification: {
      dropOtp: { required: true, verified: false, code: '1234' },
      pickupOtp: { required: true, verified: false, code: '1234' }
    },
    deliveryOtp: '1234',
    pickupOtp: '1234',
    note: 'Please deliver near reception, call when arriving.',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const uiOrderRes = await uiOrderDoc.save();

  await new FoodTransaction({
    orderId: uiOrderRes._id,
    userId: userRahul._id,
    restaurantId: corpRest._id,
    paymentMethod: 'cash',
    status: 'pending',
    currency: 'INR',
    pricing: uiOrderDoc.pricing,
    amounts: makeAmounts(uiOrderDoc.pricing),
    payment: {
      method: 'cash',
      status: 'cod_pending',
      amountDue: 506
    }
  }).save();

  console.log(`✅ NEW LIVE ORDER READY IN UI: ${liveUiOrderId}`);
  console.log(`   Customer:   Rahul Sharma (9876543210)`);
  console.log(`   Restaurant: Corporate Kitchen (9755633147)`);
  console.log(`   Items:      Hyderabadi Chicken Dum Biryani + Hot Gulab Jamun`);
  console.log(`   Bill:       ₹506 (COD)`);
  console.log(`   Status:     'pending' (Ready for Restaurant to Accept!)`);
  console.log(`   Handover Code: 1234`);
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runCorporateRahulFlowTest().catch(async (err) => {
  console.error('❌ FLOW TEST FAILED:', err);
  await mongoose.disconnect();
  process.exit(1);
});
