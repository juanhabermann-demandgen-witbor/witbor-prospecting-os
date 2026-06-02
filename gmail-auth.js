exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { to, subject, body: emailBody } = JSON.parse(event.body || '{}');
  if (!to || !subject || !emailBody) return { statusCode: 400, body: 'Missing fields' };

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_KEY;

  try {
    // Obtener tokens de Supabase
    const tokenRes = await fetch(`${sbUrl}/rest/v1/config?key=eq.gmail_tokens`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.length) return { statusCode: 401, body: 'Gmail no autorizado. Conectá Gmail primero.' };

    let tokens = JSON.parse(tokenData[0].value);

    // Refrescar token si es necesario
    if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token'
        })
      });
      const refreshed = await refreshRes.json();
      tokens.access_token = refreshed.access_token;
      tokens.expiry_date = Date.now() + (refreshed.expires_in * 1000);
      // Guardar tokens actualizados
      await fetch(`${sbUrl}/rest/v1/config?key=eq.gmail_tokens`, {
        method: 'PATCH',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ value: JSON.stringify(tokens) })
      });
    }

    // Construir email en formato RFC 2822
    const from = 'juan.habermann@witbor.com';
    const emailContent = [
      `From: WITBOR <${from}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody
    ].join('\r\n');

    const encoded = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encoded })
    });

    const result = await sendRes.json();
    if (result.id) {
      return { statusCode: 200, body: JSON.stringify({ success: true, messageId: result.id }) };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: result.error?.message || 'Error al enviar' }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
