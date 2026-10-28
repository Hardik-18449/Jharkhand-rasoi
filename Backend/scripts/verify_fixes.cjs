const fs = require('fs');

console.log('--- Verifying Patches ---');

const m1 = fs.readFileSync('c:/Users/info/OneDrive/Desktop/JharkhandRasoi/Backend/src/modules/food/orders/models/order.model.js', 'utf8');
console.log('1. order.model.js:');
console.log('   has pending:', m1.includes("'pending'"));
console.log('   has unassigned:', m1.includes("'unassigned'"));
console.log('   has Selected Location:', m1.includes("'Selected Location'"));

const m2 = fs.readFileSync('c:/Users/info/OneDrive/Desktop/JharkhandRasoi/Backend/src/modules/food/orders/services/order.service.js', 'utf8');
console.log('2. order.service.js:');
console.log('   filter is {}:', m2.includes('const filter = {};'));
console.log('   pending filter has in:', m2.includes('{ $in: ["created", "pending"] }'));
console.log('   has ALLOW_ORDER_WITHOUT_RIDERS bypass:', m2.includes('ALLOW_ORDER_WITHOUT_RIDERS'));
console.log('   has address fallback:', m2.includes('Selected Location'));

const m3 = fs.readFileSync('c:/Users/info/OneDrive/Desktop/JharkhandRasoi/Backend/src/modules/food/admin/services/admin.service.js', 'utf8');
console.log('3. admin.service.js:');
console.log('   badge count includes created & pending:', m3.includes("{ orderStatus: { $in: ['pending', 'created'] } }"));

const m4 = fs.readFileSync('c:/Users/info/OneDrive/Desktop/JharkhandRasoi/Backend/src/services/geocoding.service.js', 'utf8');
console.log('4. geocoding.service.js:');
console.log('   has fallback_ok:', m4.includes('fallback_ok'));

const m5 = fs.readFileSync('c:/Users/info/OneDrive/Desktop/JharkhandRasoi/Frontend/src/modules/Food/hooks/useLocation.jsx', 'utf8');
console.log('5. useLocation.jsx:');
console.log('   has Strategy 3 fallback:', m5.includes('Strategy 3: Default Indore location fallback'));
console.log('   has no broken if (stored):', !m5.includes('if (stored)'));
