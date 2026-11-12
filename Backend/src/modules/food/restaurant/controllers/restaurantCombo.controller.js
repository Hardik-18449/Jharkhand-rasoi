import { sendResponse, sendError } from '../../../../utils/response.js';
import { validateComboCreateDto, validateComboListQuery, validateComboUpdateDto } from '../validators/combo.validator.js';
import {
    listRestaurantCombos,
    createRestaurantCombo,
    updateRestaurantCombo,
    deleteRestaurantCombo
} from '../services/restaurantCombo.service.js';
import { invalidateCache } from '../../../../middleware/cache.js';

const bustPublicCombos = async () => {
    try {
        await invalidateCache('restaurant_combos:*');
    } catch (e) {
        // cache is best-effort
    }
};

export const listCombosController = async (req, res, next) => {
    try {
        const query = validateComboListQuery(req.query || {});
        const data = await listRestaurantCombos(req.user?.userId, query);
        return sendResponse(res, 200, 'Combos fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const createComboController = async (req, res, next) => {
    try {
        const body = validateComboCreateDto(req.body || {});
        const combo = await createRestaurantCombo(req.user?.userId, body);
        return sendResponse(res, 201, 'Combo submitted for approval', { combo });
    } catch (error) {
        next(error);
    }
};

export const updateComboController = async (req, res, next) => {
    try {
        const body = validateComboUpdateDto(req.body || {});
        const combo = await updateRestaurantCombo(req.user?.userId, req.params.id, body);
        if (!combo) return sendError(res, 404, 'Combo not found');
        await bustPublicCombos();
        return sendResponse(res, 200, 'Combo updated successfully', { combo });
    } catch (error) {
        next(error);
    }
};

export const deleteComboController = async (req, res, next) => {
    try {
        const result = await deleteRestaurantCombo(req.user?.userId, req.params.id);
        if (!result) return sendError(res, 404, 'Combo not found');
        await bustPublicCombos();
        return sendResponse(res, 200, 'Combo deleted successfully', result);
    } catch (error) {
        next(error);
    }
};
