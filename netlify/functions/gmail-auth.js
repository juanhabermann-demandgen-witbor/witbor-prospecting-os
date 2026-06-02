exports.handler = async (event) => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = process.env.URL + '/.netlify/functions/gmail-callback';
  const scope = 'https://www.googleapis.com/auth/gmail.send';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  return {
    statusCode: 302,
    headers: { Location: authUrl }
  };
};
