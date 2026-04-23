// Google Credentials Setup Helper
console.log('🔑 Google OAuth Setup Helper\n');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

console.log('📋 CURRENT STATE:');
console.log('================');

// Read current env file
const envContent = fs.readFileSync(envPath, 'utf8');
const googleClientIdLine = envContent.split('\n').find(line => line.includes('GOOGLE_CLIENT_ID'));
const googleClientSecretLine = envContent.split('\n').find(line => line.includes('GOOGLE_CLIENT_SECRET'));

const currentClientId = googleClientIdLine?.split('=')[1]?.trim() || 'NOT FOUND';
const currentClientSecret = googleClientSecretLine?.split('=')[1]?.trim() || 'NOT FOUND';

console.log(`Google Client ID: ${currentClientId}`);
console.log(`Google Client Secret: ${currentClientSecret === 'your-google-client-secret' ? 'STILL PLACEHOLDER' : 'SET'}`);

if (currentClientId.includes('your-google-client-id')) {
  console.log('\n🚨 STEP 1: GET GOOGLE CREDENTIALS');
  console.log('==============================');
  console.log('1. Go to: https://console.cloud.google.com/');
  console.log('2. Select your project or create "Quill AI"');
  console.log('3. APIs & Services → OAuth consent screen → External user type');
  console.log('4. Create credentials → OAuth client ID → Web application');
  console.log('5. Add redirect URI: https://quill-ai-xi.vercel.app/api/auth/callback/google');

  console.log('\n📝 STEP 2: UPDATE CREDENTIALS');
  console.log('============================');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Paste your Google Client ID: ', (clientId) => {
    rl.question('Paste your Google Client Secret: ', (clientSecret) => {
      rl.question('Update .env.local with these credentials? (y/N): ', (confirm) => {
        if (confirm.toLowerCase() === 'y') {
          // Update the file
          const lines = envContent.split('\n');
          const updatedLines = lines.map(line => {
            if (line.includes('GOOGLE_CLIENT_ID')) {
              return `GOOGLE_CLIENT_ID=${clientId.trim()}`;
            } else if (line.includes('GOOGLE_CLIENT_SECRET')) {
              return `GOOGLE_CLIENT_SECRET=${clientSecret.trim()}`;
            }
            return line;
          });

          const updatedContent = updatedLines.join('\n');
          fs.writeFileSync(envPath, updatedContent);

          console.log('\n✅ Environment file updated successfully!');
          console.log('\n🌐 STEP 3: ADD TO VERCEL');
          console.log('======================');
          console.log('Go to: https://vercel.com/dashboard');
          console.log('1. Select your "quill-ai" project');
          console.log('2. Settings → Environment Variables');
          console.log('3. Add:');
          console.log('   Name: GOOGLE_CLIENT_ID');
          console.log('   Value: ' + clientId.trim());
          console.log('   Name: GOOGLE_CLIENT_SECRET');
          console.log('   Value: ' + clientSecret.trim());
          console.log('   (Select "Secret" or "Encrypted" for secret)');
          console.log('\n4. Redeploy: New Deployment → Redeploy');

          console.log('\n🚀 STEP 4: TEST');
          console.log('================');
          console.log('After deployment:');
          console.log('1. Visit: https://quill-ai-xi.vercel.app/login');
          console.log('2. Click "Continue with Google"');
          console.log('3. Should authenticate successfully');
        } else {
          console.log('\n❌ Update cancelled. You can manually update .env.local');
        }
        
        rl.close();
      });
    });
  });
} else {
  console.log('\n✅ Credentials already set in .env.local');
  console.log('\n🌐 NEXT STEPS:');
  console.log('==============');
  console.log('1. Add credentials to Vercel dashboard:');
  console.log('   - Go to: https://vercel.com/dashboard');
  console.log('   - Environment Variables → Add secret variables');
  console.log('   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  console.log('2. Redeploy the project');
  console.log('3. Test at: https://quill-ai-xi.vercel.app/login');
}
