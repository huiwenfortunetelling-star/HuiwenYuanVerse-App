const PRODUCTS = {
  p1: {
    name: '静心山水 · 电子图片',
    price: '19.00',
  },
  p2: {
    name: '东方禅意 · 电子图片',
    price: '29.00',
  },
  p3: {
    name: '城市夜景 · 电子图片',
    price: '39.00',
  },
};

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing.');
  }

  const auth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('PayPal token error:', data);
    throw new Error('Unable to obtain PayPal access token.');
  }

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method not allowed.',
    });
    return;
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const productId = body.productId;
    const product = PRODUCTS[productId];

    if (!product) {
      res.status(400).json({
        error: 'Invalid product.',
      });
      return;
    }

    const accessToken = await getAccessToken();

    const paypalResponse = await fetch(
      `${getPayPalBaseUrl()}/v2/checkout/orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              description: product.name,
              amount: {
                currency_code: 'CAD',
                value: product.price,
              },
            },
          ],
        }),
      }
    );

    const order = await paypalResponse.json();

    if (!paypalResponse.ok || !order.id) {
      console.error('PayPal create-order error:', order);

      res.status(paypalResponse.status || 500).json({
        error: 'PayPal could not create the order.',
        details: order,
      });
      return;
    }

    res.status(200).json({
      id: order.id,
    });
  } catch (error) {
    console.error('Create order error:', error);

    res.status(500).json({
      error: 'Unable to create the PayPal order.',
    });
  }
}
