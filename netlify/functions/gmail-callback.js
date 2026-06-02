exports.handler = async (event) => {
  const { code } = event.queryStringParameters || {};
  if (!code) return { statusCode: 400, body: 'No code' };

  const REDIRECT_URI = process.env.URL + '/.netlify/functions/gmail-callback';

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await res.json();
    if (tokens.error) return { statusCode: 400, body: JSON.stringify(tokens) };

    tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);

    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_KEY;

    await fetch(`${sbUrl}/rest/v1/config`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ key: 'gmail_tokens', value: JSON.stringify(tokens) })
    });

    return {
      statusCode: 302,
      headers: { Location: '/?gmail=connected' }
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
