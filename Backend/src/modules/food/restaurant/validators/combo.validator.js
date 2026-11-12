import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const comboItemSchema = z.object({
    foodId: z.string().min(1, 'Combo item is required'),
    variantId: z.string().max(64).optional().default(''),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(20).optional().default(1)
});

const comboPayloadSchema = z.object({
    name: z.string().min(1, 'Combo name is required').max(200),
    description: z.string().max(2000).optional().default(''),
    comboPrice: z.coerce.number().min(0, 'Combo price must be >= 0'),
    image: z.string().max(2000).optional().default(''),
    images: z.array(z.string().max(2000)).max(10).optional().default([]),
    items: z.array(comboItemSchema).min(2, 'Select at least 2 items for the combo').max(20)
});

const listSchema = z.object({
    includeDeleted: z.coerce.boolean().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(80).optional()
});

const updateSchema = z.object({
    draft: comboPayloadSchema.partial().optional(),
    isAvailable: z.boolean().optional()
});

const fail = (result, fallback) => {
    const first = result.error.issues?.[0];
    const path = first?.path?.length ? first.path.join('.') : '';
    const msg = first?.message || fallback;
    throw new ValidationError(path && !/combo|item/i.test(msg) ? `${path}: ${msg}` : msg);
};

export const validateComboListQuery = (query) => {
    const result = listSchema.safeParse(query);
    if (!result.success) fail(result, 'Invalid query');
    return result.data;
};

export const validateComboCreateDto = (body) => {
    const result = comboPayloadSchema.safeParse(body);
    if (!result.success) fail(result, 'Invalid combo data');
    const d = result.data;
    const images = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
    const image = d.image || images[0] || '';
    return { ...d, images, image };
};

export const validateComboUpdateDto = (body) => {
    const result = updateSchema.safeParse(body);
    if (!result.success) fail(result, 'Invalid combo data');
    const d = result.data;
    let draft = d.draft;
    if (draft) {
        const images = Array.isArray(draft.images) ? draft.images.filter(Boolean) : undefined;
        const image = draft.image !== undefined ? draft.image : (images && images[0]) ? images[0] : undefined;
        draft = { ...draft, ...(images !== undefined ? { images } : {}), ...(image !== undefined ? { image } : {}) };
    }
    return { ...d, ...(draft ? { draft } : {}) };
};
