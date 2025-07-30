# Supabase Authentication Setup Guide

This guide explains how to set up Supabase authentication for the RHWB Pulse Dashboard.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new account
2. Create a new project
3. Note down your project URL and anon key from the API settings

## 2. Configure Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Configure Supabase Authentication

### Enable Email Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure the following settings:
   - **Enable email confirmations**: OFF (for magic links)
   - **Enable email change confirmations**: OFF
   - **Secure email change**: OFF

### Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize the **Magic Link** template:
   - Subject: "Sign in to RHWB Pulse Dashboard"
   - Content: "Click the link below to sign in to your dashboard"

### Set Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your redirect URLs:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: 
     - `http://localhost:3000/auth/callback` (for development)
     - `https://your-domain.com/auth/callback` (for production)

## 4. User Role Management

The application determines user roles based on email addresses. You can customize the role logic in `src/contexts/AuthContext.tsx`:

```typescript
const determineUserRole = (email: string, userMetadata?: any): UserRole => {
  if (email.includes('admin') || email.includes('manager')) {
    return 'admin';
  } else if (email.includes('coach') || email.includes('trainer')) {
    return 'coach';
  } else if (email.includes('hybrid')) {
    return 'hybrid';
  } else {
    return 'athlete';
  }
};
```

## 5. Database Setup

Ensure your Supabase database has the necessary tables and RLS policies:

### Required Tables
- `rhwb_meso_scores`
- `rhwb_coaches`
- `runners_profile`
- `runner_season_info`
- `v_quantitative_scores`
- `v_activity_summary`
- `pulse_interactions`

### Row Level Security (RLS)

Enable RLS on your tables and create policies that allow users to access data based on their role and email.

## 6. Testing the Authentication

1. Start the development server: `npm start`
2. Navigate to `http://localhost:3000`
3. Enter your email address
4. Check your email for the magic link
5. Click the link to sign in

## 7. Production Deployment

For production deployment:

1. Update the redirect URLs in Supabase to use your production domain
2. Set the environment variables in your hosting platform (Vercel, Netlify, etc.)
3. Ensure your domain is added to the allowed redirect URLs in Supabase

## Troubleshooting

### Common Issues

1. **Magic link not working**: Check that the redirect URL is correctly configured in Supabase
2. **User role not determined**: Check the `determineUserRole` function in AuthContext
3. **Database access denied**: Ensure RLS policies are correctly configured

### Debug Mode

You can enable debug mode by adding `?debug=true` to the URL to see detailed information about the authentication process.

## Security Considerations

1. **Email Verification**: Consider enabling email verification for production
2. **Rate Limiting**: Supabase provides built-in rate limiting for authentication
3. **Session Management**: Sessions are automatically managed by Supabase
4. **Logout**: Users can sign out using the logout button in the header 