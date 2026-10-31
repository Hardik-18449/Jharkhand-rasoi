import { sendResponse } from '../../../../utils/response.js';
import * as orderService from '../services/order.service.js';
import * as foodOrderPaymentService from '../services/foodOrderPayment.service.js';
import { checkRidersAvailabilityInZone } from '../services/order-dispatch.service.js';
import { FoodOrder } from '../models/order.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import {
    validateCalculateOrderDto,
    validateCreateOrderDto,
    validateVerifyPaymentDto,
    validateCancelOrderDto,
    validateOrderStatusDto,
    validateAssignDeliveryDto,
    validateDispatchSettingsDto,
    validateOrderRatingsDto
} from '../validators/order.validator.js';

export async function checkRiderAvailabilityController(req, res, next) {
    try {
        const { restaurantId, zoneId } = req.query;
        const result = await checkRidersAvailabilityInZone({ restaurantId, zoneId });
        return sendResponse(res, 200, 'Rider availability checked', result);
    } catch (err) {
        next(err);
    }
}

export async function calculateOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCalculateOrderDto(req.body);
        const result = await orderService.calculateOrder(userId, dto);
        return sendResponse(res, 200, 'Pricing calculated', result);
    } catch (err) {
        console.error("calculateOrderController error:", err);
        next(err);
    }
}

export async function createOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCreateOrderDto(req.body);
        const result = await orderService.createOrder(userId, dto);
        return sendResponse(res, 201, 'Order placed successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function verifyPaymentController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateVerifyPaymentDto(req.body);
        const result = await orderService.verifyPayment(userId, dto);
        return sendResponse(res, 200, 'Payment verified', result);
    } catch (err) {
        next(err);
    }
}

export async function listOrdersUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const result = await orderService.listOrdersUser(userId, req.query);
        return sendResponse(res, 200, 'Orders retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { userId });
        return sendResponse(res, 200, 'Order retrieved', { order });
    } catch (err) {
        next(err);
    }
}

export async function getOrderDropOtpUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.getDropOtpUser(orderId, userId);
        return sendResponse(res, 200, 'Drop OTP retrieved', result);
    } catch (err) {
        next(err);
    }
}

/** Ledger rows from `food_order_payments` (append-only audit trail) */
export async function getOrderPaymentsUserController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await foodOrderPaymentService.listFoodOrderPaymentsForUser(orderId, userId);
        return sendResponse(res, 200, 'Payment history', result);
    } catch (err) {
        next(err);
    }
}

export async function cancelOrderController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateCancelOrderDto(req.body);
        const order = await orderService.cancelOrder(orderId, userId, dto.reason, dto.refundDestination);
        return sendResponse(res, 200, 'Order cancelled', { order });
    } catch (err) {
        next(err);
    }
}

export async function submitOrderRatingsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderRatingsDto(req.body);
        const order = await orderService.submitOrderRatings(orderId, userId, dto);
        return sendResponse(res, 200, 'Ratings submitted successfully', { order });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderInstructionsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const orderId = req.params.orderId;
        const instructions = req.body.instructions;
        const order = await orderService.updateOrderInstructions(orderId, userId, instructions);
        return sendResponse(res, 200, 'Instructions updated successfully', { order });
    } catch (err) {
        next(err);
    }
}

export async function getDispatchSettingsController(req, res, next) {
    try {
        const result = await orderService.getDispatchSettings();
        return sendResponse(res, 200, 'Dispatch settings retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function updateDispatchSettingsController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const dto = validateDispatchSettingsDto(req.body);
        const result = await orderService.updateDispatchSettings(dto.dispatchMode, adminId);
        return sendResponse(res, 200, 'Dispatch settings updated', result);
    } catch (err) {
        next(err);
    }
}

export async function listOrdersRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const result = await orderService.listOrdersRestaurant(restaurantId, req.query);
        const responseData = {
            orders: result.orders || result.data,
            meta: result.meta,
            pagination: result.meta,
            total: result.meta?.total,
        };
        return sendResponse(res, 200, 'Orders retrieved', responseData);
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { restaurantId });
        return sendResponse(res, 200, 'Order retrieved', { order });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderStatusRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderStatusDto(req.body);
        const order = await orderService.updateOrderStatusRestaurant(orderId, restaurantId, dto.orderStatus, dto.note);
        return sendResponse(res, 200, 'Order status updated', { order });
    } catch (err) {
        next(err);
    }
}

export async function listOrdersAvailableDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const result = await orderService.listOrdersAvailableDelivery(deliveryPartnerId, req.query);
        return sendResponse(res, 200, 'Orders retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function acceptOrderDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.acceptOrderDelivery(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Order accepted', { order });
    } catch (err) {
        next(err);
    }
}

export async function rejectOrderDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.rejectOrderDelivery(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Order rejected', { order });
    } catch (err) {
        next(err);
    }
}

export async function confirmReachedPickupDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.confirmReachedPickupDelivery(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Reached pickup confirmed', { order });
    } catch (err) {
        next(err);
    }
}

export async function confirmPickupDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const { billImageUrl, otp } = req.body;
        const order = await orderService.confirmPickupDelivery(orderId, deliveryPartnerId, billImageUrl, otp);
        return sendResponse(res, 200, 'Pickup confirmed', { order });
    } catch (err) {
        next(err);
    }
}

export async function requestPickupOtpController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        await orderService.requestPickupOtp(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'OTP sent to restaurant');
    } catch (err) {
        next(err);
    }
}

export async function confirmReachedDropDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.confirmReachedDropDelivery(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Reached drop confirmed', { order });
    } catch (err) {
        next(err);
    }
}

export async function verifyDropOtpDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const { otp } = req.body;
        const result = await orderService.verifyDropOtpDelivery(orderId, deliveryPartnerId, otp);
        return sendResponse(res, 200, 'OTP verified', { order: result.order });
    } catch (err) {
        next(err);
    }
}

export async function completeDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.completeDelivery(orderId, deliveryPartnerId, req.body || {});
        return sendResponse(res, 200, 'Delivery completed', { order });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderStatusDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateOrderStatusDto(req.body);
        const order = await orderService.updateOrderStatusDelivery(orderId, deliveryPartnerId, dto.orderStatus);
        return sendResponse(res, 200, 'Order status updated', { order });
    } catch (err) {
        next(err);
    }
}

export async function getCurrentTripDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const order = await orderService.getCurrentTripDelivery(deliveryPartnerId);
        return sendResponse(res, 200, 'Current trip retrieved', { activeOrder: order });
    } catch (err) {
        next(err);
    }
}

export async function getActiveOrdersDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const result = await orderService.getActiveOrdersDelivery(deliveryPartnerId);
        return sendResponse(res, 200, 'Active orders retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function passOrderOfferDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const result = await orderService.passOrderOfferDelivery(req.params.orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Order offer passed', result);
    } catch (err) {
        next(err);
    }
}

export async function createCollectQrController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.createCollectQr(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'QR created', result);
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdDeliveryController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { deliveryPartnerId });
        return sendResponse(res, 200, 'Order retrieved', { order });
    } catch (err) {
        next(err);
    }
}

export async function getPaymentStatusController(req, res, next) {
    try {
        const deliveryPartnerId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.getPaymentStatus(orderId, deliveryPartnerId);
        return sendResponse(res, 200, 'Payment status retrieved', result);
    } catch (err) {
        next(err);
    }
}

export async function listOrdersAdminController(req, res, next) {
    try {
        const result = await orderService.listOrdersAdmin(req.query);
        // Extract orders to the root of the data object so frontend gets it correctly
        const responseData = {
            orders: result.orders || result.data,
            pagination: result.pagination,
            total: result.total
        };
        return sendResponse(res, 200, 'Orders retrieved', responseData);
    } catch (err) {
        next(err);
    }
}

export async function getOrderByIdAdminController(req, res, next) {
    try {
        const orderId = req.params.orderId;
        const order = await orderService.getOrderById(orderId, { admin: true });
        return sendResponse(res, 200, 'Order retrieved', { order });
    } catch (err) {
        next(err);
    }
}

export async function assignDeliveryPartnerController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const orderId = req.params.orderId;
        const dto = validateAssignDeliveryDto(req.body);
        const order = await orderService.assignDeliveryPartnerAdmin(orderId, dto.deliveryPartnerId, adminId);
        return sendResponse(res, 200, 'Delivery partner assigned', { order });
    } catch (err) {
        next(err);
    }
}

export async function updateOrderStatusAdminController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const orderId = req.params.orderId;
        const { orderStatus, note } = req.body;
        const order = await orderService.updateOrderStatusAdmin(orderId, adminId, orderStatus, note);
        return sendResponse(res, 200, 'Order status updated successfully', { order });
    } catch (err) {
        next(err);
    }
}

export async function deleteOrderAdminController(req, res, next) {
    try {
        const adminId = req.user?.userId;
        const orderId = req.params.orderId;
        const result = await orderService.deleteOrderAdmin(orderId, adminId);
        return sendResponse(res, 200, 'Order deleted successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function resendDeliveryNotificationRestaurantController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const orderId = req.params.orderId;
        const voipToken = String(req.body?.voipToken || '').trim();
        const result = await orderService.resendDeliveryNotificationRestaurant(orderId, restaurantId, { voipToken });
        return sendResponse(res, 200, 'Notification resent successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function resendDeliveryNotificationAdminController(req, res, next) {
    try {
        const orderId = req.params.orderId;
        const voipToken = String(req.body?.voipToken || '').trim();
        const result = await orderService.resendDeliveryNotificationAdmin(orderId, { voipToken });
        return sendResponse(res, 200, 'Notification resent successfully', result);
    } catch (err) {
        next(err);
    }
}



export async function lookupCustomerAdminController(req, res, next) {
    try {
        const phone = String(req.query?.phone || '').trim();
        if (!phone || phone.length < 10) {
            return sendResponse(res, 200, 'Invalid phone number', { exists: false });
        }
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        const user = await FoodUser.findOne({
            $or: [
                { phone: cleanPhone },
                { phone: `+91${cleanPhone}` },
                { phone: `91${cleanPhone}` }
            ]
        }).select('_id name phone addresses savedAddresses').lean();

        if (!user) {
            return sendResponse(res, 200, 'Customer not found', { exists: false });
        }

        // Fetch recent delivery addresses from past orders
        const recentOrders = await FoodOrder.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('deliveryAddress')
            .lean();

        const seen = new Set();
        const recentAddresses = [];
        for (const ord of (recentOrders || [])) {
            const addr = ord?.deliveryAddress;
            if (addr && addr.street) {
                const key = `${addr.street}_${addr.additionalDetails || ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    recentAddresses.push(addr);
                }
            }
        }

        return sendResponse(res, 200, 'Customer found', {
            exists: true,
            customer: {
                _id: user._id,
                name: user.name || '',
                phone: user.phone || cleanPhone,
                savedAddresses: user.savedAddresses || user.addresses || [],
                recentAddresses
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function calculateOrderAdminController(req, res, next) {
    try {
        const dto = validateCalculateOrderDto(req.body);
        const result = await orderService.calculateOrder(null, dto);
        return sendResponse(res, 200, 'Pricing calculated', result);
    } catch (err) {
        console.error('calculateOrderAdminController error:', err);
        next(err);
    }
}

export async function createManualOrderAdminController(req, res, next) {
    try {
        const body = req.body || {};
        const customerName = String(body.customerName || body.address?.fullName || body.address?.name || '').trim();
        const rawPhone = String(body.customerPhone || body.address?.phone || '').trim();
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

        if (!customerName) {
            return res.status(400).json({ success: false, message: 'Customer full name is required' });
        }
        if (!cleanPhone || cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Valid 10-digit customer mobile number is required' });
        }
        if (!body.restaurantId) {
            return res.status(400).json({ success: false, message: 'Please select a restaurant' });
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one menu item is required' });
        }
        if (!body.address?.location?.coordinates || body.address.location.coordinates.length !== 2) {
            return res.status(400).json({ success: false, message: 'Delivery location coordinates are required' });
        }

        // Find or create FoodUser
        let user = await FoodUser.findOne({
            $or: [
                { phone: cleanPhone },
                { phone: `+91${cleanPhone}` },
                { phone: `91${cleanPhone}` }
            ]
        });

        if (!user) {
            user = await FoodUser.create({
                name: customerName,
                phone: cleanPhone,
                role: 'USER',
                isPhoneVerified: true,
                status: 'active'
            });
        } else if (customerName && (!user.name || user.name.trim() === 'User' || user.name.trim() === '')) {
            user.name = customerName;
            await user.save();
        }

        // Calculate pricing
        const pricingDto = {
            items: body.items,
            restaurantId: body.restaurantId,
            deliveryAddress: {
                location: body.address.location
            }
        };
        const calculated = await orderService.calculateOrder(user._id, pricingDto);

        const orderDto = {
            restaurantId: body.restaurantId,
            items: body.items,
            customerName,
            customerPhone: cleanPhone,
            address: {
                label: body.address.label || 'Home',
                fullName: customerName,
                name: customerName,
                phone: cleanPhone,
                street: body.address.street || 'Landmark Location',
                additionalDetails: body.address.additionalDetails || '',
                city: body.address.city || 'Indore',
                state: body.address.state || 'Madhya Pradesh',
                zipCode: body.address.zipCode || '',
                location: body.address.location
            },
            pricing: {
                subtotal: calculated.subtotal,
                tax: calculated.tax || 0,
                packagingFee: calculated.packagingFee || 0,
                deliveryFee: calculated.deliveryFee || 0,
                platformFee: calculated.platformFee || 0,
                discount: calculated.discount || 0,
                total: calculated.total,
                currency: 'INR'
            },
            paymentMethod: 'cash', // Strictly Cash on Delivery
            note: body.note ? `[Phone Order] ${body.note}` : '[Phone Order placed by Admin]',
            restaurantNote: body.restaurantNote || '',
            sendCutlery: body.sendCutlery !== false
        };

        const result = await orderService.createOrder(user._id, orderDto);
        return sendResponse(res, 201, 'Phone order placed successfully', result);
    } catch (err) {
        console.error('createManualOrderAdminController error:', err);
        next(err);
    }
}
