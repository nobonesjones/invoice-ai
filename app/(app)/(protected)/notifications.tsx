import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { TouchableOpacity } from "react-native-gesture-handler";
import { SafeAreaView } from "@/components/safe-area-view";

export default function Notifications() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-black">
            <TouchableOpacity 
                onPress={() => router.back()}
                className="flex-row items-center px-4 py-6"
            >
                <View className="flex-row items-center">
                    <ChevronLeft size={24} className="text-white" />
                    <Text className="text-2xl font-semibold text-gray-300 ml-2">Notifications</Text>
                </View>
            </TouchableOpacity>

            <View className="flex-1 items-center justify-center px-4 pt-4">
                <View className="bg-gray-800 rounded-lg p-8 w-full">
                    <Text className="text-gray-300 text-center text-lg font-semibold">
                        Coming Soon
                    </Text>
                    <Text className="text-gray-400 text-center mt-2">
                        Notification settings will be available in a future update
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
} 