#!/bin/bash

echo "Starting local iOS build..."

# Try to build directly with Xcode
if command -v xcodebuild &> /dev/null; then
    echo "Building with Xcode..."
    cd ios
    xcodebuild -workspace SuperInvoice.xcworkspace -scheme SuperInvoice -configuration Debug -sdk iphonesimulator -arch x86_64 build
    cd ..
else
    echo "Xcode not found. Please run one of these commands manually:"
    echo ""
    echo "1. For simulator:"
    echo "   npx expo run:ios"
    echo "   (then select iOS Simulator from the list)"
    echo ""
    echo "2. For device build:"
    echo "   eas build --profile development --platform ios --local"
    echo "   (requires Apple Developer credentials)"
    echo ""
    echo "3. Using Expo Go (if no native changes):"
    echo "   npx expo start"
    echo "   (then scan QR code with Expo Go app)"
fi