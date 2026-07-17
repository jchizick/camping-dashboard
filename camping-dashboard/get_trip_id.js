const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: trips, error } = await supabase.from('trips').select('id, name').limit(1);
  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }
  console.log("Trip:", trips[0]);
}

run();
