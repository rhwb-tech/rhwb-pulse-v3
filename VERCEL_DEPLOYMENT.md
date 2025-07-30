# Vercel Deployment Instructions

## Supabase Magic Link Authentication

This update replaces JWT authentication with Supabase magic link authentication for a more secure and user-friendly experience.

## 🚀 Automatic Setup

The authentication now uses Supabase magic links, which provides:

- ✅ **No passwords required** - Users sign in with email only
- ✅ **Secure magic links** - Time-limited, single-use authentication
- ✅ **Automatic session management** - Handled by Supabase
- ✅ **Email-based role determination** - Based on email address patterns

## Environment Variables for Vercel

Set these environment variables in your Vercel dashboard:

### Required Variables
```
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional Variables
```
REACT_APP_AUTH_REDIRECT_URL=https://your-domain.vercel.app/auth/callback
```

## Supabase Configuration

### 1. Project Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings → API

### 2. Authentication Settings
1. Go to Authentication → Providers
2. Enable Email provider
3. Disable "Enable email confirmations" (for magic links)

### 3. Redirect URLs
Add these URLs in Authentication → URL Configuration:
- **Site URL**: `https://your-domain.vercel.app`
- **Redirect URLs**: 
  - `https://your-domain.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for development)

## User Role Management

The app determines user roles based on email addresses:

- **Admin**: Email contains "admin" or "manager"
- **Coach**: Email contains "coach" or "trainer"  
- **Hybrid**: Email contains "hybrid"
- **Athlete**: Default role for all other emails

You can customize this logic in `src/contexts/AuthContext.tsx`.

## Testing Your Deployment

1. **Deploy to Vercel** with the environment variables set
2. **Visit your app**: `https://your-domain.vercel.app`
3. **Enter an email address** to receive a magic link
4. **Check your email** and click the magic link
5. **Verify authentication** works correctly

## Migration from JWT

If you're migrating from the previous JWT system:

1. **Remove old environment variables**:
   - `REACT_APP_JWT_SECRET`
   - `REACT_APP_TOKEN_STORAGE_KEY`
   - `REACT_APP_TOKEN_EXPIRY_BUFFER`
   - `REACT_APP_SKIP_SIGNATURE_VERIFICATION`

2. **Add new Supabase variables** (see above)

3. **Update your database** to work with Supabase (if not already using it)

## Security Benefits

- **No client-side JWT handling** - More secure
- **Automatic session management** - No manual token expiration
- **Rate limiting** - Built into Supabase
- **Email verification** - Can be enabled if needed
- **Secure redirects** - Only allowed URLs work

## Troubleshooting

### Common Issues

1. **Magic link not working**:
   - Check redirect URLs in Supabase dashboard
   - Verify environment variables are set correctly

2. **User role not determined**:
   - Check the `determineUserRole` function in AuthContext
   - Verify email patterns match your requirements

3. **Database access issues**:
   - Ensure RLS policies are configured correctly
   - Check that Supabase client is properly initialized

### Debug Mode

Add `?debug=true` to the URL to see detailed authentication information in the browser console.

## Support

For issues with:
- **Supabase setup**: Check the [Supabase documentation](https://supabase.com/docs)
- **Vercel deployment**: Check the [Vercel documentation](https://vercel.com/docs)
- **App-specific issues**: Check the browser console for error messages