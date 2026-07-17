const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error);
    process.exit(1);
  }
  
  const user = users[0];
  if (!user) {
    console.log("No users found");
    return;
  }
  console.log("Found user:", user.email);

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });

  if (linkError) {
    console.error("Error generating link:", linkError);
    process.exit(1);
  }

  console.log("Magic link:", linkData.properties.action_link);
}

run();
