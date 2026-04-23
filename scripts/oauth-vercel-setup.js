// Google OAuth Vercel Setup Helper
console.log('🌐 Google OAuth Vercel Configuration Helper\n');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

console.log('📋 CURRENT GOOGLE CONFIGURATION (.env.local):');
console.log('==========================================');

// Read current env file
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// Find Google config lines
let googleClientId = '';
let googleClientSecret = '';

lines.forEach(line => {
  if (line.includes('GOOGLE_CLIENT_ID')) {
    googleClientId = line.split('=')[1]?.trim().replace(/['"]/g, '');
    console.log(`GOOGLE_CLIENT_ID: ${googleClientId}`);
  }
  if (line.includes('GOOGLE_CLIENT_SECRET')) {
    googleClientSecret = line.split('=')[1]?.trim().replace(/['"]/g, '');
    const masked = `${googleClientSecret.substring(0, 8)}...${googleClientSecret.substring(googleClientSecret.length - 8)}`;
    console.log(`GOOGLE_CLIENT_SECRET: ${masked}`);
  }
});

if (googleClientId === 'your-google-client-id.apps.googleusercontent.com' || 
    googleClientSecret === 'your-google-client-secret') {
  console.log('\n🚨 ISSUE: Google credentials are still placeholder values');
  console.log('Please update .env.local first with real Google credentials');
  console.log('Run: node scripts/update-google-env.js');
  process.exit(1);
}

console.log('\n✅ Google credentials configured correctly in .env.local');
console.log('\n🔗 VERCEL SETUP REQUIRED');
console.log('==========================================');
console.log('⚠️ CRITICAL: OAuth credentials MUST be added to Vercel dashboard');
console.log('\n📋 STEPS TO ADD TO VERCEL:');

console.log('\nSTEP 1: Open Vercel Dashboard');
console.log('============================');
console.log('Go to: https://vercel.com/dashboard');
console.log('Select your "quill-ai" project');

console.log('\nSTEP 2: Add Environment Variables');
console.log('==================================');
console.log('1. Click "Settings" tab');
console.log('2. Navigate to "Environment Variables" section');
console.log('3. Add these variables:');

const maskedClientId = `${googleClientId.substring(0, 12)}...${googleClientId.substring(googleClientId.length - 8)}`;
const maskedSecret = `${googleClientSecret.substring(0, 12)}...${googleClientSecret.substring(googleClientSecret.length - 8)}`;

console.log(`\n🔑 GOOGLE_CLIENT_ID`);
console.log(`   Value: ${googleClientId}`);
console.log(`   Display: ${maskedClientId}`);
console.log(`   Type: Environment Variable`);

console.log(`\n🔑 GOOGLE_CLIENT_SECRET`);  
console.log(`   Value: ${googleClientSecret}`);
console.log(`   Display: ${maskedSecret}`);
console.log(`   Type: Environment Variable (select "Secret" or "Encrypted" option)`);

console.log('\n🚀 STEP 3: Deploy/Redeploy');
console.log('============================');
console.log('After adding environment variables:');
console.log('1. Go to "Deployments" tab');
console.log('2. Click "New Deployment" or "Redeploy"');
console.log('3. Your new credentials will be applied');

console.log('\n📋 VERIFICATION STEPS');
console.log('====================');
console.log('After deployment:');
console.log('1. Visit: https://quill-ai-xi.vercel.app/login');
console.log('2. Click "Continue with Google"');
console.log('3. Should successfully authenticate with Google');

console.log('\n🔍 TROUBLESHOOTING');
console.log('==================');
console.log('If OAuth still fails:');
console.log('1. Check Vercel environment variables are set correctly');
console.log('2. Ensure no extra spaces in values');
console.log('3. Verify redirect URI matches exactly in Google Console');
console.log('4. Check Vercel deployment logs for any errors');

console.log('\n📄 SUMMARY');
console.log('==========');
console.log('✅ Local configuration: COMPLETED');
console.log('⏳ Vercel setup: PENDING (you need to do this manually)');
console.log('✅ OAuth functionality: READY after Vercel deployment');

console.log('\n💡 TIP: You can also use Vercel CLI to deploy with environment variables:');
console.log('vercel --prod --env GOOGLE_CLIENT_ID=your-real-id --env GOOGLE_CLIENT_SECRET=your-real-secret');
