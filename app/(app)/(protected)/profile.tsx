import { View, ActivityIndicator, Switch, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { TouchableOpacity } from "react-native-gesture-handler";
import { SafeAreaView } from "@/components/safe-area-view";
import { supabase } from "@/config/supabase";

export default function Profile() {
    const router = useRouter();
    const { user, signOut } = useSupabase();
    const { colorScheme, toggleColorScheme } = useColorScheme();
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
        <SafeAreaView className="flex-1 bg-black">
            <TouchableOpacity 
                onPress={() => router.back()}
                className="flex-row items-center px-4 py-6"
            >
                <View className="flex-row items-center">
                    <ChevronLeft size={24} className="text-white" />
                    <Text className="text-2xl font-semibold text-gray-300 ml-2">Profile</Text>
                </View>
            </TouchableOpacity>

            <View className="flex-1 px-4 pt-4">
                <ScrollView className="pt-4">
                    {/* Personal Information Section */}
                    <View className="bg-gray-800 rounded-lg overflow-hidden mb-8">
                        <Pressable 
                            onPress={() => setIsEditing(true)}
                            className="flex-row items-center justify-between p-4 border-b border-gray-700"
                        >
                            <View>
                                <Text className="text-sm text-gray-400 mb-1">Name</Text>
                                {isEditing ? (
                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        onBlur={() => handleUpdateName(name)}
                                        autoFocus
                                        className="text-gray-300 text-base"
                                        style={{ padding: 0 }}
                                    />
                                ) : (
                                    <View className="flex-row items-center">
                                        <Text className="text-gray-300">{name}</Text>
                                        {isSaving && <ActivityIndicator size="small" className="ml-2" />}
                                    </View>
                                )}
                            </View>
                            <ChevronRight size={20} className="text-white" />
                        </Pressable>
                        <View className="p-4">
                            <Text className="text-sm text-gray-400 mb-1">Email</Text>
                            <Text className="text-gray-300">{user?.email}</Text>
                        </View>
                    </View>

                    {/* App Settings Section */}
                    <View className="bg-gray-800 rounded-lg overflow-hidden mb-8">
                        <View className="flex-row items-center justify-between p-4 border-b border-gray-700">
                            <Text className="text-gray-300">Dark Mode</Text>
                            <Switch
                                value={colorScheme === 'dark'}
                                onValueChange={toggleColorScheme}
                                trackColor={{ false: '#4a4a4a', true: '#7c3aed' }}
                                thumbColor={colorScheme === 'dark' ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                        <Pressable 
                            onPress={() => router.push("/notifications")}
                            className="flex-row items-center justify-between p-4 border-b border-gray-700"
                        >
                            <Text className="text-gray-300">Notifications</Text>
                            <ChevronRight size={20} className="text-white" />
                        </Pressable>
                        <Pressable 
                            onPress={() => router.push("/change-password")}
                            className="flex-row items-center justify-between p-4"
                        >
                            <Text className="text-gray-300">Change Password</Text>
                            <ChevronRight size={20} className="text-white" />
                        </Pressable>
                    </View>
                </ScrollView>

                {/* Sign Out Button at Bottom */}
                <View className="bg-gray-800 rounded-lg overflow-hidden mb-8">
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