export const colors = {
  light: {
    background: "#F5F5F5", // Changed to off-white for modal background and global app background
    foreground: "hsl(240, 10%, 3.9%)",
    card: "hsl(0, 0%, 100%)", // Stays white for input groups
    cardForeground: "hsl(240, 10%, 3.9%)",
    popover: "hsl(0, 0%, 100%)",
    popoverForeground: "hsl(240, 10%, 3.9%)",
    primary: "#25D366", // WhatsApp Green
    primaryForeground: "#FFFFFF", // White text on WhatsApp Green
    primaryTransparent: "#25D36633", // Added
    secondary: "hsl(240, 4.8%, 95.9%)",
    secondaryForeground: "hsl(240, 5.9%, 10%)",
    muted: "hsl(240, 4.8%, 95.9%)",
    mutedForeground: "hsl(240, 3.8%, 46.1%)",
    accent: "hsl(240, 4.8%, 95.9%)",
    accentForeground: "hsl(240, 5.9%, 10%)",
    iconAccent: "#4A4A4A", // Dark Gray for icons/accents
    destructive: "#FF7979", // New HEX value: light, somewhat desaturated red
    destructiveForeground: "hsl(0, 0%, 98%)", // Note: This is very light, might need adjustment if used directly for text on light red
    border: "hsl(240, 5.9%, 90%)",
    input: "hsl(240, 5.9%, 90%)",
    ring: "hsl(240, 5.9%, 10%)",
    statusPaid: "#2ECC71",
    statusDue: "#E74C3C",
    statusDraft: "#F39C12",
    gold: "#FFC107", // Added for Upgrade button
    goldContrastText: "#FFFFFF", // Changed to white for Upgrade button text/icon
    // Toggle-specific colors for light mode (maintaining current behavior)
    toggleThumbOff: "hsl(0, 0%, 100%)", // White thumb when toggle is OFF
    toggleThumbOn: "#25D366", // Green thumb when toggle is ON
    toggleTrackOff: "hsl(240, 4.8%, 95.9%)", // Light gray track when OFF
    toggleTrackOn: "#25D36633", // Green transparent track when ON
  },
  dark: {
    background: "#000000", // True black background
    foreground: "hsl(0, 0%, 98%)",
    card: "#1C1C1E", // Dark gray for cards
    cardForeground: "hsl(0, 0%, 98%)",
    popover: "#1C1C1E", // Dark gray for popovers
    popoverForeground: "hsl(0, 0%, 98%)",
    primary: "#25D366", // Changed to green for toggles ON state
    primaryForeground: "#FFFFFF", // White text on green
    primaryTransparent: "#25D36633", // Green transparent for toggle tracks ON
    secondary: "#1C1C1E", // Dark gray for secondary elements (tab bar, buttons)
    secondaryForeground: "hsl(0, 0%, 98%)",
    muted: "#FFFFFF33", // White transparent for toggle tracks OFF
    mutedForeground: "hsl(240, 5%, 64.9%)",
    accent: "#1C1C1E", // Dark gray for accent elements
    accentForeground: "hsl(0, 0%, 98%)",
    iconAccent: "#A0A0A0", // Lighter Gray for icons/accents in dark mode
    destructive: "#E57373", // New HEX value: moderately desaturated red for dark theme
    destructiveForeground: "hsl(0, 0%, 98%)",
    border: "#1C1C1E", // Dark gray for borders
    input: "#1C1C1E", // Dark gray for input backgrounds
    ring: "hsl(240, 4.9%, 83.9%)",
    statusPaid: "#2ECC71",
    statusDue: "#E74C3C",
    statusDraft: "#F39C12",
    gold: "#FFC107", // Added for Upgrade button
    goldContrastText: "#FFFFFF", // Changed to white for Upgrade button text/icon
    // Toggle-specific colors for dark mode
    toggleThumbOff: "#FFFFFF", // White thumb when toggle is OFF
    toggleThumbOn: "#25D366", // Green thumb when toggle is ON
    toggleTrackOff: "#FFFFFF33", // White transparent track when OFF
    toggleTrackOn: "#25D36633", // Green transparent track when ON
  },
};
