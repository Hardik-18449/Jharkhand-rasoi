const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tuggo');

  const { createOrder } = await import('../src/modules/food/orders/services/order.service.js');
  const { FoodUser } = await import('../src/core/users/user.model.js');
  const { FoodRestaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js');

  const user = await FoodUser.findOne({ phone: '9876543210' }).lean();
  const restaurant = await FoodRestaurant.findOne({ status: 'approved', isAcceptingOrders: true }).lean();

  console.log('Testing checkout with minimal address (pinpoint with no street)...');
  const orderDto = {
    restaurantId: restaurant._id.toString(),
    items: [
      {
        itemId: new mongoose.Types.ObjectId().toString(),
        name: 'Hyderabadi Biryani',
        price: 320,
        quantity: 1,
      }
    ],
    address: {
      label: 'Home',
      // street omitted/blank intentionally to test resilience
      city: 'Indore',
      location: {
        coordinates: [75.8577, 22.7196]
      }
    },
    paymentMethod: 'cash',
    pricing: {
      subtotal: 320,
      deliveryFee: 30,
      tax: 16,
      platformFee: 5,
      total: 371
    }
  };

  try {
    const created = await createOrder(user._id.toString(), orderDto);
    console.log('✅ Order created successfully without any crash!');
    console.log('   Order ID:', created.orderId || created.orderNumber);
    console.log('   Status:', created.orderStatus);
    console.log('   Delivery Street fallback:', created.deliveryAddress?.street);
    console.log('   Delivery City fallback:', created.deliveryAddress?.city);
  } catch (err) {
    console.error('❌ Order checkout failed:', err.message, err);
  }

  await mongoose.disconnect();
}

test();
