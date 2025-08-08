import React, { useState } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  StyleSheet, 
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, Send, MessageSquare } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SupportFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function CustomerSupportScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { user, supabase } = useSupabase();

  const [formData, setFormData] = useState<SupportFormData>({
    name: '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setIsTabBarVisible(false);
      return () => {};
    }, [setIsTabBarVisible])
  );

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return false;
    }
    if (!formData.email || !formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return false;
    }
    if (!formData.message.trim()) {
      Alert.alert('Error', 'Please enter your message.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a support request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('customer_support_tickets')
        .insert([
          {
            user_id: user.id,
            name: formData.name.trim(),
            email: formData.email.trim(),
            subject: formData.subject.trim() || null,
            message: formData.message.trim(),
            status: 'open',
            priority: 'medium'
          }
        ]);

      if (error) {
        throw error;
      }

      Alert.alert(
        'Support Request Submitted',
        'Thank you for contacting us! We\'ve received your message and will get back to you as soon as possible.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setFormData({
                name: '',
                email: user?.email || '',
                subject: '',
                message: ''
              });
              router.back();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error submitting support request:', error);
      Alert.alert(
        'Error',
        'Failed to submit your support request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    headerSection: {
      marginBottom: 24,
      alignItems: 'center',
    },
    headerIcon: {
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.foreground,
      marginBottom: 8,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 16,
      color: theme.mutedForeground,
      textAlign: 'center',
      lineHeight: 22,
    },
    formSection: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.foreground,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.foreground,
      backgroundColor: theme.input,
      marginBottom: 16,
    },
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    requiredField: {
      color: theme.destructive,
    },
    faqSection: {
      marginBottom: 16,
    },
    faqButton: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    faqButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.primary,
      marginBottom: 4,
      textAlign: 'center',
    },
    faqButtonSubtext: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Customer Support',
          headerShown: true,
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: isLightMode ? theme.background : theme.card,
          },
          headerTintColor: theme.foreground,
          headerTitleStyle: {
            fontFamily: 'Roboto-Medium',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0 }}>
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <KeyboardAvoidingView 
        style={styles.scrollContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <View style={styles.headerIcon}>
              <MessageSquare size={48} color={theme.primary} />
            </View>
            <Text style={styles.headerTitle}>How can we help?</Text>
            <Text style={styles.headerSubtitle}>
              You can ask SuperAI any question and they will be able to help, or send us a message and we'll get back to you as soon as possible.
            </Text>
          </View>

          <View style={styles.faqSection}>
            <TouchableOpacity 
              style={styles.faqButton}
              onPress={() => Linking.openURL('https://www.getsuperinvoice.com/faq')}
            >
              <Text style={styles.faqButtonText}>📚 Check our FAQ first</Text>
              <Text style={styles.faqButtonSubtext}>Find quick answers to common questions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>
              Name <Text style={styles.requiredField}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
              placeholderTextColor={theme.mutedForeground}
              editable={!isSubmitting}
            />

            <Text style={styles.fieldLabel}>
              Email <Text style={styles.requiredField}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email address"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isSubmitting}
            />

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.textInput}
              value={formData.subject}
              onChangeText={(text) => setFormData(prev => ({ ...prev, subject: text }))}
              placeholder="Brief description of your issue"
              placeholderTextColor={theme.mutedForeground}
              editable={!isSubmitting}
            />

            <Text style={styles.fieldLabel}>
              Message <Text style={styles.requiredField}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.message}
              onChangeText={(text) => setFormData(prev => ({ ...prev, message: text }))}
              placeholder="Please describe your issue in detail..."
              placeholderTextColor={theme.mutedForeground}
              multiline
              numberOfLines={6}
              editable={!isSubmitting}
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.primaryForeground} />
              ) : (
                <Send size={20} color={theme.primaryForeground} />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}