#!/bin/bash

echo "🔍 Checking EAS Build Status..."
echo ""

# Check build status
eas build:list --limit 5

echo ""
echo "📱 Build URLs:"
echo "Android: https://expo.dev/accounts/indianabones/projects/meetings/builds/a87b3620-e445-4a02-8bfe-ef3931231afe"
echo "iOS: https://expo.dev/accounts/indianabones/projects/meetings/builds/c5d95f20-d2e2-4abe-bea3-f851a705ebec"
echo ""
echo "⏳ Builds typically take 15-30 minutes to complete."
echo ""
echo "Once builds are complete:"
echo "1. Download and install the new development build on your device"
echo "2. The native module errors (RNSkiaModule, ExpoSharing, etc.) will be resolved"
echo "3. All routes including AI will work properly"