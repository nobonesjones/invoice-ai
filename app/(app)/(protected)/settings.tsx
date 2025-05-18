import { useRouter, Link } from "expo-router";
import {
	ChevronLeft, 
	ChevronRight,
	User,
	Mail,
	Star,
	Languages,
	NotebookText,
	Palette,
	Moon,
	Sun,
	Shield,
	FileText,
	HelpCircle,
	MessageSquarePlus,
	LogOut,
} from "lucide-react-native";
import { useState, useEffect } from "react";
import {
	View,
	ActivityIndicator,
	Switch,
	TextInput,
	Pressable,
	ScrollView,
	TouchableOpacity,
	Alert,
	StyleSheet, 
} from "react-native";
import { TouchableOpacity as GestureTouchableOpacity } from "react-native-gesture-handler";

import { ContactUsModal } from "@/components/modals/ContactUsModal";
import { LanguageSelectorModal } from "@/components/modals/LanguageSelectorModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsListItem } from "@/components/ui/SettingsListItem";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography"; 
import { supabase } from "@/config/supabase";
import { colors as importedColors } from "@/constants/colors"; 
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";

export default function SettingsScreen() {
	const router = useRouter();
	const { user, signOut } = useSupabase();
	const { isLightMode, toggleTheme, theme } = useTheme();
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState(
		user?.user_metadata?.display_name || user?.email?.split("@")[0] || "",
	);
	const [isEditingName, setIsEditingName] = useState(false);
	const [editingNameValue, setEditingNameValue] = useState(name);
	const [isModalVisible, setIsModalVisible] = useState(false);
	const [activeModalTitle, setActiveModalTitle] = useState("");
	const [isContactModalVisible, setIsContactModalVisible] = useState(false);

	const handleUpgrade = () => console.log("Upgrade pressed");
	const handleNamePress = () => setIsEditingName(true);
	const handleTranscriptLang = () => {
		setActiveModalTitle("App Language");
		setIsModalVisible(true);
	};
	const handleStoragePress = () => {
		setActiveModalTitle("Storage");
		setIsModalVisible(true);
	};
	const handlePrivacy = () => console.log("Privacy Policy pressed");
	const handleTerms = () => console.log("Terms of Service pressed");
	const handleContact = () => setIsContactModalVisible(true);
	const handleReview = () => console.log("Leave Review pressed");

	const handleSaveName = async () => {
		if (!user || editingNameValue.trim() === name) {
			setIsEditingName(false);
			setEditingNameValue(name);
			return;
		}
		if (editingNameValue.trim() === "") {
			Alert.alert("Error", "Name cannot be empty.");
			setEditingNameValue(name);
			return;
		}
		try {
			const { data, error } = await supabase.auth.updateUser({
				data: { display_name: editingNameValue.trim() },
			});
			if (error) throw error;
			if (data.user?.user_metadata?.display_name) {
				setName(data.user.user_metadata.display_name);
			} else {
				setName(editingNameValue.trim());
			}
			setIsEditingName(false);
			console.log("User name updated successfully.");
		} catch (error: any) {
			console.error("Error updating user name:", error);
			Alert.alert("Error", error.message || "Failed to update name.");
			setEditingNameValue(name);
		}
	};

	const handleSignOut = async () => {
		try {
			setIsLoading(true);
			await signOut();
		} catch (error) {
			console.error("Error signing out:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={[styles.title, { color: theme.foreground }]}>Settings</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 /* Adjust if sign out fixed bar overlaps */ }}>

          {/* Upgrade Section (Standalone) */}
          <View
            style={{ backgroundColor: theme.card }}
            className="rounded-lg overflow-hidden mx-4 my-4"
          >
            <SettingsListItem
              icon={<Star size={24} color="#FFC107" />}
              label="Upgrade"
              onPress={handleUpgrade}
            />
          </View>

          {/* Account Section */}
          <View
            style={{ backgroundColor: theme.card }}
            className="rounded-lg overflow-hidden mx-4 mb-4"
          >
            <SettingsListItem
              icon={<User size={24} color={theme.foreground} />}
              label="Name"
              rightContent={
                isEditingName ? (
                  <TextInput
                    value={editingNameValue}
                    onChangeText={setEditingNameValue}
                    autoFocus
                    onBlur={handleSaveName}
                    onSubmitEditing={handleSaveName}
                    style={{
                      color: theme.foreground,
                      fontSize: 14,
                      padding: 0,
                      margin: 0,
                      textAlign: "right",
                      flex: 1, // Allow input to take available space
                    }}
                    placeholderTextColor={theme.mutedForeground}
                  />
                ) : (
                  <TouchableOpacity onPress={handleNamePress} style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.mutedForeground,
                        fontSize: 14,
                        textAlign: "right",
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                )
              }
              onPress={isEditingName ? undefined : handleNamePress}
              hideChevron
            />
            <SettingsListItem
              icon={<Mail size={24} color={theme.foreground} />}
              label="Email"
              rightContent={
                <Text style={{ color: theme.mutedForeground }}>
                  {user?.email}
                </Text>
              }
              hideChevron
            />
          </View>

          {/* Language Section */}
          <View
            style={{ backgroundColor: theme.card }}
            className="rounded-lg overflow-hidden mx-4 mb-4"
          >
            <SettingsListItem
              icon={<Languages size={24} color={theme.foreground} />}
              label="App Language"
              onPress={handleTranscriptLang}
            />
            <SettingsListItem
              icon={<NotebookText size={24} color={theme.foreground} />}
              label="Storage"
              rightContent={
                <Text style={{ color: theme.mutedForeground }}> </Text>
              }
              onPress={handleStoragePress}
            />
          </View>

          {/* Appearance Section */}
          <View
            style={{ backgroundColor: theme.card }}
            className="rounded-lg overflow-hidden mx-4 mb-4"
          >
            <SettingsListItem
              icon={
                isLightMode ? (
                  <Moon size={24} color={theme.foreground} />
                ) : (
                  <Sun size={24} color={theme.foreground} />
                )
              }
              label="Light / Dark Mode"
              hideChevron
              rightContent={
                <Switch
                  value={isLightMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: "#4a4a4a", true: importedColors.light.primary }}
                  thumbColor="#f4f3f4"
                />
              }
            />
          </View>

          {/* Support & Legal Section */}
          <View
            style={{ backgroundColor: theme.card }}
            className="rounded-lg overflow-hidden mx-4 mb-4"
          >
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
        <View
          style={{
            backgroundColor: theme.card,
            position: 'absolute', 
            bottom: 0,
            left: 0,
            right: 0,
            marginHorizontal: 16, 
            marginBottom: 16, 
            borderRadius: 8, 
            overflow: 'hidden', 
            borderTopWidth: StyleSheet.hairlineWidth, 
            borderTopColor: theme.border, 
          }}
        >
          <SettingsListItem
            icon={<LogOut size={24} color={theme.destructive} />}
            label="Sign Out"
            isDestructive
            hideChevron
            onPress={handleSignOut}
            disabled={isLoading}
            rightContent={
              isLoading ? (
                <ActivityIndicator size="small" color={theme.destructive} />
              ) : null
            }
          />
        </View>

        <LanguageSelectorModal
          isVisible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          title={activeModalTitle}
        />
        <ContactUsModal
          isVisible={isContactModalVisible}
          onClose={() => setIsContactModalVisible(false)}
        />
      </View>
    </SafeAreaView>
	);
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    // color is applied inline using theme.foreground
  },
});
