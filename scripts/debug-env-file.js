// Environment File Debugging Script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
console.log(`📄 Reading environment file: ${envPath}`);

if (!fs.existsSync(envPath)) {
  console.log('❌ Environment file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
console.log('📋 Environment File Content:');
console.log('================================');

const lines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
const envVars = {};

lines.forEach(line => {
  const [key, value] = line.split('=').map(part => part.trim());
  if (key && value) {
    // Remove quotes if present
    const cleanValue = value.replace(/^['"]|['"]$/g, '');
    envVars[key] = cleanValue;
    
    console.log(`${key}: ${cleanValue.startsWith('your-') ? '⚠️ PLACEHOLDER' : key.includes('SECRET') ? '🔒 SET' : '✅ SET'} ${cleanValue}`);
  }
});

console.log('\n🌐 URL Configuration Check:');
console.log('================================');

// Check URL variables
const urlVars = ['BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL', 'VERCEL_URL'];
urlVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    const isHttps = value.startsWith('https://');
    console.log(`${varName}: ${value} (${isHttps ? '✅ HTTPS' : value.startsWith('http://localhost') ? '✅ LOCAL DEV' : '⚠️ HTTP (needs HTTPS for production)'})`);
  } else {
    console.log(`${varName}: ❌ NOT SET`);
  }
});

console.log('\n🔑 Google OAuth Configuration:');
console.log('================================');

const googleClientId = envVars.GOOGLE_CLIENT_ID;
const googleClientSecret = envVars.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientId !== 'your-google-client-id.apps.googleusercontent.com') {
  const masked = `${googleClientId.substring(0, 8)}...${googleClientId.substring(googleClientId.length - 8)}`;
  console.log(`✅ GOOGLE_CLIENT_ID: ${masked}`);
} else {
  console.log('❌ GOOGLE_CLIENT_ID: Not set or still using placeholder');
}

if (googleClientSecret && googleClientSecret !== 'your-google-client-secret') {
  const masked = `${googleClientSecret.substring(0, 8)}...${googleClientSecret.substring(googleClientSecret.length - 8)}`;
  console.log(`✅ GOOGLE_CLIENT_SECRET: ${masked}`);
} else {
  console.log('❌ GOOGLE_CLIENT_SECRET: Not set or still using placeholder');
}

console.log('\n🎯 Required Actions:');
console.log('================================');

if (!googleClientId || googleClientId === 'your-google-client-id.apps.googleusercontent.com') {
  console.log('🚨 CRITICAL: You need to:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create OAuth credentials for web application');
  console.log('3. Add redirect URI: https://quill-ai-xi.vercel.app/api/auth/callback/google');
  console.log('4. Replace the placeholder values in .env.local');
} else {
  console.log('✅ Google credentials configured - OAuth should work when deployed');
}

console.log('\n🏗️ Deployment Status:');
console.log('================================');

const vercelUrl = envVars.VERCEL_URL;
if (vercelUrl) {
  console.log('✅ Vercel deployment detected');
  console.log(`🌐 Production URL will be: https://${vercelUrl}`);
} else {
  console.log('⚠️ Vercel URL not found - set VERCEL_URL environment variable');
  console.log('   Or run: npx vercel --prod');
}

console.log('\n🚀 Next Steps:');
console.log('================================');
console.log('1. Get Google Cloud OAuth credentials');
console.log('2. Update .env.local with real values');
console.log('3. Deploy to Vercel: npx vercel --prod');
console.log('4. Test at: https://quill-ai-xi.vercel.app/login');

// Generate a .env.local template
console.log('\n📝 .env.local Template for Your Reference:');
console.log('================================');
console.log('# Replace these values with your actual Google credentials');
console.log('GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com');
console.log('GOOGLE_CLIENT_SECRET=your-actual-client-secret');
console.log('');
console.log('# These should already be set correctly');
console.log('BETTER_AUTH_URL=https://quill-ai-xi.vercel.app');
console.log('NEXT_PUBLIC_APP_URL=https://quill-ai-xi.vercel.app');
