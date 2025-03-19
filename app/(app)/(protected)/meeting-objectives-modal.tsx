import { View, TextInput, Modal, Animated, Keyboard, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface MeetingObjectivesModalProps {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: (objectives: string) => void;
}

export default function MeetingObjectivesModal({ 
    isVisible, 
    onClose,
    onConfirm 
}: MeetingObjectivesModalProps) {
    const [objectives, setObjectives] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const router = useRouter();
    const { user } = useSupabase();

    useEffect(() => {
        if (isVisible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 11
            }).start();
        } else {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11
            }).start();
        }
    }, [isVisible]);

    const handleSkip = async () => {
        try {
            setIsLoading(true);
            
            if (!user) {
                Alert.alert('Error', 'You must be logged in');
                return;
            }

            // Create new meeting
            console.log('Creating meeting with data:', {
                user_id: user.id,
                name: 'New Meeting',
                status: 'recording',
                duration: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            const { data: meetingData, error: meetingError } = await supabase
                .from('meetings')
                .insert([
                    { 
                        user_id: user.id,
                        name: 'New Meeting',
                        status: 'recording',
                        duration: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (meetingError) {
                console.error('Meeting creation error:', meetingError);
                Alert.alert('Error', `Failed to create meeting: ${meetingError.message}`);
                return;
            }

            if (!meetingData) {
                console.error('No meeting data returned');
                Alert.alert('Error', 'Failed to create meeting: No data returned');
                return;
            }

            // Close the modal first
            onClose();

            // Then navigate to recording screen with meeting ID
            router.push({
                pathname: "/recording",
                params: { meetingId: meetingData.id }
            });
            
        } catch (error) {
            console.error('Error in handleSkip:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        console.log('Current user:', user);
        
        if (!objectives.trim()) {
            Alert.alert('Error', 'Please enter at least one objective');
            return;
        }
        
        if (!user) {
            Alert.alert('Error', 'You must be logged in');
            return;
        }
        
        try {
            setIsLoading(true);
            
            // Create new meeting
            console.log('Creating meeting with data:', {
                user_id: user.id,
                name: 'New Meeting',
                status: 'recording',
                duration: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            const { data: meetingData, error: meetingError } = await supabase
                .from('meetings')
                .insert([
                    { 
                        user_id: user.id,
                        name: 'New Meeting',
                        status: 'recording',
                        duration: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (meetingError) {
                console.error('Meeting creation error:', {
                    message: meetingError.message,
                    details: meetingError.details,
                    hint: meetingError.hint,
                    code: meetingError.code
                });
                Alert.alert('Error', `Failed to create meeting: ${meetingError.message}`);
                return;
            }

            if (!meetingData) {
                console.error('No meeting data returned');
                Alert.alert('Error', 'Failed to create meeting: No data returned');
                return;
            }

            console.log('Meeting created successfully:', meetingData);

            // Create objectives
            const objectivesArray = objectives.split('\n').filter(obj => obj.trim());
            console.log('Creating objectives:', objectivesArray);
            
            const { error: objectivesError } = await supabase
                .from('objectives')
                .insert(
                    objectivesArray.map((description, index) => ({
                        meeting_id: meetingData.id,
                        description: description.trim(),
                        display_order: index + 1,
                        displayed_at: null
                    }))
                );

            if (objectivesError) {
                console.error('Objectives creation error:', {
                    message: objectivesError.message,
                    details: objectivesError.details,
                    hint: objectivesError.hint,
                    code: objectivesError.code
                });
                Alert.alert('Error', `Failed to create objectives: ${objectivesError.message}`);
                return;
            }

            console.log('Objectives created successfully');
            onConfirm(objectives);
            setObjectives("");
            
            // Close the modal first
            onClose();
            
            // Then navigate to recording screen with meeting ID
            router.push({
                pathname: "/recording",
                params: { meetingId: meetingData.id }
            });
            
        } catch (error) {
            console.error('Error in handleConfirm:', error);
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <View className="flex-1 justify-end">
                    <View className="bg-card rounded-t-3xl p-6">
                        {/* Header with back and skip buttons */}
                        <View className="flex-row items-center justify-between mb-4">
                            <TouchableOpacity 
                                onPress={onClose}
                                className="p-2"
                            >
                                <ChevronLeft size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleSkip}
                                className="p-2"
                                disabled={isLoading}
                            >
                                <Text className="text-gray-400 text-base">Skip</Text>
                            </TouchableOpacity>
                        </View>

                        <Text className="text-2xl font-semibold text-gray-300 mb-2">
                            Set Objectives For Meeting
                        </Text>
                        <Text className="text-gray-400 mb-6">
                            Never forget something important, be reminded if you go off track
                        </Text>

                        <View className="bg-gray-900 rounded-lg p-4 mb-6">
                            <TextInput
                                value={objectives}
                                onChangeText={setObjectives}
                                placeholder="Enter your meeting objectives (one per line)..."
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                className="text-gray-300 min-h-[100]"
                                style={{ textAlignVertical: 'top' }}
                            />
                        </View>

                        <Button
                            onPress={handleConfirm}
                            className="bg-purple-500 py-4"
                            disabled={isLoading || !objectives.trim()}
                        >
                            <Text className="text-white font-semibold text-lg">
                                {isLoading ? 'Saving...' : 'Confirm'}
                            </Text>
                        </Button>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}