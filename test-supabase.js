import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_platform_stats');
  console.log('RPC result:', data, error);
  
  const { data: actData, error: actError } = await supabase.from('activities').select('distance_km').limit(2);
  console.log('Activities result:', actData, actError);
}
test();
