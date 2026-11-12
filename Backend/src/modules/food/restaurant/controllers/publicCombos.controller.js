import { sendResponse } from '../../../../utils/response.js';
import { getPublicApprovedRestaurantCombos } from '../services/publicCombos.service.js';

export const getPublicRestaurantCombosController = async (req, res, next) => {
    try {
        const combos = await getPublicApprovedRestaurantCombos(req.params.id);
        if (!combos) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        return sendResponse(res, 200, 'Combos fetched successfully', { combos });
    } catch (error) {
        next(error);
    }
};
