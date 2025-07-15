# Vercel Deployment Guide for Trackable Invoice Links

## Overview
This guide will help you deploy your invoice app to Vercel with working trackable links at `https://www.getsuperinvoice.com/shared/invoice/{token}`.

## Prerequisites
- Vercel account
- Domain `www.getsuperinvoice.com` configured in Vercel
- Expo CLI installed

## Configuration Files

### 1. vercel.json
Already configured with:
- Expo web build settings
- Proper routing for shared invoice links
- Cache headers for optimal performance

### 2. Shared Invoice Web Interface
The app includes a complete web interface at `app/(public)/shared/invoice/[token].tsx` that:
- ✅ Loads invoice data from Supabase edge function
- ✅ Displays the invoice with proper styling
- ✅ Tracks view/download/print events
- ✅ Handles expired/invalid links gracefully
- ✅ Provides download and print functionality

## Deployment Steps

### Step 1: Deploy to Vercel
```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Deploy from your project root
vercel

# Follow the prompts:
# - Link to existing project or create new one
# - Set build command: npx expo export -p web
# - Set output directory: dist
```

### Step 2: Configure Domain
1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to "Domains" section
4. Add `www.getsuperinvoice.com` as a custom domain
5. Configure DNS records as instructed by Vercel

### Step 3: Set Environment Variables
In Vercel dashboard, go to Settings > Environment Variables and add:
```
EXPO_PUBLIC_API_URL=your-supabase-url
EXPO_PUBLIC_API_KEY=your-supabase-anon-key
```

### Step 4: Test the Deployment
1. Generate a share link in your mobile app
2. The link should be: `https://www.getsuperinvoice.com/shared/invoice/{token}`
3. Open the link in a browser - should display the invoice
4. Check analytics in the mobile app - should show tracking events

## How It Works

### Link Generation (Mobile App)
```typescript
// services/invoiceShareService.ts
const baseUrl = 'https://www.getsuperinvoice.com';
const shareUrl = `${baseUrl}/shared/invoice/${shareToken}`;
```

### Web Interface (Vercel)
```
URL: https://www.getsuperinvoice.com/shared/invoice/abc123
↓
Routes to: app/(public)/shared/invoice/[token].tsx
↓
Loads data from: your-supabase-url/functions/v1/shared-invoice/abc123
↓
Displays: Beautiful invoice with tracking
```

### Analytics Tracking
- **View**: Automatically tracked when page loads
- **Download**: Tracked when user downloads PDF
- **Print**: Tracked when user prints invoice
- **Copy Link**: Tracked when user copies the URL

## Troubleshooting

### Links Not Working
1. Check domain is properly configured in Vercel
2. Verify environment variables are set
3. Check Supabase edge function is deployed
4. Test with browser dev tools for errors

### Analytics Not Tracking
1. Check Supabase edge function logs
2. Verify CORS headers in edge function
3. Test API calls in browser network tab

### Styling Issues
1. Ensure all CSS/styling is web-compatible
2. Check for React Native specific components
3. Test responsive design on different screen sizes

## Production Checklist

- [ ] Domain configured and SSL working
- [ ] Environment variables set
- [ ] Test share link generation
- [ ] Test invoice display on web
- [ ] Test download/print functionality
- [ ] Verify analytics tracking
- [ ] Test expired link handling
- [ ] Test mobile app share functionality
- [ ] Test copy link feature

## Monitoring

After deployment, monitor:
- Vercel function logs
- Supabase edge function logs
- Invoice share analytics
- User feedback on shared links

## Next Steps

1. Deploy to Vercel using the steps above
2. Test the complete flow
3. Monitor analytics and performance
4. Consider adding custom branding to the web interface
5. Implement additional tracking if needed

Your trackable invoice links will now work beautifully with professional branding! 🚀 