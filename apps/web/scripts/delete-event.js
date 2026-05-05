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
  const location = process.argv[4] || 'Main Hall';

  console.log('Searching for events with:', { projectId, title, location });

  try {
    const { data: rows, error } = await supabase
      .from('events')
      .select('id,title,location,start_at')
      .eq('project_id', projectId)
      .ilike('title', title)
      .maybeSingle();

    if (error) throw error;

    if (!rows) {
      // maybe multiple — try match title and location
      const { data: list, error: listErr } = await supabase
        .from('events')
        .select('id,title,location,start_at')
        .eq('project_id', projectId)
        .ilike('title', `%${title}%`)
        .ilike('location', `%${location}%`);

      if (listErr) throw listErr;

      if (!list || list.length === 0) {
        console.log('No matching events found.');
        process.exit(0);
      }

      console.log(`Found ${list.length} matching event(s). Deleting...`);
      const ids = list.map((r) => r.id);
      const { error: delErr } = await supabase
        .from('events')
        .delete()
        .in('id', ids);
      if (delErr) throw delErr;
      console.log('Deleted events:', ids.join(', '));
      process.exit(0);
    }

    // single row
    console.log('Found event:', rows);
    const { error: delErr } = await supabase
      .from('events')
      .delete()
      .eq('id', rows.id);
    if (delErr) throw delErr;
    console.log('Deleted event', rows.id);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
