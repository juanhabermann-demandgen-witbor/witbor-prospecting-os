exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const { nombre, empresa, email } = JSON.parse(event.body || '{}');
  if (!nombre && !email) return { statusCode: 400, body: 'Se requiere nombre o email' };

  const APOLLO_KEY = process.env.APOLLO_API_KEY;

  try {
    const payload = {
      reveal_personal_emails: false,
      reveal_phone_number: false
    };
    if (email) payload.email = email;
    if (nombre) {
      const parts = nombre.trim().split(' ');
      payload.first_name = parts[0];
      if (parts.length > 1) payload.last_name = parts.slice(1).join(' ');
    }
    if (empresa) payload.organization_name = empresa;

    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const person = data.person;

    if (!person) return { statusCode: 404, body: JSON.stringify({ error: 'No se encontró el prospecto en Apollo' }) };

    const result = {
      nombre: person.name || nombre,
      cargo: person.title || '',
      email: person.email || '',
      linkedin: person.linkedin_url || '',
      empresa: person.organization?.name || empresa,
      empleados: person.organization?.estimated_num_employees || null,
      industria: person.organization?.industry || '',
      ciudad: person.city || '',
      pais: person.country || '',
      seniales: []
    };

    // Detectar señales automáticamente
    if (person.employment_history?.length > 0) {
      const current = person.employment_history.find(e => e.current);
      if (current) {
        const startDate = new Date(current.start_date);
        const diffMonths = (new Date() - startDate) / (1000 * 60 * 60 * 24 * 30);
        if (diffMonths <= 3) result.seniales.push('cambio_cargo');
      }
    }
    if (person.organization?.estimated_num_employees > 200) result.seniales.push('crecimiento');
    const technologies = person.organization?.current_technologies?.map(t => t.name?.toLowerCase()) || [];
    const competidores = ['freshdesk', 'intercom', 'salesforce', 'zenvia'];
    if (competidores.some(c => technologies.includes(c))) result.seniales.push('competidor');

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
