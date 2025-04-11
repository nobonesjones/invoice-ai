import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/colors';

type ThemeContextType = {
  isLightMode: boolean;
  toggleTheme: (value?: boolean) => Promise<void>;
  theme: typeof colors.light | typeof colors.dark;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLightMode, setIsLightMode] = useState(true);

  useEffect(() => {
    // Load saved theme preference when app starts
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const storedPreference = await AsyncStorage.getItem('colorScheme');
      if (storedPreference !== null) {
        setIsLightMode(storedPreference === 'light');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async (value?: boolean) => {
    const newValue = value !== undefined ? value : !isLightMode;
    setIsLightMode(newValue);
    try {
      await AsyncStorage.setItem('colorScheme', newValue ? 'light' : 'dark');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Current theme colors based on mode
  const theme = isLightMode ? colors.light : colors.dark;

  const value = {
    isLightMode,
    toggleTheme,
    theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
