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
  // Activities are behind RLS, anon can't see them. Let's check what columns exist in users
  const { data: cols, error: colsErr } = await supabase.from('users').select('*').limit(1);
  console.log('users columns sample:', JSON.stringify(cols, null, 2), colsErr?.message);

  // Check get_top_users RPC
  const { data: topUsers, error: tuErr } = await supabase.rpc('get_top_users', { _limit: 5, _offset: 0 });
  console.log('get_top_users:', JSON.stringify(topUsers, null, 2), tuErr?.message);

  // Check get_platform_stats
  const { data: stats, error: statsErr } = await supabase.rpc('get_platform_stats');
  console.log('get_platform_stats:', JSON.stringify(stats, null, 2), statsErr?.message);
}

check();
