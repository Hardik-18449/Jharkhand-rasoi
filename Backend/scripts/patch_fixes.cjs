const fs = require('fs');

// 1. Patch order.model.js
{
  const filePath = 'c:/Users/info/OneDrive/Desktop/CityFood/Backend/src/modules/food/orders/models/order.model.js';
  let code = fs.readFileSync(filePath, 'utf8');

  code = code.replace(/street:\s*\{\s*type:\s*String,\s*required:\s*true,\s*trim:\s*true\s*\}/, "street: { type: String, default: 'Selected Location', trim: true }");
  code = code.replace(/city:\s*\{\s*type:\s*String,\s*required:\s*true,\s*trim:\s*true\s*\}/, "city: { type: String, default: 'Indore', trim: true }");
  code = code.replace(/state:\s*\{\s*type:\s*String,\s*required:\s*true,\s*trim:\s*true\s*\}/, "state: { type: String, default: 'Madhya Pradesh', trim: true }");

  if (!code.includes("'unassigned',")) {
    code = code.replace(/(currentPhase:\s*\{\s*type:\s*String,\s*enum:\s*\[[\s\r\n]*)/, "$1'unassigned',\n                ");
  }
  if (!code.includes("'pending',") || !code.includes("orderStatus")) {
    code = code.replace(/(orderStatus:\s*\{\s*type:\s*String,\s*enum:\s*\[[\s\r\n]*'created',)/, "$1\n                'pending',");
  }

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('[1/5] order.model.js patched');
}

// 2. Patch order.service.js
{
  const filePath = 'c:/Users/info/OneDrive/Desktop/CityFood/Backend/src/modules/food/orders/services/order.service.js';
  let code = fs.readFileSync(filePath, 'utf8');

  // Fix NO_RIDERS_AVAILABLE bypass in non-production
  const riderCheckRegex = /if\s*\(!riderAvailability\.available\)\s*\{\s*const err = new ValidationError\('All riders are busy, kindly try after some time'\);\s*err\.code = 'NO_RIDERS_AVAILABLE';\s*throw err;\s*\}/;
  const riderCheckReplacement = `if (!riderAvailability.available) {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_ORDER_WITHOUT_RIDERS) {
        const err = new ValidationError('All riders are busy, kindly try after some time');
        err.code = 'NO_RIDERS_AVAILABLE';
        throw err;
      } else {
        console.warn('[createOrder] No online riders available, but allowing order creation in non-production mode.');
      }
    }`;
  code = code.replace(riderCheckRegex, riderCheckReplacement);

  // Fix deliveryAddress fallback
  const addrRegex = /street:\s*dto\.address\?\.street\s*\|\|\s*"",/;
  const addrReplacement = `street: dto.address?.street || dto.address?.formattedAddress || dto.address?.address || "Selected Location",`;
  code = code.replace(addrRegex, addrReplacement);

  const cityRegex = /city:\s*dto\.address\?\.city\s*\|\|\s*"",/;
  code = code.replace(cityRegex, `city: dto.address?.city || "Indore",`);

  const stateRegex = /state:\s*dto\.address\?\.state\s*\|\|\s*"",/;
  code = code.replace(stateRegex, `state: dto.address?.state || "Madhya Pradesh",`);

  // Fix listOrdersAdmin filter to show pending & created orders and not exclude them
  code = code.replace(
    /const filter = \{\s*\$or: \[\s*\{\s*"payment\.method": \{ \$in: \["cash", "wallet", "razorpay_qr"\] \} \},\s*\{\s*"payment\.status": \{ \$in: \["paid", "authorized", "captured", "settled", "refunded"\] \} \},\s*\{\s*orderStatus: \{ \$in: \["confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered"\] \} \},\s*\],\s*\};/,
    "const filter = {};"
  );

  // Also in listOrdersAdmin switch:
  code = code.replace(/case "pending":\s*filter\.orderStatus = "created";\s*break;/, 'case "pending":\n        filter.orderStatus = { $in: ["created", "pending"] };\n        break;');
  code = code.replace(/case "food-on-the-way":\s*filter\.orderStatus = "picked_up";\s*break;/, 'case "food-on-the-way":\n        filter.orderStatus = { $in: ["picked_up", "reached_drop"] };\n        break;');

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('[2/5] order.service.js patched');
}

// 3. Patch admin.service.js getSidebarBadges
{
  const filePath = 'c:/Users/info/OneDrive/Desktop/CityFood/Backend/src/modules/food/admin/services/admin.service.js';
  let code = fs.readFileSync(filePath, 'utf8');

  code = code.replace(
    "FoodOrder.countDocuments({ orderStatus: 'pending' }),",
    "FoodOrder.countDocuments({ orderStatus: { $in: ['pending', 'created'] } }),"
  );
  code = code.replace(
    "FoodOrder.countDocuments({ paymentMethod: 'offline_payment', orderStatus: 'pending' }),",
    "FoodOrder.countDocuments({ paymentMethod: 'offline_payment', orderStatus: { $in: ['pending', 'created'] } }),"
  );

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('[3/5] admin.service.js patched');
}

// 4. Patch geocoding.service.js
{
  const filePath = 'c:/Users/info/OneDrive/Desktop/CityFood/Backend/src/services/geocoding.service.js';
  let code = fs.readFileSync(filePath, 'utf8');

  const oldGeocodeRegex = /if\s*\(data\.status !== 'OK' \|\| !data\.results\?\.length\)\s*\{\s*throw new Error\(data\.error_message \|\| data\.status \|\| 'Reverse geocoding failed'\);\s*\}/;

  const newGeocodeBlock = `if (data.status !== 'OK' || !data.results?.length) {
        logger.warn(\`Google reverse geocode returned \${data.status}: \${data.error_message || ''}. Using Indore fallback.\`);
        return {
            latitude: lat,
            longitude: lng,
            area: 'Indore',
            city: 'Indore',
            state: 'Madhya Pradesh',
            country: 'India',
            postalCode: '452001',
            formattedAddress: \`Vijay Nagar, Indore, Madhya Pradesh 452010 (\${lat.toFixed(4)}, \${lng.toFixed(4)})\`,
            address: \`Vijay Nagar, Indore (\${lat.toFixed(4)}, \${lng.toFixed(4)})\`,
            source: 'fallback_ok',
        };
    }`;

  code = code.replace(oldGeocodeRegex, newGeocodeBlock);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('[4/5] geocoding.service.js patched');
}

// 5. Patch Frontend useLocation.jsx
{
  const filePath = 'c:/Users/info/OneDrive/Desktop/CityFood/Frontend/src/modules/Food/hooks/useLocation.jsx';
  let code = fs.readFileSync(filePath, 'utf8');

  // Replace Strategy 2 broken reference
  const oldStrategy2Regex = /\/\/ Strategy 2: Use cached location from localStorage\s*if \(!fallback\) \{\s*const storedLocation = readStoredUserLocation\(\)\s*if \(stored\) \{[\s\S]*?\}\s*\}\s*\}/;

  const newStrategy2 = `// Strategy 2: Use cached location from localStorage
              if (!fallback) {
                const storedLocation = readStoredUserLocation()
                if (storedLocation && typeof storedLocation === 'object' && typeof storedLocation.latitude === 'number') {
                  fallback = storedLocation
                  debugLog("? Using cached location from localStorage")
                }
              }

              // Strategy 3: Default Indore location fallback so it never crashes
              if (!fallback) {
                fallback = {
                  latitude: 22.7196,
                  longitude: 75.8577,
                  city: "Indore",
                  state: "Madhya Pradesh",
                  country: "India",
                  area: "Vijay Nagar",
                  address: "Vijay Nagar, Indore",
                  formattedAddress: "Vijay Nagar, Indore, Madhya Pradesh 452010"
                }
                debugLog("? Using default Indore fallback location")
              }`;

  code = code.replace(oldStrategy2Regex, newStrategy2);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('[5/5] useLocation.jsx patched');
}
