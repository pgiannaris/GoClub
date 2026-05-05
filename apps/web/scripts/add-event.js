const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

(async () => {
  const envPath = path.resolve(__dirname, '../.env');
  loadEnv(envPath);

  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    console.error('Missing SUPABASE config in apps/web/.env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const projectId = process.argv[2] || '4e69bfd2-9686-455e-b660-46ec30540397';
  const title = process.argv[3] || 'New Club Meeting';
  const description = process.argv[4] || 'Weekly sync up';
  const location = process.argv[5] || 'Main Hall';
  const startAt = process.argv[6] || '2026-03-16T19:00:00Z';

  console.log('Inserting event with:', {
    projectId,
    title,
    description,
    location,
    startAt,
  });

  try {
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          project_id: projectId,
          title,
          description,
          start_at: startAt,
          end_at: null,
          location,
          rsvp_url: null,
          status: 'scheduled',
          visibility: 'public',
        },
      ])
      .select();

    if (error) throw error;

    console.log('Inserted event:', data);
  } catch (err) {
    console.error('Error inserting event:', err.message || err);
    process.exit(1);
  }
})();
