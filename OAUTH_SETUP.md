# Google OAuth Setup Guide

This guide explains how to configure Google OAuth for the Beyond Workz employee app.

## Option A: Reuse Credentials from jobportal-backend

If jobportal-backend already has Google OAuth configured, you can reuse the same credentials:

```bash
# From workspace root
node scripts/sync-google-oauth-from-jobportal.mjs
```

This copies `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from `jobportal-backend/.env` to `beyondworkz-backend/.env`.

**Important:** Add the beyondworkz redirect URI to your Google OAuth client:
- `http://localhost:5001/api/auth/google/callback` (dev)
- `https://api.beyondworkz.com/api/auth/google/callback` (production)

You can have multiple redirect URIs per OAuth client.

## Option B: Create New Google Cloud Project & OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the **OAuth consent screen**:
   - User type: **External** (for public users)
   - App name: **Beyond Workz**
   - Add your support email
   - Add authorized domains (e.g. `beyondworkz.com`, `localhost` for dev)
6. Create **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Name: e.g. "Beyond Workz Employee"
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (dev)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:5001/api/auth/google/callback` (dev)
     - `https://api.yourdomain.com/api/auth/google/callback` (production)
7. Copy the **Client ID** and **Client Secret**

## 2. Configure Environment Variables

Add to your `.env` file:

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
API_BASE_URL=http://localhost:5001
```

For production:

```env
API_BASE_URL=https://api.beyondworkz.com
```

## 3. Flow Summary

- **Login**: User clicks "Continue with Google" → redirects to Google → callback creates/finds user → redirects to app with tokens
- **Register**: User selects White/Blue collar, clicks "Continue with Google" → same flow, new user created with selected `employeeType`
- If OAuth is not configured, the backend returns 503 and the user can fall back to email OTP

## 4. Testing

1. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Start the backend and frontend
3. Click "Continue with Google" on Login or Register
4. Sign in with a Google account
5. You should be redirected to the dashboard or complete-profile wizard
