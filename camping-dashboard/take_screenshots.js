const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const themeSuffix = process.argv[2] || 'clean'; // 'clean' or 'expedition'
const outDir = 'C:/Users/jorda/.gemini/antigravity-ide/brain/e0e3c231-c26c-4e0d-995c-aacc9a0f6314';

async function run() {
  // 1. Get user and generate magic link
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users[0];
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  const magicLink = linkData.properties.action_link;
  console.log(`Generated magic link for ${user.email}`);

  // 2. Launch browser
  const browser = await chromium.launch();
  
  // -- Desktop Context --
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await desktopContext.newPage();
  
  console.log('Navigating to magic link (desktop)...');
  await dPage.goto(magicLink);
  await dPage.waitForURL('**/trips'); // wait for redirect
  
  console.log('Taking screenshot: /trips (desktop)');
  await dPage.waitForTimeout(1000); // Wait for fonts/render
  await dPage.screenshot({ path: `${outDir}/${themeSuffix}_desktop_trips.png` });

  console.log('Taking screenshot: /trips/new (desktop)');
  await dPage.goto('http://localhost:3000/trips/new');
  await dPage.waitForTimeout(1000);
  await dPage.screenshot({ path: `${outDir}/${themeSuffix}_desktop_trips_new.png` });

  console.log('Taking screenshot: /trips/trip-maple-lake-001 (desktop)');
  await dPage.goto('http://localhost:3000/trips/trip-maple-lake-001');
  await dPage.waitForTimeout(2000); // Wait for cards
  await dPage.screenshot({ path: `${outDir}/${themeSuffix}_desktop_dashboard.png`, fullPage: true });
  
  // -- Mobile Context --
  // Use same browser, but new context with mobile viewport
  const mobileContext = await browser.newContext({ 
    viewport: { width: 375, height: 812 },
    isMobile: true
  });
  const mPage = await mobileContext.newPage();
  
  // Transfer auth cookies from desktop context
  const cookies = await desktopContext.cookies();
  await mobileContext.addCookies(cookies);

  console.log('Taking screenshot: /trips/trip-maple-lake-001 (mobile)');
  await mPage.goto('http://localhost:3000/trips/trip-maple-lake-001');
  await mPage.waitForTimeout(2000);
  await mPage.screenshot({ path: `${outDir}/${themeSuffix}_mobile_dashboard.png`, fullPage: true });

  await browser.close();
  console.log(`Finished ${themeSuffix} screenshots`);
}

run().catch(console.error);
