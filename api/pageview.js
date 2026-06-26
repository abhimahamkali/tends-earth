const AIRTABLE_BASE_ID = 'appk6C18dNxzJvss7';
const AIRTABLE_TABLE  = 'Visits';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  if (!AIRTABLE_PAT) return res.status(200).json({ ok: false });

  const { outlet, source, partner } = req.body || {};
  const partnerName = partner === 'cafe-pilgrim' ? 'Cafe Pilgrim' : 'Earth Cafe';
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD IST approx

  try {
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: [{ fields: {
            'Timestamp': now.toISOString(),
            'Outlet':    outlet || 'Unknown',
            'Partner':   partnerName,
            'Source':    source || 'direct',
            'Date':      date,
          }}],
        }),
      }
    );
  } catch (_) {}

  return res.status(200).json({ ok: true });
}
