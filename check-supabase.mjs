import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jutjrstpoaflhnrkppha.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NJTiu-MkLbcLJUwZsvpDjw_tnNXUxku';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('traces').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Error fetching traces:', error);
  } else {
    console.log('Traces count:', data.length);
    if (data.length > 0) {
      console.log('Latest trace:', data[0]);
    }
  }
}

check();
