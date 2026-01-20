# Supabase Password Reset Setup

## Required Configuration in Supabase Dashboard

To enable password reset functionality, you need to configure the following in your Supabase Dashboard:

### 1. Email Templates

Go to **Authentication** → **Email Templates** → **Reset Password**

The email template should include a link that points to your reset password page. Supabase automatically includes a recovery token in the URL.

**Default template variables:**
- `{{ .ConfirmationURL }}` - The confirmation/reset link with token
- `{{ .Token }}` - The raw token (if needed)
- `{{ .Email }}` - User's email address

### 2. Redirect URLs

Go to **Authentication** → **URL Configuration**

Add your reset password page URL to the **Redirect URLs**:

```
https://yourdomain.com/reset-password
http://localhost:3000/reset-password (for local development)
```

**Important:** Make sure both production and development URLs are added.

### 3. Site URL

Make sure your **Site URL** is set correctly in **Authentication** → **URL Configuration**:

- Production: `https://yourdomain.com`
- Development: `http://localhost:3000`

### 4. Email Settings

Ensure that **Enable Email Confirmations** is enabled (if you want email confirmation).
Ensure that **Enable Email Change Confirmations** is enabled.

### 5. Email Provider

Make sure you have an email provider configured:
- Supabase provides a default email service for development
- For production, you should configure SMTP or use a service like SendGrid, Mailgun, etc.

Go to **Settings** → **Auth** → **SMTP Settings** to configure your email provider.

## How It Works

1. User clicks "Forgot password?" on the login page
2. User enters their email address
3. Supabase sends a password reset email with a link
4. User clicks the link, which redirects to `/reset-password` with a token
5. User enters new password on the reset password page
6. Supabase updates the password and creates a session
7. User is redirected to login page

## Testing

1. Go to `/forgot-password`
2. Enter a registered email address
3. Check the email inbox (or Supabase logs if using default email)
4. Click the reset link
5. Enter a new password
6. Sign in with the new password

## Troubleshooting

### Common Issues

1. **"Access denied OTP expired" or "Email link is invalid or has expired"**
   - **Cause**: The password reset token expires after 1 hour by default
   - **Solution**: 
     - Request a new password reset email
     - Make sure to click the link within 1 hour of receiving it
     - Check that the link hasn't been clicked already (tokens are single-use)

2. **Token not processing**
   - **Cause**: The token might not be getting processed correctly from the URL hash
   - **Solution**: 
     - Make sure you're clicking the link directly from the email (don't copy/paste)
     - Clear browser cache and cookies, then try again
     - Make sure `detectSessionInUrl: true` is set in the Supabase client config

3. **Email not received**
   - **Cause**: Email provider settings or spam filters
   - **Solution**: 
     - Check spam folder
     - Verify email provider settings in Supabase Dashboard
     - For development, check Supabase Auth logs

4. **Redirect not working**
   - **Cause**: Redirect URL not added to allowed URLs
   - **Solution**: 
     - Go to **Authentication** → **URL Configuration**
     - Add `http://localhost:3000/reset-password` (dev) and `https://yourdomain.com/reset-password` (prod)
     - Make sure Site URL is set correctly

5. **"No active session" error**
   - **Cause**: Token expired or already used
   - **Solution**: Request a new password reset email and use it within 1 hour
