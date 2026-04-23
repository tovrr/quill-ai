// Google OAuth Environment Update Helper
console.log('🔑 Google OAuth Environment Setup Helper\n');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

console.log('📋 CURRENT GOOGLE CONFIGURATION:');
console.log('==================================');

// Read current env file
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// Find Google config lines
const googleLines = lines.filter(line => 
  line.includes('GOOGLE_CLIENT_ID') || line.includes('GOOGLE_CLIENT_SECRET')
);

googleLines.forEach(line => {
  if (line.includes('GOOGLE_CLIENT_ID')) {
    const currentValue = line.split('=')[1]?.trim().replace(/['"]/g, '');
    if (currentValue === 'your-google-client-id.apps.googleusercontent.com') {
      console.log('🚨 GOOGLE_CLIENT_ID: Still using placeholder - NEEDS REAL VALUE');
    } else {
      console.log('✅ GOOGLE_CLIENT_ID: Configured');
    }
  }
  if (line.includes('GOOGLE_CLIENT_SECRET')) {
    const currentValue = line.split('=')[1]?.trim().replace(/['"]/g, '');
    if (currentValue === 'your-google-client-secret') {
      console.log('🚨 GOOGLE_CLIENT_SECRET: Still using placeholder - NEEDS REAL VALUE');
    } else {
      console.log('✅ GOOGLE_CLIENT_SECRET: Configured');
    }
  }
});

console.log('\n📋 UPDATE INSTRUCTIONS:');
console.log('==================================');
console.log('1. Get credentials from: https://console.cloud.google.com/');
console.log('2. Create OAuth 2.0 client ID for "Web application"');
console.log('3. Add redirect URI: https://quill-ai-xi.vercel.app/api/auth/callback/google');
console.log('4. Copy Client ID and Client Secret');

console.log('\n🎯 READY TO UPDATE?');
console.log('==================================');
console.log('Please paste your actual Google credentials below:');

process.stdin.setEncoding('utf8');

console.log('\nEnter your Google Client ID:');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let clientInput = '';
let secretInput = '';

rl.question('Google Client ID: ', (clientId) => {
  clientInput = clientId.trim();
  
  rl.question('Google Client Secret: ', (clientSecret) => {
    secretInput = clientSecret.trim();
    
    rl.question('Update .env.local file? (y/N): ', (confirm) => {
      if (confirm.toLowerCase() === 'y') {
        // Update the file
        const updatedLines = lines.map(line => {
          if (line.includes('GOOGLE_CLIENT_ID')) {
            return `GOOGLE_CLIENT_ID=${clientInput}`;
          } else if (line.includes('GOOGLE_CLIENT_SECRET')) {
            return `GOOGLE_CLIENT_SECRET=${clientSecret}`;
          }
          return line;
        });
        
        const updatedContent = updatedLines.join('\n');
        fs.writeFileSync(envPath, updatedContent);
        
        console.log('\n✅ Environment file updated successfully!');
        console.log('🚀 Next steps:');
        console.log('1. Deploy to Vercel: npx vercel --prod');
        console.log('2. Test at: https://quill-ai-xi.vercel.app/login');
      } else {
        console.log('\n❌ Update cancelled. You can manually update .env.local');
      }
      
      rl.close();
    });
  });
});
