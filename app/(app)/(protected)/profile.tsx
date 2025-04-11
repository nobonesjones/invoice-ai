import { View, ActivityIndicator, Switch, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { TouchableOpacity } from "react-native-gesture-handler";
import { SafeAreaView } from "@/components/safe-area-view";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

export default function Profile() {
    const router = useRouter();
    const { user, signOut } = useSupabase();
    const { isLightMode, toggleTheme, theme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsLoading(true);
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateName = async (newName: string) => {
        try {
            setIsSaving(true);
            const { error } = await supabase.auth.updateUser({
                data: { display_name: newName }
            });
            if (error) throw error;
            setName(newName);
        } catch (error) {
            console.error('Error updating name:', error);
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    return (
        <SafeAreaView style={{ backgroundColor: theme.background }} className="flex-1">
            <TouchableOpacity 
                onPress={() => router.back()}
                className="flex-row items-center px-4 py-6"
            >
                <View className="flex-row items-center">
                    <Text>
                        <ChevronLeft size={24} color={theme.foreground} />
                    </Text>
                    <Text style={{ color: theme.foreground }} className="text-2xl font-semibold ml-2">Profile</Text>
                </View>
            </TouchableOpacity>

            <View className="flex-1 px-4 pt-4">
                <ScrollView className="pt-4">
                    {/* Personal Information Section */}
                    <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mb-8">
                        <Pressable 
                            onPress={() => setIsEditing(true)}
                            style={{ borderBottomColor: theme.border }} 
                            className="flex-row items-center justify-between p-4 border-b"
                        >
                            <View>
                                <Text style={{ color: theme.mutedForeground }} className="text-sm mb-1">Name</Text>
                                {isEditing ? (
                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        onBlur={() => handleUpdateName(name)}
                                        autoFocus
                                        style={{ color: theme.foreground, padding: 0 }}
                                        className="text-base"
                                    />
                                ) : (
                                    <View className="flex-row items-center">
                                        <Text style={{ color: theme.foreground }}>{name}</Text>
                                        {isSaving && <ActivityIndicator size="small" className="ml-2" />}
                                    </View>
                                )}
                            </View>
                            <Text>
                                <ChevronRight size={20} color={theme.foreground} />
                            </Text>
                        </Pressable>
                        <View className="p-4">
                            <Text style={{ color: theme.mutedForeground }} className="text-sm mb-1">Email</Text>
                            <Text style={{ color: theme.foreground }}>{user?.email}</Text>
                        </View>
                    </View>

                    {/* App Settings Section */}
                    <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mb-8">
                        <View 
                            style={{ borderBottomColor: theme.border }} 
                            className="flex-row items-center justify-between p-4 border-b"
                        >
                            <Text style={{ color: theme.foreground }}>Light Mode</Text>
                            <Switch
                                value={isLightMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#4a4a4a', true: '#7c3aed' }}
                                thumbColor={'#f4f3f4'}
                            />
                        </View>
                        {/* Temporarily commenting out navigation links due to TypeScript issues */}
                        {/*
                        <Link href="/(app)/(protected)/notifications" asChild>
                            <Pressable 
                                style={{ borderBottomColor: colors.light.border }} 
                                className="flex-row items-center justify-between p-4 border-b"
                            >
                                <Text style={{ color: colors.light.foreground }}>Notifications</Text>
                                <Text>
                                    <ChevronRight size={20} color={colors.light.foreground} />
                                </Text>
                            </Pressable>
                        </Link>
                        <Link href="/(app)/(protected)/change-password" asChild>
                            <Pressable 
                                className="flex-row items-center justify-between p-4"
                            >
                                <Text style={{ color: colors.light.foreground }}>Change Password</Text>
                                <Text>
                                    <ChevronRight size={20} color={colors.light.foreground} />
                                </Text>
                            </Pressable>
                        </Link>
                        */}
                    </View>
                </ScrollView>

                {/* Sign Out Button at Bottom */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mb-8">
                    <Pressable 
                        onPress={handleSignOut}
                        disabled={isLoading}
                        className="p-4"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                            <Text className="text-red-500 text-center">Sign Out</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}