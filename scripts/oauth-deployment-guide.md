# Google OAuth Deployment & Testing Guide

## 🚀 DEPLOYMENT CHECKLIST

### **BEFORE DEPLOYMENT**

#### 1. ✅ Google OAuth Credentials (MUST COMPLETE)
- [ ] Go to https://console.cloud.google.com/
- [ ] Create OAuth 2.0 client ID for Web Application
- [ ] Add redirect URI: `https://quill-ai-xi.vercel.app/api/auth/callback/google`
- [ ] Replace placeholder values in `.env.local`:
  ```bash
  # Replace these in .env.local:
  GOOGLE_CLIENT_ID=your-real-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-real-client-secret
  ```

#### 2. ✅ Environment Configuration
- [ ] Verify `.env.local` has correct values:
  ```
  BETTER_AUTH_URL=https://quill-ai-xi.vercel.app/
  NEXT_PUBLIC_APP_URL=https://quill-ai-xi.vercel.app/
  GOOGLE_CLIENT_ID=your-real-client-id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-real-client-secret
  ```

### **DEPLOYMENT STEPS**

#### **Step 1: Deploy to Vercel**
```bash
cd "C:\Users\omero\GitHub\repos\quil-ai\quill-ai"
npx vercel --prod
```

#### **Step 2: Verify Deployment**
- Visit: https://quill-ai-xi.vercel.app/
- Ensure all pages load correctly

#### **Step 3: Test Google OAuth**
1. Go to: https://quill-ai-xi.vercel.app/login
2. Click "Continue with Google" button
3. Should redirect to Google authentication
4. After Google login, should return to Quill AI with user session

---

## 🔍 TESTING SCRIPTS

### **Test 1: Environment Check**
```bash
node scripts/debug-env-file.js
```
- Should show ✅ for Google credentials (not placeholders)

### **Test 2: OAuth Flow Test**  
```bash
node scripts/test-google-oauth.js
```
- Should show "Ready for Testing!" message

### **Test 3: Enhanced OAuth Test**
```bash
node scripts/debug-google-oauth.js
```
- Should show credential status and URL configuration

---

## 🚨 TROUBLESHOOTING

### **Issue: Google Credentials Not Accepted**
**Solution:** 
1. Verify Client ID and Secret are copied correctly from Google Console
2. Ensure no extra spaces or quotes in `.env.local`
3. Check that redirect URI exactly matches in Google Console

### **Issue: Redirect URI Mismatch**
**Solution:**
1. Google Console requires exact match
2. Use this exact URI: `https://quill-ai-xi.vercel.app/api/auth/callback/google`
3. No trailing slashes or extra parameters

### **Issue: 404 Error on Callback**
**Solution:**
1. Ensure deployment is complete and live
2. Check that Better Auth middleware is configured
3. Verify environment variables are loaded correctly

### **Issue: Still Not Working**
**Solution:**
1. Check browser console for JavaScript errors
2. Check Vercel build logs for any issues
3. Check Google Cloud Console logs for OAuth errors

---

## 🎯 DEPLOYMENT VERIFICATION

### **After Successful Deployment:**
1. ✅ Main app loads: https://quill-ai-xi.vercel.app/
2. ✅ Login page loads: https://quill-ai-xi.vercel.app/login  
3. ✅ Google button is visible
4. ✅ Clicking Google button triggers OAuth flow
5. ✅ After Google login, user is authenticated in Quill AI

### **Expected OAuth Flow:**
1. User clicks "Continue with Google"
2. Redirects to Google authentication
3. User signs in with Google account
4. Google redirects back to `/api/auth/callback/google`
5. Better Auth creates user session
6. User is redirected back to the app with authentication

---

## 📊 MONITORING

### **Check Authentication Status:**
- Browser DevTools → Network tab → Look for API calls
- Check Vercel logs for Better Auth requests
- Monitor Google Cloud Console for OAuth activity

### **Verify User Creation:**
After successful OAuth, user should appear in your database:
- Check the `users` table in your database
- Check the `accounts` table for Google account linkage
- Verify session creation in database

---

## 🎉 SUCCESS CHECKLIST

✅ **All tests pass**  
✅ **Users can sign in with Google**  
✅ **No authentication errors**  
✅ **Database properly updated**  
✅ **OAuth tokens stored securely**  

---

## 📞 NEED HELP?

If you encounter issues:
1. Check error messages carefully
2. Review deployment logs
3. Test Google OAuth flow manually
4. Verify all prerequisites are met

**Key requirement:** Google OAuth requires a live domain, so testing with `http://localhost:3000` won't work - must be deployed first.
