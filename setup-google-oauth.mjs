// Google OAuth Interactive Setup Script (ES Module)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

console.log('🔑 Google OAuth Interactive Setup\n');

// Read current environment file
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// Find Google credentials
const googleClientIdLine = lines.find(line => line.includes('GOOGLE_CLIENT_ID'));
const googleClientSecretLine = lines.find(line => line.includes('GOOGLE_CLIENT_SECRET'));

const currentClientId = googleClientIdLine?.split('=')[1]?.trim() || 'NOT FOUND';
const currentClientSecret = googleClientSecretLine?.split('=')[1]?.trim() || 'NOT FOUND';

console.log('📋 CURRENT GOOGLE CONFIGURATION:');
console.log(`Client ID: ${currentClientId}`);
console.log(`Client Secret: ${currentClientSecret === 'your-google-client-secret' ? 'STILL PLACEHOLDER' : 'SET'}`);

console.log('\n🚨 STATUS:');
if (currentClientId.includes('your-google-client-id')) {
  console.log('❌ Google credentials still using placeholders');
  console.log('📋 STEPS TO COMPLETE GOOGLE OAUTH:');
  console.log('==================================');
  console.log('1. Go to: https://console.cloud.google.com/');
  console.log('2. Create OAuth 2.0 client ID for Web Application');
  console.log('3. Add redirect URI: https://quill-ai-xi.vercel.app/api/auth/callback/google');
  console.log('4. Copy Client ID and Client Secret');
  console.log('5. Continue this setup script');

  // Get user input
  const input = await getInput('Paste your Google Client ID: ');
  const input2 = await getInput('Paste your Google Client Secret: ');
  const confirm = await getInput('Update .env.local with these credentials? (y/N): ');

  if (confirm.toLowerCase() === 'y') {
    // Update the file
    const updatedLines = lines.map(line => {
      if (line.includes('GOOGLE_CLIENT_ID')) {
        return `GOOGLE_CLIENT_ID=${input.trim()}`;
      } else if (line.includes('GOOGLE_CLIENT_SECRET')) {
        return `GOOGLE_CLIENT_SECRET=${input2.trim()}`;
      }
      return line;
    });

    const updatedContent = updatedLines.join('\n');
    fs.writeFileSync(envPath, updatedContent);

    console.log('\n✅ Environment file updated successfully!');
    console.log('\n🌐 NEXT STEPS (MANUAL):');
    console.log('======================');
    console.log('1. Add credentials to Vercel dashboard:');
    console.log('   - Go to: https://vercel.com/dashboard');
    console.log('   - Settings → Environment Variables');
    console.log('   - Add:');
    console.log('   - Name: GOOGLE_CLIENT_ID');
    console.log('   - Value: ' + input.trim());
    console.log('   - Name: GOOGLE_CLIENT_SECRET');  
    console.log('   - Value: ' + input2.trim());
    console.log('   (Select "Secret" or "Encrypted" for secret)');
    console.log('\n2. Redeploy: New Deployment → Redeploy');
    console.log('\n3. Test at: https://quill-ai-xi.vercel.app/login');
  } else {
    console.log('\n❌ Update cancelled. You can manually update .env.local');
  }
} else {
  console.log('✅ Google credentials already configured');
  console.log('\n🌐 ADD TO VERCEL DASHBOARD:');
  console.log('==========================');
  console.log('Go to: https://vercel.com/dashboard');
  console.log('1. Select your "quill-ai" project');
  console.log('2. Settings → Environment Variables');
  console.log('3. Add:');
  console.log('   Name: GOOGLE_CLIENT_ID');
  console.log('   Value: ' + currentClientId);
  console.log('   Name: GOOGLE_CLIENT_SECRET');
  console.log('   Value: ' + currentClientSecret);
  console.log('   (Select "Secret" or "Encrypted" for secret)');
  console.log('\n4. Redeploy: New Deployment → Redeploy');
  console.log('\n5. Test at: https://quill-ai-xi.vercel.app/login');
}

function getInput(prompt) {
  return new Promise(resolve => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Wait for script to complete
await new Promise(resolve => setTimeout(resolve, 100));
