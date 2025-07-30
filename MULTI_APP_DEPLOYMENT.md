# Multi-App Deployment Guide

This guide explains how to deploy multiple Vercel apps using the same Supabase authentication project.

## 🚀 Overview

You can use one Supabase project for multiple Vercel apps. Each app will have its own domain and configuration while sharing the same authentication system.

## 📋 Setup Steps

### 1. **Single Supabase Project**

Use one Supabase project for all your apps:

```env
# All apps use the same environment variables
REACT_APP_SUPABASE_URL=https://your-supabase-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. **Supabase Configuration**

In your Supabase dashboard (Authentication → URL Configuration):

**Site URL**: `https://your-main-app.vercel.app`

**Redirect URLs** (add all your app domains):
```
https://pulse.vercel.app/auth/callback
https://coach.vercel.app/auth/callback
https://admin.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

### 3. **App-Specific Configuration**

Each app can be configured using environment variables:

#### For Pulse Dashboard:
```env
REACT_APP_APP_NAME=pulse
```

#### For Coach Portal:
```env
REACT_APP_APP_NAME=coach
```

#### For Admin Portal:
```env
REACT_APP_APP_NAME=admin
```

### 4. **Vercel Deployment**

#### Option A: Multiple Repositories
1. Create separate repositories for each app
2. Deploy each to Vercel with different domains
3. Set the appropriate `REACT_APP_APP_NAME` environment variable

#### Option B: Single Repository, Multiple Deployments
1. Use one repository with different branches
2. Deploy each branch to different Vercel projects
3. Set different environment variables for each deployment

## 🎯 App Configurations

### Pulse Dashboard
- **Domain**: `pulse.vercel.app`
- **Title**: "RHWB Pulse Dashboard"
- **Email Subject**: "Sign in to RHWB Pulse Dashboard"
- **Support**: "Unable to login to Pulse"

### Coach Portal
- **Domain**: `coach.vercel.app`
- **Title**: "RHWB Coach Portal"
- **Email Subject**: "Sign in to RHWB Coach Portal"
- **Support**: "Unable to login to Coach Portal"

### Admin Portal
- **Domain**: `admin.vercel.app`
- **Title**: "RHWB Admin Portal"
- **Email Subject**: "Sign in to RHWB Admin Portal"
- **Support**: "Unable to login to Admin Portal"

## 🔧 Environment Variables

### Required for All Apps:
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional (for app-specific configuration):
```env
REACT_APP_APP_NAME=pulse|coach|admin
```

## 📱 User Experience

### Shared Features:
- Same authentication flow
- Same user database (`v_pulse_roles`)
- Same magic link emails
- Same support contact

### App-Specific Features:
- Different app names and titles
- Different email subjects
- Different support subjects
- Different domains

## 🛠️ Customization

### Adding New Apps:

1. **Update `appConfig.ts`**:
```typescript
'new-app': {
  appName: 'RHWB New App',
  appDomain: 'new-app.vercel.app',
  dashboardTitle: 'New App Dashboard',
  emailSubject: 'Sign in to RHWB New App',
  supportEmail: 'techteamrhwb@gmail.com',
  supportSubject: 'Unable to login to New App'
}
```

2. **Add to Supabase redirect URLs**:
```
https://new-app.vercel.app/auth/callback
```

3. **Deploy with environment variable**:
```env
REACT_APP_APP_NAME=new-app
```

## 🔒 Security Considerations

- All apps share the same user database
- Users can access any app they're authorized for
- Role-based access control applies across all apps
- Magic links work for any app domain

## 📊 Monitoring

- Check Supabase Authentication logs for all apps
- Monitor user access patterns across apps
- Track magic link success rates per domain

## 🚨 Troubleshooting

### Common Issues:

1. **Magic link redirects to wrong domain**:
   - Check Supabase redirect URLs
   - Verify environment variables

2. **App shows wrong title**:
   - Check `REACT_APP_APP_NAME` environment variable
   - Verify app configuration

3. **Users can't access specific app**:
   - Check user roles in `v_pulse_roles` table
   - Verify app-specific permissions

This setup allows you to maintain one authentication system while providing different experiences for different user types! 