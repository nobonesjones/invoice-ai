import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Alert,
  ActionSheetIOS,
  Image,
  StatusBar,
  Dimensions,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useOnboarding } from "@/context/onboarding-provider";

export default function OnboardingScreen5() {
  const router = useRouter();
  const { theme } = useTheme();
  const { updateLogo } = useOnboarding();
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Store the logo using the onboarding context
    console.log('[Onboarding5] Saving logo:', logoUri);
    updateLogo(logoUri);
    
    router.push("/onboarding-6");
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to take a photo.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please allow photo library access in Settings to choose an image.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePicture = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const showImagePicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take from camera', 'Choose from gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePicture();
          } else if (buttonIndex === 2) {
            pickFromGallery();
          }
        }
      );
    } else {
      // For Android, show a simple alert
      Alert.alert(
        'Select Image',
        'Choose how you would like to select an image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take from camera', onPress: takePicture },
          { text: 'Choose from gallery', onPress: pickFromGallery },
        ]
      );
    }
  };

  const styles = getStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.backgroundContainer}>
        {/* Background - placeholder gradient, replace with actual image */}
        <LinearGradient
          colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
          style={styles.background}
        >
          {/* Content overlay */}
          <View style={[styles.overlay, { backgroundColor: `${theme.card}E6` }]}>
            <View style={styles.contentContainer}>
              {/* Header */}
              <View style={styles.headerContent}>
                <Text style={[styles.headline, { color: theme.foreground }]}>Upload logo</Text>
                <Text style={[styles.instructionText, { color: theme.mutedForeground }]}>
                  Optional, can be edited any time.
                </Text>
              </View>

              {/* Logo Section */}
              <View style={styles.logoSection}>
                {/* Logo Placeholder/Display */}
                <View style={styles.logoContainer}>
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logoImage} />
                  ) : (
                    <View style={[styles.logoPlaceholder, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                      <Ionicons name="image" size={40} color={theme.mutedForeground} />
                      <Text style={[styles.placeholderText, { color: theme.mutedForeground }]}>Your logo</Text>
                    </View>
                  )}
                </View>

                {/* Choose Image Button */}
                <Pressable
                  style={[styles.chooseButton, { backgroundColor: theme.card, borderColor: theme.primary }]}
                  onPress={showImagePicker}
                >
                  <Ionicons name="pencil" size={16} color={theme.primary} style={styles.buttonIcon} />
                  <Text style={[styles.chooseButtonText, { color: theme.primary }]}>Choose image</Text>
                </Pressable>
              </View>

              {/* Spacer */}
              <View style={styles.spacer} />

              {/* Button */}
              <View style={styles.buttonContainer}>
                <Button
                  onPress={handleContinue}
                  style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Continue</Text>
                </Button>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const { height, width } = Dimensions.get('window');

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    height: height,
    width: width,
  },
  backgroundContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  background: {
    flex: 1,
    height: '100%',
  },
  overlay: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 30,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 45,
    marginBottom: 30,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  logoSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  chooseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonIcon: {
    marginRight: 8,
  },
  chooseButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  spacer: {
    flex: 0.5,
  },
  buttonContainer: {
    paddingBottom: 30,
    paddingTop: 10,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});