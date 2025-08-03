#!/usr/bin/env bash
# Wrapper script to clear extended attributes before executing

# Clear extended attributes from the original script
SCRIPT_PATH="/Users/harrisonjones/doublecloned/invoice-ai/ios/Pods/Target Support Files/Pods-SuperInvoice/expo-configure-project.sh"
xattr -c "$SCRIPT_PATH" 2>/dev/null

# Execute the original script
exec "$SCRIPT_PATH" "$@"