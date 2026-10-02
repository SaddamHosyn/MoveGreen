import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  // Test logging an activity to see what error or points we get
  const { data, error } = await supabase.from('activities').insert({
    user_id: '00000000-0000-0000-0000-000000000000', // invalid but we'll see if it hits points calc first or FK first
    transport_type: 'cycling',
    distance_km: 1
  });
  console.log('Insert:', data, error);
}

check();
