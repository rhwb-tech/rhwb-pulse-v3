# Wix JWT Integration Guide for RHWB Pulse Dashboard

This guide explains how to integrate the RHWB Pulse Dashboard with Wix using JWT authentication.

## Overview

The RHWB Pulse Dashboard now uses JWT (JSON Web Token) authentication to secure access and identify users. The app expects a JWT token containing user information to be passed either via URL parameter or stored locally.

## JWT Token Requirements

### Required Claims

Your JWT token must include the following claims:

```json
{
  "email": "user@example.com",     // User's email address
  "role": "admin",                 // User's role: "admin", "coach", "hybrid", or "athlete"
  "name": "John Doe",             // Optional: User's display name
  "exp": 1640995200               // Required: Token expiration timestamp (Unix timestamp)
}
```

### Supported Roles

- **`admin`**: Full access to all coaches and their athletes
- **`coach`**: Access to assigned athletes only
- **`hybrid`**: Both coach and athlete functionality
- **`athlete`**: Personal dashboard only

## Wix Implementation Options

### Option 1: Bearer Token via postMessage (Recommended for Production)

Pass the JWT token as a Bearer token via postMessage when embedding the dashboard in an iframe:

```javascript
// In your Wix site code (iframe parent)
import wixSecrets from 'wix-secrets-backend';
import { sign } from 'jsonwebtoken';

export async function embedDashboardWithBearer(userEmail, userRole) {
  // Get your JWT secret from Wix Secrets Manager
  const jwtSecret = await wixSecrets.getSecret('JWT_SECRET');
  
  // Create JWT payload
  const payload = {
    email: userEmail,
    role: userRole,
    name: 'User Name', // Optional
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours expiration
  };
  
  // Sign the token
  const token = sign(payload, jwtSecret, { algorithm: 'HS256' });
  
  // Send Bearer token to dashboard iframe
  const iframe = document.getElementById('dashboard-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'BEARER_TOKEN',
      token: token // Will be automatically prefixed with 'Bearer ' if needed
    }, 'https://your-dashboard-domain.com');
  }
}

// Usage in Wix page code
$w.onReady(function () {
  // Load the dashboard iframe first
  $w("#dashboardFrame").src = "https://your-dashboard-domain.com";
  
  // Send Bearer token after iframe loads
  $w("#dashboardFrame").onLoad(() => {
    setTimeout(async () => {
      const userEmail = $w("#emailInput").value;
      const userRole = $w("#roleDropdown").value;
      await embedDashboardWithBearer(userEmail, userRole);
    }, 1000); // Give iframe time to initialize
  });
});
```

### Option 2: Bearer Token via Custom Storage

Store the Bearer token in a way the dashboard can access:

```javascript
// In your Wix site code
import wixSecrets from 'wix-secrets-backend';
import { sign } from 'jsonwebtoken';

export async function setDashboardBearerToken(userEmail, userRole) {
  const jwtSecret = await wixSecrets.getSecret('JWT_SECRET');
  
  const payload = {
    email: userEmail,
    role: userRole,
    name: 'User Name',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
  };
  
  const token = sign(payload, jwtSecret, { algorithm: 'HS256' });
  
  // Store Bearer token for dashboard to access
  // Option A: Via sessionStorage (if same-origin)
  sessionStorage.setItem('bearer_auth_token', token);
  
  // Option B: Via custom storage mechanism
  localStorage.setItem('wix_bearer_token', `Bearer ${token}`);
  
  // Then redirect to dashboard
  wixLocation.to('https://your-dashboard-domain.com');
}

// Usage
$w.onReady(function () {
  $w("#launchDashboard").onClick(async () => {
    const userEmail = $w("#userEmail").value;
    const userRole = $w("#userRole").value;
    await setDashboardBearerToken(userEmail, userRole);
  });
});
```

### Option 3: URL Parameter (Fallback for Direct Links)

Pass the JWT token as a URL parameter when redirecting to the dashboard:

```javascript
// In your Wix site code
import wixSecrets from 'wix-secrets-backend';
import { sign } from 'jsonwebtoken';

export async function generateDashboardUrl(userEmail, userRole) {
  // Get your JWT secret from Wix Secrets Manager
  const jwtSecret = await wixSecrets.getSecret('JWT_SECRET');
  
  // Create JWT payload
  const payload = {
    email: userEmail,
    role: userRole,
    name: 'User Name', // Optional
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours expiration
  };
  
  // Sign the token
  const token = sign(payload, jwtSecret, { algorithm: 'HS256' });
  
  // Your dashboard URL with token
  const dashboardUrl = `https://your-dashboard-domain.com?token=${token}`;
  
  return dashboardUrl;
}

// Usage in Wix page code
$w.onReady(function () {
  $w("#dashboardButton").onClick(async () => {
    const userEmail = $w("#emailInput").value;
    const userRole = $w("#roleDropdown").value;
    
    const dashboardUrl = await generateDashboardUrl(userEmail, userRole);
    
    // Open dashboard in new tab
    wixLocation.to(dashboardUrl, "_blank");
  });
});
```

### Option 4: Wix Velo Backend Integration

Create a backend function to generate tokens:

```javascript
// backend/dashboard.js
import { sign } from 'jsonwebtoken';
import wixSecrets from 'wix-secrets-backend';

export async function generateToken(userEmail, userRole, userName = null) {
  try {
    const jwtSecret = await wixSecrets.getSecret('JWT_SECRET');
    
    const payload = {
      email: userEmail,
      role: userRole,
      name: userName,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      iat: Math.floor(Date.now() / 1000) // issued at
    };
    
    const token = sign(payload, jwtSecret, { algorithm: 'HS256' });
    
    return { success: true, token };
  } catch (error) {
    console.error('Token generation failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getDashboardUrl(userEmail, userRole, userName = null) {
  const result = await generateToken(userEmail, userRole, userName);
  
  if (result.success) {
    return {
      success: true,
      url: `https://your-dashboard-domain.com?token=${result.token}`
    };
  }
  
  return result;
}
```

Frontend usage:

```javascript
// page code
import { getDashboardUrl } from 'backend/dashboard';

$w.onReady(function () {
  $w("#launchDashboard").onClick(async () => {
    // Get user data from current session or form
    const userEmail = $w("#userEmail").value;
    const userRole = $w("#userRole").value;
    const userName = $w("#userName").value;
    
    try {
      const result = await getDashboardUrl(userEmail, userRole, userName);
      
      if (result.success) {
        // Open dashboard
        wixLocation.to(result.url, "_blank");
      } else {
        $w("#errorMessage").text = "Failed to generate dashboard access";
        $w("#errorMessage").show();
      }
    } catch (error) {
      console.error("Dashboard launch failed:", error);
    }
  });
});
```

### Option 5: Wix Members Integration

Integrate with Wix Members for automatic user detection:

```javascript
// backend/membersDashboard.js
import { sign } from 'jsonwebtoken';
import wixSecrets from 'wix-secrets-backend';
import wixUsers from 'wix-users-backend';

export async function getMemberDashboardUrl() {
  try {
    // Get current member
    const currentMember = await wixUsers.getCurrentUser();
    
    if (!currentMember) {
      return { success: false, error: "No logged in member" };
    }
    
    // You'll need to determine the user's role based on your business logic
    // This could be from member fields, groups, or database lookup
    const userRole = await determineUserRole(currentMember.id);
    
    const jwtSecret = await wixSecrets.getSecret('JWT_SECRET');
    
    const payload = {
      email: currentMember.loginEmail,
      role: userRole,
      name: `${currentMember.firstName} ${currentMember.lastName}`,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 8), // 8 hours for members
    };
    
    const token = sign(payload, jwtSecret, { algorithm: 'HS256' });
    
    return {
      success: true,
      url: `https://your-dashboard-domain.com?token=${token}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function determineUserRole(memberId) {
  // Implement your role determination logic here
  // Examples:
  // - Check member groups
  // - Query your database
  // - Check member custom fields
  
  // Example with member groups:
  const memberGroups = await wixUsers.getMemberGroups(memberId);
  
  if (memberGroups.includes('admin-group-id')) return 'admin';
  if (memberGroups.includes('coach-group-id')) return 'coach';
  if (memberGroups.includes('hybrid-group-id')) return 'hybrid';
  
  return 'athlete'; // default
}
```

## Security Setup

### 1. JWT Secret Configuration

1. Go to your Wix Dashboard
2. Navigate to Settings → Secrets Manager
3. Add a new secret called `JWT_SECRET`
4. Generate a strong secret key (32+ characters recommended)

```bash
# Example secret generation (use this in Secrets Manager)
openssl rand -base64 32
```

### 2. Environment Variables (for Dashboard App)

The dashboard app uses environment variables for configuration. Set these in your deployment environment:

```bash
# JWT Configuration
REACT_APP_JWT_SECRET=your-same-secret-from-wix
REACT_APP_TOKEN_STORAGE_KEY=rhwb_pulse_auth_token
REACT_APP_TOKEN_EXPIRY_BUFFER=300

# Bearer Token Configuration (Optional)
REACT_APP_WIX_ORIGIN=https://your-wix-site.com

# Optional: Supabase Configuration
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Token Priority Order

The dashboard checks for JWT tokens in the following priority order:

1. **Bearer Token** (via postMessage or custom storage) - `getBearerToken()`
2. **URL Parameter** - `?token=JWT_TOKEN`
3. **Local Storage** - Previously stored token

This allows for flexible integration patterns where Bearer tokens take precedence over URL parameters.

## Example JWT Payloads

### Admin User
```json
{
  "email": "admin@company.com",
  "role": "admin",
  "name": "Admin User",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Coach User
```json
{
  "email": "coach@company.com",
  "role": "coach",
  "name": "John Coach",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Hybrid User
```json
{
  "email": "hybrid@company.com",
  "role": "hybrid",
  "name": "Jane Hybrid",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Athlete User
```json
{
  "email": "athlete@company.com",
  "role": "athlete",
  "name": "Mike Athlete",
  "exp": 1640995200,
  "iat": 1640908800
}
```

## Testing the Integration

### 1. Manual Testing

You can test the integration by manually creating a JWT token:

```javascript
// Use this in a Node.js environment or online JWT generator
const jwt = require('jsonwebtoken');

const payload = {
  email: "test@example.com",
  role: "admin",
  name: "Test User",
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
};

const token = jwt.sign(payload, 'your-secret-key');
console.log(token);
```

Then visit: `https://your-dashboard.com?token=GENERATED_TOKEN`

### 2. Token Validation

The dashboard will automatically:
- Parse the JWT token
- Validate the signature
- Check expiration
- Extract user information
- Set up the appropriate dashboard view

## Error Handling

The dashboard handles these error cases:

- **Invalid token format**: Shows authentication error
- **Expired token**: Automatically logs out user
- **Missing required claims**: Shows error message
- **Invalid role**: Defaults to 'athlete' role

## Vercel Deployment Setup

### 1. Environment Variables in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
REACT_APP_JWT_SECRET=your-production-secret-key
REACT_APP_TOKEN_STORAGE_KEY=rhwb_pulse_auth_token
REACT_APP_TOKEN_EXPIRY_BUFFER=300
```

### 2. Different Environments

Set different secrets for each environment:

```bash
# Production
REACT_APP_JWT_SECRET=super-secure-production-secret-here

# Preview/Staging
REACT_APP_JWT_SECRET=staging-secret-key-here

# Development (local .env.local)
REACT_APP_JWT_SECRET=dev-secret-key-here
```

### 3. Vercel CLI Deployment

You can also set environment variables via Vercel CLI:

```bash
# Set production environment variable
vercel env add REACT_APP_JWT_SECRET production

# Set preview environment variable
vercel env add REACT_APP_JWT_SECRET preview
```

## Security Best Practices

1. **Short Token Expiration**: Use 8-24 hour expiration times
2. **Secure Secret Storage**: Store JWT secret in Wix Secrets Manager
3. **HTTPS Only**: Always use HTTPS for token transmission
4. **Token Rotation**: Consider implementing refresh tokens for long sessions
5. **Role Validation**: Always validate roles on both frontend and backend
6. **Environment Separation**: Use different secrets for development/staging/production

## Troubleshooting

### Common Issues

1. **"Authentication Required" error**
   - Check token format and expiration
   - Verify JWT secret matches between Wix and dashboard

2. **Token expired quickly**
   - Check system clock synchronization
   - Verify expiration time calculation

3. **Role not recognized**
   - Ensure role is one of: admin, coach, hybrid, athlete
   - Check for typos in role assignment

### Debug Mode

In development, the dashboard shows a debug panel with:
- Current user email and role
- Token expiration time
- Logout button

This helps verify the JWT integration is working correctly.