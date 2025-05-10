import { Tabs } from "expo-router";
import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { CircleUserRound, FileText, BarChart3, Bot, Users, PieChart } from 'lucide-react-native'; 
import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider"; 
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";
import * as Haptics from 'expo-haptics'; 
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext'; 

// Function to trigger haptic feedback
const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const iconMap: Record<string, React.ElementType> = {
  "invoices": FileText, // Invoices
  estimates: BarChart3,
  ai: Bot,
  customers: Users,
  reports: PieChart,
};

export default function ProtectedLayout() {
  const { isLightMode } = useTheme(); 
  const theme = isLightMode ? colors.light : colors.dark;
  const { user } = useSupabase();
  const router = useRouter();
  const { isTabBarVisible } = useTabBarVisibility(); 

  return (
    <Tabs
      id="mainProtectedTabs"
      screenOptions={{
        headerShown: false,
        // These are not strictly needed with a fully custom tabBar, but good for reference
        // tabBarActiveTintColor: theme.primary, 
        // tabBarInactiveTintColor: theme.mutedForeground, 
        tabBarStyle: { height: 0, borderTopWidth: 0 }, // Hides default chrome
      }}
      tabBar={({ state, descriptors, navigation }) => {
        // If context dictates tab bar is hidden, return null immediately
        if (!isTabBarVisible) {
          return null;
        }

        // Get the descriptor for the currently active NAVIGATOR/SCREEN that is a direct child of Tabs.
        const currentRoute = state.routes[state.index];
        const descriptor = descriptors[currentRoute.key];
        const options = descriptor.options;

        // If the currently active screen *within this tab* has set tabBarVisible to false,
        // its options should merge, and we can check it here.
        if (options.tabBarVisible === false) {
          return null; // Don't render the custom tab bar
        }

        return (
          <View style={{
            flexDirection: 'row',
            height: 86,
            backgroundColor: theme.background, // White in light mode
            borderTopWidth: 1,
            borderTopColor: theme.border,
            // iOS Shadow
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 }, // Softer shadow upwards
            shadowOpacity: 0.05,
            shadowRadius: 2,
            // Android Shadow
            elevation: 5,
          }}>
            {state.routes
              .filter(route => ['invoices', 'estimates', 'ai', 'customers/index', 'reports'].includes(route.name))
              .map((route, index) => {
              const { options } = descriptors[route.key];
              const label = options.title !== undefined ? options.title : route.name;
              const isFocused = state.index === index;
              const IconComponent = iconMap[route.name] || CircleUserRound; // Fallback icon

              const onPress = () => {
                triggerHaptic();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10 }}
                >
                  <IconComponent color={isFocused ? theme.primary : theme.mutedForeground} size={24} />
                  <Text style={{
                    color: isFocused ? theme.primary : theme.mutedForeground,
                    fontWeight: isFocused ? 'bold' : 'normal',
                    fontSize: 10, 
                    marginTop: 4,
                  }}>
                    {label.toUpperCase()} 
                  </Text>
                  {isFocused && (
                    <View style={{
                      height: 1.5, 
                      width: '90%', 
                      backgroundColor: theme.primary,
                      position: 'absolute',
                      top: 0, 
                      borderRadius: 2,
                    }} />
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      }}
    >
      <Tabs.Screen 
        name="invoices" // This will be your Invoices screen (e.g., app/(app)/(protected)/invoices/index.tsx)
        options={{
          title: "Invoices", 
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen 
        name="estimates" // (e.g., app/(app)/(protected)/estimates.tsx)
        options={{
          title: "Estimates",
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen 
        name="ai" // (e.g., app/(app)/(protected)/ai.tsx)
        options={{
          title: "AI",
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen 
        name="customers/index" // Route for app/(app)/(protected)/customers/index.tsx
        options={{
          title: "Clients", // Renamed from Customers
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen 
        name="reports" // (e.g., app/(app)/(protected)/reports.tsx)
        options={{
          title: "Reports",
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      {/* Hidden screens, not part of the tab bar */}
      <Tabs.Screen 
        name="profile" 
        options={{ tabBarButton: () => null }}
      />
      <Tabs.Screen 
        name="change-password" 
        options={{ tabBarButton: () => null }}
      />
    </Tabs>
  );
}
