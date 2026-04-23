// Google OAuth Debugging Script
console.log('🔍 Google OAuth Debugging Script\n');

console.log('📋 ENVIRONMENT CHECK:');
console.log('============================');

// Check environment variables
const checkEnv = (name, secret = false) => {
  try {
    const value = process.env[name] || 'NOT SET';
    if (secret) {
      const masked = value.length > 10 ? `${value.substring(0, 8)}***${value.substring(value.length - 4)}` : value;
      console.log(`   ${name}: ${masked === 'NOT SET' ? '❌' : '🔒'} ${masked}`);
    } else {
      console.log(`   ${name}: ${value === 'NOT SET' ? '❌' : value.startsWith('your-') ? '⚠️ PLACEHOLDER' : '✅'} ${value}`);
    }
  } catch (error) {
    console.log(`   ${name}: ❌ ERROR READING`);
  }
};

checkEnv('GOOGLE_CLIENT_ID');
checkEnv('GOOGLE_CLIENT_SECRET', true);
checkEnv('BETTER_AUTH_SECRET', true);
checkEnv('BETTER_AUTH_URL');
checkEnv('NEXT_PUBLIC_APP_URL');
checkEnv('VERCEL_URL');

console.log('\n🌐 URL RESOLUTION:');
console.log('============================');

// URL resolution
function resolveBaseURL() {
  const explicit = process.env.BETTER_AUTH_URL;
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_URL;

  console.log(`   BETTER_AUTH_URL: ${explicit || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_APP_URL: ${publicUrl || 'NOT SET'}`);
  console.log(`   VERCEL_URL: ${vercel || 'NOT SET'}`);

  let finalURL = explicit || publicUrl || vercel;
  
  if (vercel && !vercel.startsWith('http')) {
    finalURL = `https://${vercel}`;
  }

  console.log(`   🎯 Resolved Base URL: ${finalURL || '❌ NO URL FOUND'}`);
  return finalURL;
}

function resolveRedirectURI() {
  const baseURL = resolveBaseURL();
  if (!baseURL) {
    console.log('   ❌ Cannot determine redirect URI - no base URL');
    return null;
  }

  const redirectURI = `${baseURL}/api/auth/callback/google`;
  console.log(`   🎯 Redirect URI: ${redirectURI}`);
  
  // Check if HTTPS
  const isHTTPS = baseURL.startsWith('https://');
  console.log(`   🔒 HTTPS Status: ${isHTTPS ? '✅ SECURE' : '⚠️ HTTP (OK for dev, must be HTTPS for production)'}`);
  
  return redirectURI;
}

console.log('\n🔗 REDIRECT URI ANALYSIS:');
const redirectURI = resolveRedirectURI();

console.log('\n🚫 COMMON ISSUES:');
console.log('============================');
console.log('1. Client ID/Secret: Replace placeholder values from Google Cloud Console');
console.log('2. HTTPS: Dev can use HTTP, production MUST use HTTPS');
console.log('3. Redirect URI: Must exactly match what you configured in Google Cloud Console');
console.log('4. Domain: Google OAuth 2.0 requires authorized domains in project settings');

console.log('\n🛠️ STEPS TO FIX:');
console.log('============================');
console.log('STEP 1: Google Cloud Console');
console.log('   → Go to: https://console.cloud.google.com/');
console.log('   → OAuth consent screen (External user type)');
console.log('   → Credentials → OAuth client ID (Web application)');
console.log('   → Add redirect URI: https://quill-ai-xi.vercel.app/api/auth/callback/google');

console.log('\nSTEP 2: Update .env.local');
console.log('   → Replace GOOGLE_CLIENT_ID with actual value');
console.log('   → Replace GOOGLE_CLIENT_SECRET with actual value');

console.log('\nSTEP 3: Deploy to Vercel (if not already deployed)');
console.log('   → OAuth requires actual domain, not localhost');

console.log('\nSTEP 4: Test the flow');
console.log('   → Visit: https://quill-ai-xi.vercel.app/login');
console.log('   → Click "Continue with Google"');

console.log('\n📋 ENVIRONMENT SETTING:');
console.log('============================');
console.log('For local development:');
console.log('   BETTER_AUTH_URL=http://localhost:3000');
console.log('   NEXT_PUBLIC_APP_URL=http://localhost:3000');

console.log('For production (Vercel):');
console.log('   BETTER_AUTH_URL=https://quill-ai-xi.vercel.app');
console.log('   NEXT_PUBLIC_APP_URL=https://quill-ai-xi.vercel.app');

console.log('\n⚡ QUICK FIX:');
console.log('============================');
console.log('If you have Google credentials:');
console.log('1. Paste Client ID/Secret into .env.local');
console.log('2. Deploy to Vercel');
console.log('3. Test /login page');

if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your-google-client-id.apps.googleusercontent.com') {
  console.log('\n🚨 CRITICAL ISSUE: Google Credentials Not Set');
  console.log('   OAuth cannot work without actual Google Cloud credentials');
} else {
  console.log('\n✅ Google Credentials Available');
  console.log('   OAuth should work once deployed');
}
