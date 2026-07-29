function getPayPalBaseUrl() {
    return process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }
  
  async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials are missing.");
    }
  
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
    const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  
    const data = await response.json();
  
    if (!response.ok || !data.access_token) {
      throw new Error("Unable to obtain PayPal access token.");
    }
  
    return data.access_token;
  }
  
  export default async function handler(request) {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 },
      );
    }
  
    try {
      const { orderId } = await request.json();
  
      if (!orderId || !/^[A-Z0-9]+$/.test(orderId)) {
        return Response.json(
          { error: "Invalid PayPal order ID." },
          { status: 400 },
        );
      }
  
      const accessToken = await getAccessToken();
  
      const paypalResponse = await fetch(
        `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
  
      const capture = await paypalResponse.json();
  
      if (!paypalResponse.ok) {
        console.error("PayPal capture error:", capture);
  
        return Response.json(
          {
            error: "PayPal could not capture the payment.",
            details: capture,
          },
          { status: paypalResponse.status },
        );
      }
  
      return Response.json({
        id: capture.id,
        status: capture.status,
        payer: capture.payer || null,
        purchaseUnits: capture.purchase_units || [],
      });
    } catch (error) {
      console.error("Capture order error:", error);
  
      return Response.json(
        { error: "Unable to capture the PayPal payment." },
        { status: 500 },
      );
    }
  }