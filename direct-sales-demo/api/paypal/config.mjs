export default async function handler(request) {
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 },
      );
    }
  
    const clientId = process.env.PAYPAL_CLIENT_ID;
  
    if (!clientId) {
      return Response.json(
        { error: "PayPal Client ID is missing." },
        { status: 500 },
      );
    }
  
    return new Response(
      `
        window.PAYPAL_CLIENT_ID = ${JSON.stringify(clientId)};
        window.PAYPAL_ENV = ${JSON.stringify(
          process.env.PAYPAL_ENV || "sandbox",
        )};
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }