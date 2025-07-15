# Domain Configuration for Trackable Invoice Links

## Overview
The invoice sharing system generates trackable links using `https://www.getsuperinvoice.com/shared/invoice/{token}`. To make these links work, the domain needs to be configured to route these requests to the Supabase edge function.

## Current Setup
- **Share URLs**: `https://www.getsuperinvoice.com/shared/invoice/{token}`
- **Edge Function**: `https://your-project.supabase.co/functions/v1/shared-invoice/{token}`
- **Status**: ❌ Domain routing not configured

## Configuration Options

### Option 1: Cloudflare Workers (Recommended)

If you're using Cloudflare for DNS, create a Worker to handle the routing:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if this is a shared invoice request
    if (url.pathname.startsWith('/shared/invoice/')) {
      const token = url.pathname.split('/').pop();
      
      // Construct Supabase edge function URL
      const supabaseUrl = `https://your-project.supabase.co/functions/v1/shared-invoice/${token}`;
      
      // Forward the request to Supabase
      const response = await fetch(supabaseUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      return response;
    }
    
    // For all other requests, serve your main website
    return fetch(request);
  }
}
```

### Option 2: Nginx Reverse Proxy

If you're using Nginx, add this location block:

```nginx
location /shared/invoice/ {
    rewrite ^/shared/invoice/(.*)$ /functions/v1/shared-invoice/$1 break;
    proxy_pass https://your-project.supabase.co;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Option 3: Vercel Redirects

If using Vercel, add to `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/shared/invoice/:token",
      "destination": "https://your-project.supabase.co/functions/v1/shared-invoice/:token"
    }
  ]
}
```

### Option 4: Next.js API Route

If using Next.js, create `pages/api/shared/invoice/[token].js`:

```javascript
export default async function handler(req, res) {
  const { token } = req.query;
  
  const supabaseUrl = `https://your-project.supabase.co/functions/v1/shared-invoice/${token}`;
  
  const response = await fetch(supabaseUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...req.headers
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });
  
  const data = await response.json();
  res.status(response.status).json(data);
}
```

## Testing the Configuration

1. Generate a share link in the app
2. Copy the link (should be `https://www.getsuperinvoice.com/shared/invoice/{token}`)
3. Open the link in a browser
4. Should display the invoice and track the view

## Temporary Solution

While setting up domain configuration, you can test with direct Supabase URLs by temporarily updating the share service:

```typescript
// In services/invoiceShareService.ts, line 89
const baseUrl = 'https://your-project.supabase.co/functions/v1/shared-invoice';
const shareUrl = `${baseUrl}/${shareToken}`;
```

## Security Considerations

- Ensure CORS headers are properly configured
- Validate all incoming requests
- Implement rate limiting if needed
- Monitor for abuse of shared links

## Next Steps

1. Choose your preferred configuration method
2. Update your domain/hosting configuration
3. Test the shared links
4. Monitor analytics and tracking 