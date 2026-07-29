const PRODUCTS = {
    p1: {
      name: "静心山水 · 电子图片",
      price: "19.00",
    },
    p2: {
      name: "东方禅意 · 电子图片",
      price: "29.00",
    },
    p3: {
      name: "城市夜景 · 电子图片",
      price: "39.00",
    },
  };
  
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
      const { productId } = await request.json();
      const product = PRODUCTS[productId];
  
      if (!product) {
        return Response.json(
          { error: "Invalid product." },
          { status: 400 },
        );
      }
  
      const accessToken = await getAccessToken();
  
      const paypalResponse = await fetch(
        `${getPayPalBaseUrl()}/v2/checkout/orders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                description: product.name,
                amount: {
                  currency_code: "CAD",
                  value: product.price,
                },
              },
            ],
          }),
        },
      );
  
      const order = await paypalResponse.json();
  
      if (!paypalResponse.ok) {
        console.error("PayPal create-order error:", order);
  
        return Response.json(
          { error: "PayPal could not create the order." },
          { status: paypalResponse.status },
        );
      }
  
      return Response.json({
        id: order.id,
      });
    } catch (error) {
      console.error("Create order error:", error);
  
      return Response.json(
        { error: "Unable to create the PayPal order." },
        { status: 500 },
      );
    }
  }