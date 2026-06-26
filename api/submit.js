const AIRTABLE_BASE_ID = 'appk6C18dNxzJvss7';
const AIRTABLE_TABLE  = 'Leads';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerName, dogName, phone: rawPhone, age, weight, activityLevel, outlet, spotted, source, consent, partner } = req.body || {};

  // Normalise to E.164 — always +91 for this activation
  const phone = rawPhone
    ? (rawPhone.startsWith('+') ? rawPhone : '+91' + rawPhone.replace(/^0+/, ''))
    : '';

  const resolvedOutlet = spotted || outlet || 'Unknown';

  // ── Which cafe activation? (shared base, tagged by Partner) ──
  const isPilgrim     = partner === 'cafe-pilgrim';
  const partnerName   = isPilgrim ? 'Cafe Pilgrim' : 'Earth Cafe';
  const defaultSource = isPilgrim ? 'pilgrim-cafe-qr' : 'earth-cafe-qr';
  const results = {};
  const warnings = [];

  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

  // ── 0. Duplicate guard: same Owner Name + Dog Name within this cafe ──
  if (AIRTABLE_PAT && (ownerName || '').trim() && (dogName || '').trim()) {
    try {
      const norm  = s => (s || '').trim().toLowerCase();
      const wantO = norm(ownerName), wantD = norm(dogName);
      const filter = encodeURIComponent(`{Partner}="${partnerName}"`); // partnerName is controlled, no user quotes
      let offset = '', dup = false;
      do {
        const u = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`
          + `?pageSize=100&filterByFormula=${filter}`
          + `&fields%5B%5D=${encodeURIComponent('Owner Name')}&fields%5B%5D=${encodeURIComponent('Dog Name')}`
          + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
        const cr = await fetch(u, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
        if (!cr.ok) break;
        const cj = await cr.json();
        dup = (cj.records || []).some(r =>
          norm(r.fields['Owner Name']) === wantO && norm(r.fields['Dog Name']) === wantD);
        offset = (!dup && cj.offset) ? cj.offset : '';
      } while (offset);
      if (dup) {
        return res.status(200).json({
          success: false, duplicate: true,
          message: 'You have already submitted once.',
        });
      }
    } catch (e) { /* non-fatal — allow the submit if the check itself fails */ }
  }

  // ── 1. Airtable ──────────────────────────────────────────────
  if (AIRTABLE_PAT) {
    try {
      const atRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            typecast: true,
            records: [{
              fields: {
                'Owner Name':     ownerName    || '',
                'Dog Name':       dogName      || '',
                'WhatsApp':       phone        || '',
                'Age':            age          || '',
                'Weight (kg)':    weight       || '',
                'Activity Level': activityLevel|| '',
                'Outlet':      resolvedOutlet,
                'Partner':     partnerName,
                'Source':      source   || defaultSource,
                'Consent':     consent  === true,
                'Submitted At': new Date().toISOString(),
              },
            }],
          }),
        }
      );
      if (!atRes.ok) {
        const err = await atRes.text();
        throw new Error(err);
      }
      results.airtable = 'saved';
    } catch (e) {
      warnings.push(`Airtable: ${e.message}`);
    }
  } else {
    warnings.push('Airtable: AIRTABLE_PAT env var not set');
  }

  // ── 2. Klaviyo ───────────────────────────────────────────────
  const KLAVIYO_KEY     = process.env.KLAVIYO_PRIVATE_KEY;
  // Optional per-cafe list; falls back to the shared list if not set
  const KLAVIYO_LIST_ID = (isPilgrim && process.env.KLAVIYO_LIST_ID_PILGRIM)
    ? process.env.KLAVIYO_LIST_ID_PILGRIM
    : process.env.KLAVIYO_LIST_ID;
  if (KLAVIYO_KEY && KLAVIYO_LIST_ID) {
    const klHeaders = {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      'Content-Type': 'application/json',
      revision: '2024-02-15',
    };
    try {
      // Step 1: upsert profile with all custom properties
      const profileRes = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: klHeaders,
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              phone_number: phone || '',
              properties: {
                owner_name:     ownerName      || '',
                dog_name:       dogName        || '',
                dog_age:        age            || '',
                dog_weight:     weight         || '',
                activity_level: activityLevel  || '',
                outlet:         resolvedOutlet,
                source:         source         || defaultSource,
                partner:        partnerName,
              },
            },
          },
        }),
      });

      // 201 = created, 409 = already exists (both are fine)
      const profileData = await profileRes.json();
      if (profileRes.status !== 201 && profileRes.status !== 409) {
        throw new Error(JSON.stringify(profileData));
      }

      // Extract profile ID (409 response includes the existing profile id in meta)
      const profileId =
        profileData?.data?.id ||
        profileData?.errors?.[0]?.meta?.duplicate_profile_id;

      // Step 2: add profile to the Earth Cafe list directly
      if (!profileId) throw new Error('No profile ID returned from Klaviyo');
      const subRes = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`, {
        method: 'POST',
        headers: klHeaders,
        body: JSON.stringify({
          data: [{ type: 'profile', id: profileId }],
        }),
      });
      // 204 = added, 404-ish duplicates are silent — both mean success
      if (subRes.status !== 204 && subRes.status !== 200) {
        const err = await subRes.text();
        throw new Error(err);
      }
      results.klaviyo = 'added_to_list';
    } catch (e) {
      warnings.push(`Klaviyo: ${e.message}`);
    }
  } else {
    warnings.push('Klaviyo: KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID not set');
  }

  return res.status(200).json({
    success: true,
    results,
    ...(warnings.length ? { warnings } : {}),
  });
}
