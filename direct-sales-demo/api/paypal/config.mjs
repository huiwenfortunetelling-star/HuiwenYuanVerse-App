export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method not allowed.',
    });
    return;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;

  if (!clientId) {
    res.status(500).json({
      error: 'PayPal Client ID is missing.',
    });
    return;
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).send(`
    window.PAYPAL_CLIENT_ID = ${JSON.stringify(clientId)};
    window.PAYPAL_ENV = ${JSON.stringify(
      process.env.PAYPAL_ENV || 'sandbox'
    )};
  `);
}
