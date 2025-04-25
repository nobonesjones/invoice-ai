import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors'; // Ensure colors are imported

// Define the shape of the theme context
interface ThemeContextType {
  theme: typeof colors.light | typeof colors.dark;
  isLightMode: boolean;
  setThemePreference: (preference: 'light' | 'dark' | 'system') => void;
  themePreference: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
}

// Create the context with a default value (provide a basic structure)
const ThemeContext = createContext<ThemeContextType>({
  theme: colors.light, // Default to light theme initially
  isLightMode: true,
  setThemePreference: () => {},
  themePreference: 'system', // Default preference
  toggleTheme: () => {},
});

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// ThemeProvider component props
interface ThemeProviderProps {
  children: ReactNode;
}

// ThemeProvider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  console.log('[ThemeProvider] Rendering...'); // Log on every render
  const systemColorScheme = useColorScheme(); // 'light' or 'dark'
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark' | 'system'>('system');
  const [isLightMode, setIsLightMode] = useState(systemColorScheme === 'light');

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const storedPreference = await AsyncStorage.getItem('themePreference');
        console.log('[ThemeProvider Load] AsyncStorage value:', storedPreference);
        const initialPreference = (storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system') ? storedPreference : 'system';
        setThemePreferenceState(initialPreference);
        console.log('[ThemeProvider Load] Setting initialPreference state:', initialPreference);

        let lightMode;
        if (initialPreference === 'system') {
          lightMode = systemColorScheme === 'light';
        } else {
          lightMode = initialPreference === 'light';
        }
        setIsLightMode(lightMode);
        console.log('[ThemeProvider Load] Setting initial isLightMode state:', lightMode);

      } catch (error) {
        console.error('[ThemeProvider Load] Failed to load theme preference:', error);
      }
    };
    loadThemePreference();
  }, [systemColorScheme]); // Re-run if system scheme changes

  const setThemePreference = async (preference: 'light' | 'dark' | 'system') => {
    console.log('[ThemeProvider] setThemePreference called with:', preference);
    try {
      await AsyncStorage.setItem('themePreference', preference);
      setThemePreferenceState(preference);
      // Update isLightMode based on the new preference
      let lightMode;
      if (preference === 'system') {
        lightMode = systemColorScheme === 'light';
      } else {
        lightMode = preference === 'light';
      }
      setIsLightMode(lightMode);
      console.log('[ThemeProvider] Updated isLightMode state to:', lightMode);
    } catch (error) {
      console.error('[ThemeProvider Save] Failed to save theme preference:', error);
    }
  };

  const toggleTheme = () => {
    setThemePreference(isLightMode ? 'dark' : 'light');
  };

  // Determine the current theme object based on isLightMode
  const theme = isLightMode ? colors.light : colors.dark;

  return (
    <ThemeContext.Provider value={{ theme, isLightMode, setThemePreference, themePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
