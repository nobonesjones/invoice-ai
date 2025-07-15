# Domain Integration Options for Invoice Sharing

## Overview
You have an existing website at `www.getsuperinvoice.com` and want to add invoice sharing functionality without disrupting it. Here are your options:

## Option 1: Subdomain Deployment (Recommended)

Deploy the invoice functionality to a subdomain:

### Setup:
1. **Deploy to subdomain**: `invoices.getsuperinvoice.com` or `share.getsuperinvoice.com`
2. **Update share URLs**: Links become `https://invoices.getsuperinvoice.com/shared/invoice/{token}`
3. **Simple DNS setup**: Just add a CNAME record pointing to Vercel

### Pros:
- ✅ No changes to existing website
- ✅ Clean separation of concerns
- ✅ Easy to manage and deploy
- ✅ Professional appearance

### Implementation:
```typescript
// In services/invoiceShareService.ts
const baseUrl = 'https://invoices.getsuperinvoice.com';
const shareUrl = `${baseUrl}/shared/invoice/${shareToken}`;
```

## Option 2: Path-based Integration

Add invoice functionality as a path on your existing domain:

### Setup:
1. **Deploy separately**: Deploy invoice app to a different Vercel project
2. **Configure rewrites**: In your main website's vercel.json:

```json
{
  "rewrites": [
    {
      "source": "/shared/invoice/:token",
      "destination": "https://your-invoice-app.vercel.app/shared/invoice/:token"
    }
  ]
}
```

### Pros:
- ✅ Uses main domain
- ✅ Seamless user experience
- ✅ No subdomain needed

### Cons:
- ❌ Requires changes to main website config
- ❌ More complex deployment

## Option 3: Iframe Integration

Embed the invoice viewer in your existing site:

### Setup:
1. **Deploy invoice app separately**
2. **Create iframe endpoint** on your main site
3. **Embed invoice viewer**

```html
<!-- On your main website -->
<iframe 
  src="https://your-invoice-app.vercel.app/shared/invoice/TOKEN"
  width="100%" 
  height="800px"
  frameborder="0">
</iframe>
```

## Option 4: API-only Integration

Use your existing website's frontend with the invoice API:

### Setup:
1. **Deploy only the Supabase functions**
2. **Build invoice viewer** in your existing website's tech stack
3. **Use invoice data API** from your existing frontend

## Recommended Approach: Subdomain

For your use case, I recommend **Option 1 (Subdomain)** because:

1. **No disruption**: Your existing website stays exactly the same
2. **Professional**: `invoices.getsuperinvoice.com` looks professional
3. **Simple**: Easy to set up and maintain
4. **Scalable**: Can add more invoice features later

## Implementation Steps for Subdomain:

### 1. Update Share Service
```typescript
// services/invoiceShareService.ts
const baseUrl = 'https://invoices.getsuperinvoice.com';
```

### 2. Deploy to Vercel
```bash
vercel --prod
```

### 3. Configure Custom Domain
In Vercel dashboard:
- Go to your project settings
- Add custom domain: `invoices.getsuperinvoice.com`
- Update DNS with provided CNAME

### 4. Test Links
Links will be: `https://invoices.getsuperinvoice.com/shared/invoice/{token}`

Would you like me to implement the subdomain approach? 