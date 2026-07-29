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

    const orderId = body.orderId;

    if (!orderId || !/^[A-Z0-9]+$/.test(orderId)) {
      res.status(400).json({
        error: 'Invalid PayPal order ID.',
      });
      return;
    }

    const accessToken = await getAccessToken();

    const paypalResponse = await fetch(
      `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const capture = await paypalResponse.json();

    if (!paypalResponse.ok) {
      console.error('PayPal capture error:', capture);

      res.status(paypalResponse.status || 500).json({
        error: 'PayPal could not capture the payment.',
        details: capture,
      });
      return;
    }

    res.status(200).json({
      id: capture.id,
      status: capture.status,
      payer: capture.payer || null,
      purchaseUnits: capture.purchase_units || [],
    });
  } catch (error) {
    console.error('Capture order error:', error);

    res.status(500).json({
      error: 'Unable to capture the PayPal payment.',
    });
  }
}
