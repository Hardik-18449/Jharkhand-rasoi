import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        posterUrl: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 }
    },
    {
        collection: 'food_advertisements',
        timestamps: true
    }
);

advertisementSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export const FoodAdvertisement = mongoose.model('FoodAdvertisement', advertisementSchema);
