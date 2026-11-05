import mongoose from 'mongoose';
import { FoodItem } from '../../admin/models/food.model.js';

/**
 * Payment-mode pricing (COD vs prepaid / online).
 *
 * Restaurants can set a separate prepaid price (paid online) and a COD price (paid
 * at delivery) per dish and per variant. The cart sends the dish's display price,
 * possibly after an item discount. Here we look up the restaurant's real prices from
 * the catalog and move each line to the price of the chosen payment mode, keeping
 * whatever discount the cart already applied. Client-sent codPrice / prepaidPrice
 * are only used for items that are not in the catalog.
 */

const positive = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const round2 = (value) => Math.round(value * 100) / 100;

export const isCodPaymentMethod = (method) => {
    const m = String(method || '').toLowerCase();
    return m === 'cash' || m === 'cod';
};

/** The catalog entry (variant or dish) whose price the cart line was based on. */
function pickCatalogEntry(food, item) {
    const variants = Array.isArray(food?.variants) ? food.variants : [];
    if (variants.length === 0) return food;

    const variantId = String(item?.variantId || '');
    const variantName = String(item?.variantName || '').trim().toLowerCase();
    const byId = variantId ? variants.find((v) => String(v._id) === variantId) : null;
    if (byId) return byId;
    const byName = variantName
        ? variants.find((v) => String(v.name || '').trim().toLowerCase() === variantName)
        : null;
    if (byName) return byName;

    // No variant chosen: the menu shows (and the cart uses) the cheapest variant.
    return variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), variants[0]);
}

function modePricesFor(entry) {
    const base = positive(entry?.price) ?? 0;
    return {
        base,
        prepaid: positive(entry?.prepaidPrice) ?? base,
        cod: positive(entry?.codPrice) ?? base,
    };
}

/** Legacy behaviour for items we cannot find in the catalog. */
function applyClientHints(item, isCod) {
    const price = Math.max(0, Number(item?.price) || 0);
    const prepaid = positive(item?.prepaidPrice) ?? price;
    const cod = positive(item?.codPrice) ?? price;
    return { ...item, price: isCod ? cod : prepaid, prepaidPrice: prepaid, codPrice: cod };
}

/**
 * Returns a copy of `items` where every line's `price` is the unit price for the
 * selected payment method, plus `prepaidPrice` and `codPrice` for display.
 */
export async function applyPaymentModePrices(items, { restaurantId, paymentMethod } = {}) {
    const list = Array.isArray(items) ? items : [];
    const isCod = isCodPaymentMethod(paymentMethod);

    const ids = [
        ...new Set(
            list
                .map((it) => String(it?.itemId || ''))
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        ),
    ];

    let foods = [];
    if (ids.length > 0) {
        const query = { _id: { $in: ids } };
        if (restaurantId && mongoose.Types.ObjectId.isValid(String(restaurantId))) {
            query.restaurantId = restaurantId;
        }
        foods = await FoodItem.find(query).select('price prepaidPrice codPrice variants').lean();
    }
    const foodById = new Map(foods.map((f) => [String(f._id), f]));

    return list.map((item) => {
        const food = foodById.get(String(item?.itemId || ''));
        if (!food) return applyClientHints(item, isCod);

        const { base, prepaid, cod } = modePricesFor(pickCatalogEntry(food, item));
        const clientPrice = Number(item?.price);
        // Difference the cart applied on top of the catalog price (item discount, usually <= 0).
        const adjustment = Number.isFinite(clientPrice) ? clientPrice - base : 0;
        const prepaidUnit = round2(Math.max(0, prepaid + adjustment));
        const codUnit = round2(Math.max(0, cod + adjustment));

        return {
            ...item,
            price: isCod ? codUnit : prepaidUnit,
            prepaidPrice: prepaidUnit,
            codPrice: codUnit,
        };
    });
}

export const sumLineTotals = (items, key = 'price') =>
    round2(
        (Array.isArray(items) ? items : []).reduce((sum, it) => {
            const price = Number(it?.[key]);
            const qty = Number(it?.quantity) || 1;
            return Number.isFinite(price) ? sum + Math.max(0, price) * Math.max(0, qty) : sum;
        }, 0)
    );
