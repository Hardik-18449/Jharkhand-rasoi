const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tuggo');
  const FoodOrder = mongoose.model('FoodOrder', new mongoose.Schema({}, { strict: false, collection: 'food_orders' }));
  
  // Test pending filter
  const pendingOrders = await FoodOrder.find({ orderStatus: { $in: ['created', 'pending'] } })
    .select('orderId orderStatus customerName pricing.total payment.method')
    .lean();
  console.log('Pending orders count in DB:', pendingOrders.length);
  pendingOrders.forEach(o => {
    console.log(`- ${o.orderId} | Status: ${o.orderStatus} | Customer: ${o.customerName} | Method: ${o.payment?.method} | Total: ₹${o.pricing?.total}`);
  });

  const badgePendingCount = await FoodOrder.countDocuments({ orderStatus: { $in: ['pending', 'created'] } });
  console.log('\nBadge pending orders count:', badgePendingCount);

  await mongoose.disconnect();
}
test().catch(err => {
  console.error(err);
  process.exit(1);
});
