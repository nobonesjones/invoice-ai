import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { Meeting } from "@/types/meetings";

export default function Home() {
  const router = useRouter();
  const { user, supabase } = useSupabase();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setMeetings(data || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      setIsLoading(false);
    }
  };

  const renderMeetingCard = (meeting: Meeting) => (
    <Pressable
      key={meeting.id}
      onPress={() => router.push(`/meeting/${meeting.id}`)}
      className="bg-card rounded-lg p-4 mb-4 flex-row items-center"
    >
      <View className="w-12 h-12 rounded-full bg-primary/20 mr-4 items-center justify-center">
        <Text className="text-2xl">📝</Text>
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold">{meeting.name}</Text>
        <Text className="text-muted-foreground">
          {new Date(meeting.date).toLocaleDateString()}
        </Text>
        <Text className="text-muted-foreground">
          {Math.floor(meeting.duration / 60)} minutes
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <Image
            source={require("@/assets/summiticon.png")}
            className="w-12 h-12 rounded-xl"
          />
          <Pressable
            onPress={() => router.push("/profile")}
            className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center"
          >
            <Text className="text-xl">👤</Text>
          </Pressable>
        </View>

        {/* Welcome Section */}
        <View className="mb-8">
          <H1>Welcome Back{user?.email ? `, ${user.email.split('@')[0]}` : ''}</H1>
        </View>

        {/* Meetings Section */}
        <View className="mb-4">
          <H2>My Meetings</H2>
        </View>

        {/* Meetings List */}
        {isLoading ? (
          <ActivityIndicator size="large" className="mt-8" />
        ) : meetings.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {meetings.map(renderMeetingCard)}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground text-center mb-2">
              No meetings yet
            </Text>
            <Muted className="text-center">
              Start recording your first meeting
            </Muted>
          </View>
        )}
      </View>

      {/* Start Button */}
      <View className="p-4">
        <Button
          onPress={() => router.push("/meeting/new")}
          className="w-full"
          size="lg"
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="absolute inset-0 rounded-lg"
          />
          <Text className="text-white font-semibold text-lg">Start</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
} 