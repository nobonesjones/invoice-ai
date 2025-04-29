import { View, ActivityIndicator, Switch, TextInput, Pressable, ScrollView, TouchableOpacity, Alert } from "react-native";
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
import { TouchableOpacity as GestureTouchableOpacity } from "react-native-gesture-handler";
import { SafeAreaView } from "@/components/safe-area-view";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { SettingsListItem } from "@/components/ui/SettingsListItem";
import { LanguageSelectorModal } from "@/components/modals/LanguageSelectorModal";
import { ContactUsModal } from "@/components/modals/ContactUsModal"; // Import the new modal

export default function Profile() {
    const router = useRouter();
    const { user, signOut } = useSupabase();
    const { isLightMode, toggleTheme, theme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '');
    // State for inline name editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingNameValue, setEditingNameValue] = useState(name);
    // State for language/storage modal
    const [isModalVisible, setIsModalVisible] = useState(false); // Renamed state
    const [activeModalTitle, setActiveModalTitle] = useState(''); // Renamed state for modal title
    // State for contact modal
    const [isContactModalVisible, setIsContactModalVisible] = useState(false);

    // Placeholder handlers for new items
    const handleUpgrade = () => console.log("Upgrade pressed");
    const handleNamePress = () => setIsEditingName(true);
    const handleTranscriptLang = () => {
        setActiveModalTitle('Transcript Language'); // Use renamed state
        setIsModalVisible(true); // Use renamed state
    };
    // Renamed handler for Storage
    const handleStoragePress = () => {
        setActiveModalTitle('Storage'); // Set title to 'Storage'
        setIsModalVisible(true); // Use renamed state
    };
    const handlePrivacy = () => console.log("Privacy Policy pressed");
    const handleTerms = () => console.log("Terms of Service pressed");
    const handleContact = () => setIsContactModalVisible(true); // Open contact modal
    const handleReview = () => console.log("Leave Review pressed");

    // Function to save the edited name
    const handleSaveName = async () => {
        if (!user || editingNameValue.trim() === name) {
            setIsEditingName(false); // Exit edit mode if no change or no user
            setEditingNameValue(name); // Reset edit value
            return;
        }
        if (editingNameValue.trim() === '') {
            Alert.alert("Error", "Name cannot be empty.");
            setEditingNameValue(name); // Reset to original name
            return; // Keep editing mode active
        }

        try {
            const { data, error } = await supabase.auth.updateUser({
                data: { display_name: editingNameValue.trim() },
            });

            if (error) {
                throw error;
            }

            // Update local state optimistically (or based on response)
            if (data.user?.user_metadata?.display_name) {
                setName(data.user.user_metadata.display_name);
            } else {
                setName(editingNameValue.trim()); // Fallback if response doesn't immediately reflect
            }
            setIsEditingName(false); // Exit editing mode
            console.log("User name updated successfully.");
        } catch (error: any) {
            console.error('Error updating user name:', error);
            Alert.alert("Error", error.message || "Failed to update name.");
            setEditingNameValue(name); // Revert editing value on error
            // Optionally keep editing mode active on error, or exit:
            // setIsEditingName(false);
        }
    };

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
            <ScrollView style={{ flex: 1 }} className="pt-4">
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
                        // Use a TouchableOpacity for rightContent only when NOT editing
                        rightContent={
                            isEditingName ? (
                                <TextInput
                                    value={editingNameValue}
                                    onChangeText={setEditingNameValue}
                                    autoFocus // Focus automatically when editing starts
                                    onBlur={handleSaveName} // Save when input loses focus
                                    onSubmitEditing={handleSaveName} // Save on submit (e.g., return key)
                                    style={{ 
                                        color: theme.foreground, 
                                        fontSize: 14, // Match the SettingsListItem label font size
                                        padding: 0, // Remove default padding if any
                                        margin: 0, // Remove default margin if any
                                        // Add flex: 1 if it needs to fill space, adjust as needed
                                        textAlign: 'right', // Align text to the right like the original
                                    }}
                                    placeholderTextColor={theme.mutedForeground}
                                />
                            ) : (
                                // Wrap Text in TouchableOpacity to enable editing
                                <TouchableOpacity onPress={handleNamePress} style={{ flex: 1 }}>
                                     <Text 
                                        style={{ 
                                            color: theme.mutedForeground, 
                                            fontSize: 14, // Match the TextInput font size 
                                            textAlign: 'right', // Align text to the right
                                        }}
                                        numberOfLines={1}
                                     >
                                        {name}
                                     </Text>
                                </TouchableOpacity>
                            )
                        }
                        onPress={isEditingName ? undefined : handleNamePress} // Only trigger row press if not editing
                        hideChevron={true} // Always hide chevron for name row
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
                    {/* Renamed Item */}
                    <SettingsListItem
                        icon={<NotebookText size={24} color={theme.foreground} />} // Keeping icon for now
                        label="Storage" // Renamed label
                        rightContent={<Text style={{ color: theme.mutedForeground }}> </Text>} // Placeholder/empty value
                        onPress={handleStoragePress} // Use renamed handler
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
            </ScrollView>

            {/* Fixed Sign Out Section at the Bottom */}
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

            {/* Language/Storage Selector Modal (Reused) */}
            <LanguageSelectorModal
                isVisible={isModalVisible} // Use renamed state
                onClose={() => setIsModalVisible(false)} // Use renamed state
                title={activeModalTitle} // Pass the renamed title state
            />

            {/* Contact Us Modal */}
            <ContactUsModal
                isVisible={isContactModalVisible}
                onClose={() => setIsContactModalVisible(false)}
            />
        </SafeAreaView>
    );
}