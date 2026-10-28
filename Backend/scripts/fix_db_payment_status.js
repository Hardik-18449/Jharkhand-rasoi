import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tuggo');
  const allowed = ['cod_pending', 'pending', 'created', 'authorized', 'paid', 'failed', 'refunded', 'pending_qr'];
  
  const invalid = await mongoose.connection.collection('food_orders').find({
    'payment.status': { $nin: allowed }
  }).project({ orderId: 1, payment: 1 }).toArray();
  
  console.log('Invalid orders found:', invalid.length);
  invalid.forEach(o => console.log('Order:', o.orderId, 'Payment:', o.payment));

  for (const o of invalid) {
    let nextStatus = 'cod_pending';
    const curr = String(o.payment?.status || '').toLowerCase();
    if (curr === 'completed' || curr === 'success') {
      nextStatus = 'paid';
    } else if (o.payment?.method === 'cash') {
      nextStatus = 'cod_pending';
    } else {
      nextStatus = 'created';
    }
    await mongoose.connection.collection('food_orders').updateOne(
      { _id: o._id },
      { $set: { 'payment.status': nextStatus } }
    );
    console.log(`Fixed order ${o.orderId}: ${curr} -> ${nextStatus}`);
  }

  // Also update seed_delivery_showcase.js
  const remaining = await mongoose.connection.collection('food_orders').countDocuments({
    'payment.status': { $nin: allowed }
  });
  console.log('Remaining invalid orders:', remaining);

  await mongoose.disconnect();
}
run().catch(console.error);
