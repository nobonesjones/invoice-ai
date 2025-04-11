import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { H1 } from '@/components/ui/typography';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { GlobalChatInterface } from '@/components/GlobalChatInterface';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

export default function Chat() {
  const { theme } = useTheme();
  const { user } = useSupabase();
  const router = useRouter();

  return (
    <SafeAreaView style={{ backgroundColor: theme.background }} className="flex-1">
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.push('/')}
            className="mr-3 p-1"
            style={{
              borderRadius: 20,
              backgroundColor: theme.card
            }}
          >
            <ChevronLeft size={24} color={theme.foreground} />
          </TouchableOpacity>
          <View>
            <H1 style={{ color: theme.foreground }}>Chat Assistant</H1>
            <Text style={{ color: theme.mutedForeground, marginTop: 4 }}>
              Ask questions about any of your meetings
            </Text>
          </View>
        </View>

        {/* Chat Interface */}
        <View className="flex-1">
          {user ? (
            <GlobalChatInterface userId={user.id} />
          ) : (
            <View className="flex-1 items-center justify-center p-4">
              <Text style={{ color: theme.foreground }} className="text-center">
                You need to be logged in to use the chat feature.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
