const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const mode = process.argv[2];
  if (mode !== 'clean' && mode !== 'expedition') {
    console.error("Usage: node toggle_theme.js <clean|expedition>");
    process.exit(1);
  }

  const variant = mode;
  const override = mode === 'clean' ? 'day' : 'night';

  const { data, error } = await supabase
    .from('settings')
    .update({ theme_variant: variant, manual_theme_override: override })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all

  if (error) {
    console.error("Error updating settings:", error);
    process.exit(1);
  }

  console.log(`Updated theme to ${variant} (${override})`);
}

run();
