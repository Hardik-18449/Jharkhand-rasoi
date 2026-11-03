import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.error?.description || err.description || err.message || (typeof err.error === 'string' ? err.error : 'Server Error');

    // Handle Mongo duplicate key errors gracefully
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'Field';
        const fieldLabels = {
            vehicleNumber: 'Vehicle number',
            phone: 'Phone number',
            email: 'Email address',
            panNumber: 'PAN number',
            aadharNumber: 'Aadhar number',
            drivingLicenseNumber: 'Driving license number',
            slug: 'Restaurant name / slug'
        };
        const prettyField = fieldLabels[field] || field;
        message = `${prettyField} is already registered. Please check and try again.`;
    } else if (err.code === 'LIMIT_FILE_SIZE' || err.type === 'entity.too.large') {
        statusCode = 413;
        message = 'File size is too large. Please upload an image under 2MB.';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
    }

    const requestId = req.requestId || '-';

    logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${err.name || 'Error'} - ${message}`
    );
    if (config.nodeEnv === 'development' && (err.stack || err.error)) {
        logger.error(`[${requestId}] ${err.stack || JSON.stringify(err.error)}`);
    }

    res.status(statusCode).json({
        success: false,
        message,
        error: message
    });
};

export default errorHandler;
