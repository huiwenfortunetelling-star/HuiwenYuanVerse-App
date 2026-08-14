function getPayPalBaseUrl() {
  const env = String(process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  return env === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to get PayPal access token.');
  }

  return data.access_token;
}

async function getProductFromSupabase(productId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase server configuration is missing.');
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_product_for_checkout`,
    {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_product_id: productId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Unable to load product.');
  }

  const product = Array.isArray(data) ? data[0] : data;

  if (!product || product.active === false) {
    return null;
  }

  return product;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const productId = String(req.body?.productId || '').trim();

    if (!productId) {
      return res.status(400).json({ error: 'Missing productId.' });
    }

    const product = await getProductFromSupabase(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (Number(product.stock || 0) <= 0) {
      return res.status(409).json({ error: 'Product is sold out.' });
    }

    const price = Number(product.price);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(500).json({ error: 'Invalid product price.' });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: product.id,
            custom_id: product.id,
            description: String(product.name || 'Huiwen product').slice(0, 127),
            amount: {
              currency_code: 'CAD',
              value: price.toFixed(2),
            },
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      console.error('PayPal create-order error:', data);
      return res.status(response.status || 500).json({
        error:
          data?.details?.[0]?.description ||
          data?.message ||
          'Unable to create PayPal order.',
      });
    }

    return res.status(200).json({
      id: data.id,
      status: data.status,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      error: error?.message || 'Unable to create PayPal order.',
    });
  }
}
