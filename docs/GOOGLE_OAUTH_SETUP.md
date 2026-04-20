# Google OAuth Integration Setup Guide

**Created:** April 20, 2026 | **Status:** Ready for Configuration

## 🎯 Overview

This guide shows you how to configure Google OAuth integration for Quill AI to enable social sign-in capabilities.

## 🔧 Prerequisites

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → OAuth consent screen**

### 2. Configure OAuth Consent Screen
- **User Type**: External
- **App Name**: Quill AI
- **User Support Email**: your-email@example.com
- **Developer Contact**: your-email@example.com

### 3. Create OAuth Credentials
1. Navigate to **APIs & Services → Credentials**
2. Click **"+ CREATE CREDENTIALS" → OAuth 2.0 Client ID**
3. **Application Type**: Web application
4. **Name**: "Quill AI Web Client"
5. **Authorized redirect URIs**: 
   ```
   https://quill-ai-xi.vercel.app/api/auth/callback/google
   ```

6. Click **"Create"** and copy the **Client ID** and **Client Secret**

## ⚙️ Environment Configuration

### 1. Add to `.env.local`

```bash
# ── Google OAuth Integration ────────────────────────────────────────────────────
# Add these to your .env.local file (replace with actual values)

# Get these from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Keep existing authentication settings
BETTER_AUTH_SECRET=your-existing-secret
BETTER_AUTH_URL=https://quill-ai-xi.vercel.app/
NEXT_PUBLIC_APP_URL=https://quill-ai-xi.vercel.app/
```

### 2. Verify Google API Services
Ensure these APIs are enabled in your Google Cloud Console:
- ✅ **Google API services**
- ✅ **People API** (for user profile information)

## 🚀 Testing the Integration

### 1. Development Testing
```bash
npm run dev
```
Visit: `http://localhost:3000/login`

### 2. Live Testing  
Deploy to Vercel and visit: `https://quill-ai-xi.vercel.app/login`

### 3. Test Flow
1. Click "Continue with Google" button
2. Grant permissions
3. Should be redirected back to your app
4. User session should be created

## 🎨 UI Components Created

### Google Sign-In Button
```tsx
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

<GoogleSignInButton redirectPath="/agent" />
```

### User Profile Component
```tsx
import { UserProfile } from '@/components/auth/UserProfile';

<UserProfile />
```

## 🔐 Security Considerations

### 1. Redirect URI Validation
- Only allow verified redirect URIs in Google Cloud Console
- Ensure all URLs use HTTPS in production

### 2. Data Privacy
- Google provides user profile data (name, email, image)
- Store only necessary user data

### 3. Session Management
- Uses Better Auth for secure session handling
- Automatic sign-out functionality included

## 🔍 Troubleshooting

### Common Issues

#### 1. "Access Denied" Error
- Verify redirect URI matches exactly
- Ensure Google API is enabled
- Check client ID/secret are correct

#### 2. Invalid Client Error
- Verify client ID format
- Ensure the right Google Cloud Project is selected

#### 3. Redirect Loop
- Check redirect URI in Google Console
- Verify Better Auth configuration

#### 4. Session Not Created
- Check Better Auth database adapter
- Verify database connection
- Check server logs for errors

### Debug Steps
1. Check browser console for errors
2. View Vercel deployment logs
3. Test with Google OAuth playground
4. Verify environment variables are loaded

## 📊 User Experience

### Sign-In Flow
1. User visits login page
2. Clicks "Continue with Google"
3. Redirects to Google OAuth
4. Grants permissions
5. Redirects back to app with user data
6. Session automatically created

### User Profile Features
- Display user avatar, name, and email
- Edit profile name functionality
- Sign out option
- Responsive design

## 🔄 Migration from Email-Only

No migration required - Better Auth automatically handles:
- Existing users continue to work
- Optional social sign-in alongside email auth
- Seamless integration with existing entitlements system

## 🚀 Next Steps

1. **Configure Google Cloud Console** ✅
2. **Add environment variables** ⚠️ (pending)
3. **Test the flow** ⚠️ (pending)  
4. **Monitor user analytics** 📊 (future)

## 📞 Support

- **GitHub Issues**: Report bugs or request features
- **Google Cloud Docs**: [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- **Better Auth Docs**: [Social Providers Guide](https://better-auth.com/docs/social-auth)
