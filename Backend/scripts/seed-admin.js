import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { FoodAdmin } from '../src/core/admin/admin.model.js';
import { config } from '../src/config/env.js';

const ADMIN_EMAIL = (process.argv[2] || 'admin@jharkhandrasoi.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.argv[3] || 'Admin@123';
const ADMIN_NAME = 'Super Admin';
const ADMIN_ROLE = 'SUPER_ADMIN';

async function seedAdmin() {
    try {
        const uri = config.mongodbUri || process.env.MONGO_URI_LOCAL || 'mongodb://127.0.0.1:27017/tuggo';
        console.log(`Connecting to database: ${uri.replace(/\/\/.*@/, '//<credentials>@')} ...`);
        await mongoose.connect(uri);

        let admin = await FoodAdmin.findOne({ email: ADMIN_EMAIL });
        if (admin) {
            console.log(`Admin user with email ${ADMIN_EMAIL} already exists. Updating credentials...`);
            admin.password = ADMIN_PASSWORD;
            admin.visiblePassword = ADMIN_PASSWORD;
            admin.name = ADMIN_NAME;
            admin.role = ADMIN_ROLE;
            admin.isActive = true;
            admin.servicesAccess = ['food', 'quickCommerce', 'taxi'];
            await admin.save();
            console.log(`✅ Successfully updated admin: ${ADMIN_EMAIL}`);
        } else {
            console.log(`Creating new admin user: ${ADMIN_EMAIL}...`);
            admin = new FoodAdmin({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                visiblePassword: ADMIN_PASSWORD,
                name: ADMIN_NAME,
                role: ADMIN_ROLE,
                isActive: true,
                servicesAccess: ['food', 'quickCommerce', 'taxi']
            });
            await admin.save();
            console.log(`✅ Successfully created admin: ${ADMIN_EMAIL}`);
        }

        console.log('\nAdmin Details:');
        console.log('---------------------------');
        console.log(`ID:      ${admin._id}`);
        console.log(`Email:   ${admin.email}`);
        console.log(`Role:    ${admin.role}`);
        console.log(`Active:  ${admin.isActive}`);
        console.log(`Access:  ${admin.servicesAccess.join(', ')}`);
        console.log('---------------------------');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to seed admin:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seedAdmin();
