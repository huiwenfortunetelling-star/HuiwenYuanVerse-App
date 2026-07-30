export default function handler(req, res) {
    if (req.method !== 'GET') {
      res.status(405).json({
        error: 'Method not allowed.',
      });
      return;
    }
  
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  
    if (!supabaseUrl || !publishableKey) {
      res.status(500).json({
        error: 'Supabase configuration is missing.',
      });
      return;
    }
  
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  
    res.status(200).send(`
      window.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
      window.SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};
    `);
  }