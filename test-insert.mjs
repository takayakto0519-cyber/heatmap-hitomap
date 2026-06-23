import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jutjrstpoaflhnrkppha.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NJTiu-MkLbcLJUwZsvpDjw_tnNXUxku';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  const { data, error } = await supabase.from('traces').insert({
    title: 'Test Trace',
    latitude: 35.6812,
    longitude: 139.7671,
    is_past_memory: false
  }).select().single();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Inserted:', data);
  }
}

testInsert();
