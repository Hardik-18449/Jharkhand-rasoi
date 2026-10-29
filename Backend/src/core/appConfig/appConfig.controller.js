import { AppConfig } from './appConfig.model.js';

const APP_DEFAULTS = {
    user_app: {
        primaryColor: '#e11d48',
        secondaryColor: '#be123c',
        logoUrl: '',
        fontFamily: "'Poppins', sans-serif"
    },
    restaurant_app: {
        primaryColor: '#e11d48',
        secondaryColor: '#be123c',
        logoUrl: '',
        fontFamily: "'Poppins', sans-serif"
    },
    delivery_app: {
        primaryColor: '#e11d48',
        secondaryColor: '#be123c',
        logoUrl: '',
        fontFamily: "'Poppins', sans-serif"
    },
    admin_app: {
        primaryColor: '#e11d48',
        secondaryColor: '#be123c',
        logoUrl: '',
        fontFamily: "'Poppins', sans-serif"
    }
};

export const getAppConfigs = async (req, res) => {
    try {
        let configs = await AppConfig.find();
        if (!configs || configs.length === 0) {
            const apps = Object.keys(APP_DEFAULTS);
            configs = await Promise.all(
                apps.map(appName => AppConfig.findOneAndUpdate(
                    { appName },
                    { $setOnInsert: { appName, ...APP_DEFAULTS[appName] } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                ))
            );
        }
        res.status(200).json({ success: true, data: configs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const getAppConfigByName = async (req, res) => {
    try {
        const { appName } = req.params;
        let config = await AppConfig.findOne({ appName });
        if (!config) {
            const defaults = APP_DEFAULTS[appName] || {
                primaryColor: '#e11d48',
                secondaryColor: '#be123c',
                logoUrl: '',
                fontFamily: "'Poppins', sans-serif"
            };
            config = await AppConfig.findOneAndUpdate(
                { appName },
                { $setOnInsert: { appName, ...defaults } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const updateAppConfig = async (req, res) => {
    try {
        const { appName } = req.params;
        const { primaryColor, secondaryColor, logoUrl, fontFamily } = req.body;
        
        let config = await AppConfig.findOne({ appName });
        if (!config) {
            config = new AppConfig({ appName, primaryColor, secondaryColor, logoUrl, fontFamily });
        } else {
            if (primaryColor) config.primaryColor = primaryColor;
            if (secondaryColor) config.secondaryColor = secondaryColor;
            if (logoUrl !== undefined) config.logoUrl = logoUrl;
            if (fontFamily) config.fontFamily = fontFamily;
        }
        await config.save();
        res.status(200).json({ success: true, data: config, message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
