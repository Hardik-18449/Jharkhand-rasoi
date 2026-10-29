import mongoose from 'mongoose';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-10);
}

/**
 * Get dedicated delivery partners and settings for a restaurant/franchise.
 */
export async function getDedicatedDeliveryOverview(restaurantId) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const [restaurant, riders] = await Promise.all([
    FoodRestaurant.findById(restaurantId).select('deliverySettings restaurantName restaurantType').lean(),
    FoodDeliveryPartner.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    })
      .select('name phone vehicleType vehicleNumber availabilityStatus status rating totalRatings createdAt lastLat lastLng lastLocationAt')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  const deliverySettings = {
    hasDedicatedDelivery: Boolean(riders.length > 0),
    openForPublicDelivery: restaurant.deliverySettings?.openForPublicDelivery !== false, // default true
  };

  const onlineCount = riders.filter((r) => r.availabilityStatus === 'online').length;

  return {
    deliverySettings,
    riders,
    totalRiders: riders.length,
    onlineRiders: onlineCount,
  };
}

/**
 * Add or link a dedicated delivery partner to a restaurant/franchise.
 */
export async function addDedicatedRider(restaurantId, data = {}) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const name = String(data.name || '').trim();
  const rawPhone = String(data.phone || '').trim();
  const phone = normalizePhone(rawPhone);

  if (!name) throw new ValidationError('Rider name is required');
  if (!phone || phone.length !== 10) throw new ValidationError('A valid 10-digit mobile number is required');

  const vehicleType = String(data.vehicleType || 'Bike').trim();
  const vehicleNumber = String(data.vehicleNumber || '').trim().toUpperCase();

  // Check if delivery partner already exists with this phone
  let partner = await FoodDeliveryPartner.findOne({ phone });

  if (partner) {
    if (partner.restaurantId && String(partner.restaurantId) !== String(restaurantId)) {
      throw new ValidationError('This delivery partner is already assigned to another restaurant');
    }

    partner.name = name || partner.name;
    partner.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    partner.partnerType = 'dedicated';
    partner.status = 'approved';
    if (!partner.approvedAt) partner.approvedAt = new Date();
    if (vehicleType) partner.vehicleType = vehicleType;
    if (vehicleNumber) partner.vehicleNumber = vehicleNumber;
    await partner.save();

    logger.info(`[DedicatedRider] Linked existing rider ${partner._id} (${phone}) to restaurant ${restaurantId}`);
  } else {
    partner = await FoodDeliveryPartner.create({
      name,
      phone,
      countryCode: '+91',
      vehicleType,
      vehicleNumber: vehicleNumber || undefined,
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      partnerType: 'dedicated',
      status: 'approved',
      approvedAt: new Date(),
      availabilityStatus: 'offline',
    });

    logger.info(`[DedicatedRider] Created new dedicated rider ${partner._id} (${phone}) for restaurant ${restaurantId}`);
  }

  // Update restaurant deliverySettings
  await FoodRestaurant.findByIdAndUpdate(restaurantId, {
    $set: { 'deliverySettings.hasDedicatedDelivery': true },
  });

  return partner.toObject();
}

/**
 * Remove / unlink dedicated delivery partner from restaurant.
 */
export async function removeDedicatedRider(restaurantId, riderId) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId) || !mongoose.Types.ObjectId.isValid(riderId)) {
    throw new ValidationError('Invalid IDs provided');
  }

  const rider = await FoodDeliveryPartner.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(riderId),
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    },
    {
      $set: {
        restaurantId: null,
        partnerType: 'platform',
      },
    },
    { new: true }
  );

  if (!rider) {
    throw new NotFoundError('Dedicated rider not found for this restaurant');
  }

  // Check remaining riders
  const remainingCount = await FoodDeliveryPartner.countDocuments({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (remainingCount === 0) {
    await FoodRestaurant.findByIdAndUpdate(restaurantId, {
      $set: { 'deliverySettings.hasDedicatedDelivery': false },
    });
  }

  logger.info(`[DedicatedRider] Unlinked rider ${riderId} from restaurant ${restaurantId}`);
  return { success: true };
}

/**
 * Update delivery dispatch toggle (Open for all zone riders vs dedicated riders only).
 */
export async function updateDeliveryDispatchToggle(restaurantId, { openForPublicDelivery }) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError('Invalid restaurant ID');
  }

  const isOpen = Boolean(openForPublicDelivery);

  const updated = await FoodRestaurant.findByIdAndUpdate(
    restaurantId,
    {
      $set: {
        'deliverySettings.openForPublicDelivery': isOpen,
      },
    },
    { new: true }
  ).select('deliverySettings');

  logger.info(`[DedicatedRider] Restaurant ${restaurantId} delivery toggle updated: openForPublicDelivery = ${isOpen}`);
  return updated?.deliverySettings || { openForPublicDelivery: isOpen };
}
