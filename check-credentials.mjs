// Quick credentials verification script
console.log('🔑 Quick Google OAuth Check\n');
console.log('📁 Checking .env.local file...\n');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

const googleClientIdLine = lines.find(line => line.includes('GOOGLE_CLIENT_ID'));
const googleClientSecretLine = lines.find(line => line.includes('GOOGLE_CLIENT_SECRET'));

const clientId = googleClientIdLine?.split('=')[1]?.trim() || 'NOT FOUND';
const clientSecret = googleClientSecretLine?.split('=')[1]?.trim() || 'NOT FOUND';

console.log('🔍 Google OAuth Status:');
console.log('====================');
console.log(`Client ID: ${clientId}`);
console.log(`Client Secret: ${clientSecret.length > 20 ? clientSecret.substring(0, 12) + '...' + clientSecret.substring(clientSecret.length - 8) : clientSecret}`);

console.log('\n🎯 Assessment:');
if (clientId === 'your-google-client-id.apps.googleusercontent.com' || clientId.length < 20) {
  console.log('❌ Client ID needs real Google OAuth value');
  console.log('📋 Go to: https://console.cloud.google.com/');
  console.log('📝 Get your real Client ID from Google Cloud Console');
} else {
  console.log('✅ Client ID looks valid');
}

if (clientSecret === 'your-google-client-secret' || clientSecret.length < 20) {
  console.log('❌ Client Secret needs real Google OAuth value');
  console.log('📋 Go to: https://console.cloud.google.com/');
  console.log('📝 Get your real Client Secret from Google Cloud Console');
} else {
  console.log('✅ Client Secret looks valid');
}

console.log('\n🚀 Deployment Status:');
console.log('===================');
console.log('✅ Vercel credentials: Added (as you mentioned)');
console.log('⏳ Local file: Needs real values from Google Console');
console.log('📋 Next: Replace placeholders in .env.local file');

console.log('\n💡 Action Required:');
console.log('==================');
console.log('1. Get real credentials from https://console.cloud.google.com/');
console.log('2. Replace these lines in .env.local:');
console.log('   GOOGLE_CLIENT_ID=your-real-client-id.apps.googleusercontent.com');
console.log('   GOOGLE_CLIENT_SECRET=your-real-client-secret');
console.log('3. Deploy to Vercel with updated secrets');
console.log('4. Test: https://quill-ai-xi.vercel.app/login');
