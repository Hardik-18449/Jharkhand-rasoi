import { publicGetOnce } from "@food/api";

const isLightColor = (hex) => {
  if (!hex || typeof hex !== 'string') return false;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length < 6) return true;
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140; // Yellow, gold, amber, white etc. are light colors needing black text
};

export const applyDynamicTheme = async () => {
  try {
    const apps = ['user_app', 'restaurant_app', 'delivery_app', 'admin_app'];
    
    // Fetch all configurations simultaneously using the public endpoint
    const promises = apps.map(appType => 
      publicGetOnce(`/app-config/${appType}`, { noCache: true }).catch(() => null)
    );
    
    const results = await Promise.all(promises);
    const root = document.documentElement;
    
    const path = window.location.pathname;
    let currentAppType = 'user_app';
    if (path.includes('/restaurant')) currentAppType = 'restaurant_app';
    else if (path.includes('/delivery')) currentAppType = 'delivery_app';
    else if (path.includes('/admin')) currentAppType = 'admin_app';
    
    results.forEach((response, index) => {
      const activeConfig = response?.data?.data || response?.data;
      if (!activeConfig) return;
      
      const appType = apps[index];
      
      if (appType === 'user_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--primary', activeConfig.primaryColor);
          root.style.setProperty('--color-primary', activeConfig.primaryColor);
          root.style.setProperty('--color-primary-orange', activeConfig.primaryColor);
          root.style.setProperty('--ring', activeConfig.primaryColor);

          // If primary is yellow or light, ensure text on primary buttons is black
          const fgColor = isLightColor(activeConfig.primaryColor) ? '#000000' : '#ffffff';
          root.style.setProperty('--primary-foreground', fgColor);
          root.style.setProperty('--color-primary-foreground', fgColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--secondary', activeConfig.secondaryColor);
          root.style.setProperty('--color-secondary', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('user_app_logo', activeConfig.logoUrl);
        }
      } 
      else if (appType === 'restaurant_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--rt-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--rt-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('restaurant_app_logo', activeConfig.logoUrl);
        }
      }
      else if (appType === 'delivery_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--dv-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--dv-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('delivery_app_logo', activeConfig.logoUrl);
        }
      }
      else if (appType === 'admin_app') {
        if (activeConfig.primaryColor) {
          root.style.setProperty('--ad-primary', activeConfig.primaryColor);
        }
        if (activeConfig.secondaryColor) {
          root.style.setProperty('--ad-primary-strong', activeConfig.secondaryColor);
        }
        if (activeConfig.logoUrl) {
          localStorage.setItem('admin_app_logo', activeConfig.logoUrl);
        }
      }
      
      // Apply font-family based on the current active app context
      if (activeConfig.fontFamily && appType === currentAppType) {
        root.style.setProperty('--main-font-family', activeConfig.fontFamily);
      }
    });

    // Dispatch global event once all themes are applied
    window.dispatchEvent(new CustomEvent('themeLoaded', { detail: { updated: true } }));

  } catch (error) {
    console.warn("Failed to load dynamic themes, falling back to default", error);
  }
};
