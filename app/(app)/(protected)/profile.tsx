import { View, ActivityIndicator, Switch, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import {
    ChevronLeft, ChevronRight,
    User, Mail, Star, Languages, NotebookText, // Account & Language
    Palette, Moon, Sun, // Appearance
    Shield, FileText, HelpCircle, MessageSquarePlus, // Support & Legal (using Star for Review for now)
    LogOut // Sign Out
} from "lucide-react-native";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";
import { TouchableOpacity } from "react-native-gesture-handler";
import { SafeAreaView } from "@/components/safe-area-view";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { SettingsListItem } from "@/components/ui/SettingsListItem"; // Import the new component

export default function Profile() {
    const router = useRouter();
    const { user, signOut } = useSupabase();
    const { isLightMode, toggleTheme, theme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '');

    // Placeholder handlers for new items
    const handleUpgrade = () => console.log("Upgrade pressed");
    const handleNamePress = () => console.log("Name pressed - implement edit?");
    const handleTranscriptLang = () => console.log("Transcript Language pressed");
    const handleNotesLang = () => console.log("Notes Language pressed");
    const handlePrivacy = () => console.log("Privacy Policy pressed");
    const handleTerms = () => console.log("Terms of Service pressed");
    const handleContact = () => console.log("Contact Us pressed");
    const handleReview = () => console.log("Leave Review pressed");

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

    return (
        <SafeAreaView style={{ backgroundColor: theme.background }} className="flex-1">
            <TouchableOpacity 
                onPress={() => router.back()}
                className="flex-row items-center px-4 pt-12 pb-4"
            >
                <View className="flex-row items-center">
                    <Text>
                        <ChevronLeft size={24} color={theme.foreground} />
                    </Text>
                    <H1 style={{ color: theme.foreground }}>Profile</H1>
                </View>
            </TouchableOpacity>

            {/* Scrollable List */}
            <ScrollView className="flex-1 pt-4">
                {/* Upgrade Section (Standalone) */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 my-4">
                    <SettingsListItem
                        icon={<Star size={24} color="#FFC107" />} // Yellow star
                        label="Upgrade"
                        onPress={handleUpgrade}
                    />
                </View>

                {/* Account Section */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 mb-4">
                    <SettingsListItem
                        icon={<User size={24} color={theme.foreground} />}
                        label="Name"
                        rightContent={<Text style={{ color: theme.mutedForeground }}>{name}</Text>}
                        onPress={handleNamePress} // Future: Link to edit screen/modal
                    />
                    <SettingsListItem
                        icon={<Mail size={24} color={theme.foreground} />}
                        label="Email"
                        rightContent={<Text style={{ color: theme.mutedForeground }}>{user?.email}</Text>}
                        hideChevron={true}
                    />
                </View>

                {/* Language Section */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 mb-4">
                    <SettingsListItem
                        icon={<Languages size={24} color={theme.foreground} />}
                        label="Transcript language"
                        onPress={handleTranscriptLang}
                    />
                    <SettingsListItem
                        icon={<NotebookText size={24} color={theme.foreground} />}
                        label="Notes language"
                        onPress={handleNotesLang}
                    />
                </View>

                {/* Appearance Section */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 mb-4">
                    <SettingsListItem
                        icon={isLightMode 
                            ? <Moon size={24} color={theme.foreground} /> 
                            : <Sun size={24} color={theme.foreground} />
                        }
                        label="Light / Dark Mode" // Updated label
                        hideChevron={true}
                        rightContent={
                            <Switch
                                value={isLightMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#4a4a4a', true: colors.light.primary }}
                                thumbColor={'#f4f3f4'}
                            />
                        }
                    />
                </View>

                {/* Support & Legal Section */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 mb-4">
                    <SettingsListItem
                        icon={<Shield size={24} color={theme.foreground} />}
                        label="Privacy Policy"
                        onPress={handlePrivacy}
                    />
                    <SettingsListItem
                        icon={<FileText size={24} color={theme.foreground} />}
                        label="Terms Of Service"
                        onPress={handleTerms}
                    />
                    <SettingsListItem
                        icon={<HelpCircle size={24} color={theme.foreground} />}
                        label="Contact us"
                        onPress={handleContact}
                    />
                    <SettingsListItem
                        icon={<Star size={24} color={theme.foreground} />}
                        label="Leave review"
                        onPress={handleReview}
                    />
                </View>

                {/* Sign Out Section (Now at the end of the scroll) */}
                <View style={{ backgroundColor: theme.card }} className="rounded-lg overflow-hidden mx-4 mb-4">
                    <SettingsListItem
                        icon={<LogOut size={24} color={theme.destructive} />}
                        label="Sign Out"
                        isDestructive={true}
                        hideChevron={true}
                        onPress={handleSignOut}
                        disabled={isLoading}
                        rightContent={
                            isLoading ? <ActivityIndicator size="small" color={theme.destructive} /> : null
                        }
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}