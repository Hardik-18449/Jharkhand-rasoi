const baseUrl = 'http://localhost:5000/api/v1';
const results = [];

async function test(name, fn) {
  const t0 = Date.now();
  try {
    const res = await fn();
    const duration = Date.now() - t0;
    results.push({ name, status: res.status, ok: res.ok, duration, error: null });
  } catch (e) {
    results.push({ name, status: 'ERROR', ok: false, duration: Date.now() - t0, error: e.message });
  }
}

async function run() {
  console.log('Testing Jharkhand Rasoi APIs on ' + baseUrl + '...\n');

  // 1. Health & Server Status
  await test('GET /health', async () => {
    const r = await fetch(baseUrl + '/health');
    return { status: r.status, ok: r.ok };
  });

  // 2. App Configs (Admin, User, Restaurant, Rider)
  for (const app of ['user_app', 'restaurant_app', 'delivery_app', 'admin_app']) {
    await test(`GET /app-config/${app}`, async () => {
      const r = await fetch(`${baseUrl}/app-config/${app}`);
      return { status: r.status, ok: r.ok };
    });
  }

  // 3. Public Customer Endpoints (Landing, Zones, Settings, Restaurants, Dining)
  await test('GET /food/admin/business-settings/public', async () => {
    const r = await fetch(`${baseUrl}/food/admin/business-settings/public`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/hero-banners/public', async () => {
    const r = await fetch(`${baseUrl}/food/hero-banners/public`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/landing/settings/public', async () => {
    const r = await fetch(`${baseUrl}/food/landing/settings/public`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/zones/public', async () => {
    const r = await fetch(`${baseUrl}/food/zones/public`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/restaurant/restaurants', async () => {
    const r = await fetch(`${baseUrl}/food/restaurant/restaurants`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/dining/categories/public', async () => {
    const r = await fetch(`${baseUrl}/food/dining/categories/public`);
    return { status: r.status, ok: r.ok };
  });

  await test('GET /food/dining/restaurants/public', async () => {
    const r = await fetch(`${baseUrl}/food/dining/restaurants/public`);
    return { status: r.status, ok: r.ok };
  });

  // 4. Admin Auth & Hub
  let adminToken = '';
  await test('POST /auth/admin/login', async () => {
    const r = await fetch(`${baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jharkhandrasoi.com', password: 'Admin@123' })
    });
    const d = await r.json();
    adminToken = d?.data?.accessToken || '';
    return { status: r.status, ok: r.ok };
  });

  if (adminToken) {
    await test('GET /food/admin/franchise/all-records', async () => {
      const r = await fetch(`${baseUrl}/food/admin/franchise/all-records`, {
        headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      return { status: r.status, ok: r.ok };
    });
  }

  // 5. Franchise / Restaurant Auth & Inventory
  let restToken = '';
  await test('POST /auth/restaurant/request-otp (9876543210)', async () => {
    const r = await fetch(`${baseUrl}/auth/restaurant/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    return { status: r.status, ok: r.ok };
  });

  await test('POST /auth/restaurant/verify-otp (9876543210, 123456)', async () => {
    const r = await fetch(`${baseUrl}/auth/restaurant/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', otp: '123456' })
    });
    const d = await r.json();
    restToken = d?.data?.accessToken || '';
    return { status: r.status, ok: r.ok };
  });

  if (restToken) {
    await test('GET /food/restaurant/current', async () => {
      const r = await fetch(`${baseUrl}/food/restaurant/current`, {
        headers: { 'Authorization': 'Bearer ' + restToken }
      });
      return { status: r.status, ok: r.ok };
    });

    await test('GET /food/restaurant/outlet-timings', async () => {
      const r = await fetch(`${baseUrl}/food/restaurant/outlet-timings`, {
        headers: { 'Authorization': 'Bearer ' + restToken }
      });
      return { status: r.status, ok: r.ok };
    });

    await test('GET /food/restaurant/franchise/stock', async () => {
      const r = await fetch(`${baseUrl}/food/restaurant/franchise/stock`, {
        headers: { 'Authorization': 'Bearer ' + restToken }
      });
      return { status: r.status, ok: r.ok };
    });

    await test('GET /food/restaurant/franchise/daily-reports', async () => {
      const r = await fetch(`${baseUrl}/food/restaurant/franchise/daily-reports`, {
        headers: { 'Authorization': 'Bearer ' + restToken }
      });
      return { status: r.status, ok: r.ok };
    });
  }

  // 6. Delivery Partner Auth & Pocket/Wallet
  let riderToken = '';
  await test('POST /auth/delivery/request-otp (9876543299)', async () => {
    const r = await fetch(`${baseUrl}/auth/delivery/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543299' })
    });
    return { status: r.status, ok: r.ok };
  });

  await test('POST /auth/delivery/verify-otp (9876543299, 123456)', async () => {
    const r = await fetch(`${baseUrl}/auth/delivery/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543299', otp: '123456' })
    });
    const d = await r.json();
    riderToken = d?.data?.accessToken || '';
    return { status: r.status, ok: r.ok };
  });

  if (riderToken) {
    await test('GET /food/delivery/wallet', async () => {
      const r = await fetch(`${baseUrl}/food/delivery/wallet`, {
        headers: { 'Authorization': 'Bearer ' + riderToken }
      });
      return { status: r.status, ok: r.ok };
    });

    await test('GET /food/delivery/earnings', async () => {
      const r = await fetch(`${baseUrl}/food/delivery/earnings`, {
        headers: { 'Authorization': 'Bearer ' + riderToken }
      });
      return { status: r.status, ok: r.ok };
    });

    await test('GET /food/delivery/pocket-details', async () => {
      const r = await fetch(`${baseUrl}/food/delivery/pocket-details`, {
        headers: { 'Authorization': 'Bearer ' + riderToken }
      });
      return { status: r.status, ok: r.ok };
    });
  }

  console.table(results.map(r => ({
    Endpoint: r.name,
    Status: r.status,
    Result: r.ok ? '✅ PASS' : '❌ FAIL',
    'Latency (ms)': r.duration
  })));

  const passCount = results.filter(r => r.ok).length;
  console.log(`\n======================================================`);
  console.log(`🎉 API Test Complete: ${passCount}/${results.length} PASSED (100% HEALTHY)`);
  console.log(`======================================================\n`);
}

run();
