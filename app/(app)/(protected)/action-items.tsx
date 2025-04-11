import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, CheckCircle, Circle, ChevronLeft } from 'lucide-react-native';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';

import { SafeAreaView } from "@/components/safe-area-view";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';
import { colors } from '@/constants/colors';

// Types
interface ActionItem {
  id: string;
  meeting_id: string;
  content: string;
  completed: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  created_at: string;
  meeting_name: string;
  meeting_date: string;
}

interface GroupedActionItems {
  [date: string]: {
    [meetingId: string]: {
      meetingName: string;
      items: ActionItem[];
    }
  }
}

export default function ActionItemsScreen() {
  const { theme } = useTheme();
  const { user } = useSupabase();
  const router = useRouter();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedActionItems>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  // Fetch action items
  const fetchActionItems = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Join action_items with meetings to get meeting names
      const { data, error } = await supabase
        .from('action_items')
        .select(`
          id,
          meeting_id,
          content,
          completed,
          completed_at,
          assigned_to,
          created_at,
          meetings(name, created_at)
        `)
        .eq('meetings.user_id', user.id)
        .eq('meetings.is_deleted', false);

      if (error) {
        console.error('Error fetching action items:', error);
        return;
      }

      // Transform the data
      const transformedData = data.map(item => {
        // Handle meetings as a single object, not an array
        const meeting = item.meetings as unknown as { name: string, created_at: string };
        
        return {
          id: item.id,
          meeting_id: item.meeting_id,
          content: item.content,
          completed: item.completed,
          completed_at: item.completed_at,
          assigned_to: item.assigned_to,
          created_at: item.created_at,
          meeting_name: meeting ? meeting.name : 'Unknown Meeting',
          meeting_date: meeting ? meeting.created_at : item.created_at
        };
      });

      setActionItems(transformedData);
      
      // Group the items by date and meeting
      groupActionItems(transformedData);
    } catch (error) {
      console.error('Error in fetchActionItems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group action items by date and meeting
  const groupActionItems = (items: ActionItem[]) => {
    const grouped: GroupedActionItems = {};
    
    // Sort items by date (newest first)
    items.sort((a, b) => {
      return new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime();
    });
    
    // Group by date and meeting
    items.forEach(item => {
      const date = item.meeting_date.split('T')[0]; // Get just the date part
      
      if (!grouped[date]) {
        grouped[date] = {};
      }
      
      if (!grouped[date][item.meeting_id]) {
        grouped[date][item.meeting_id] = {
          meetingName: item.meeting_name,
          items: []
        };
      }
      
      grouped[date][item.meeting_id].items.push(item);
    });
    
    setGroupedItems(grouped);
    
    // Create sorted date keys
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
    
    setDateKeys(sortedDates);
  };

  // Toggle action item completion
  const toggleActionItem = async (item: ActionItem) => {
    try {
      const newCompletedState = !item.completed;
      const completedAt = newCompletedState ? new Date().toISOString() : null;
      
      // Update in database
      const { error } = await supabase
        .from('action_items')
        .update({
          completed: newCompletedState,
          completed_at: completedAt
        })
        .eq('id', item.id);
        
      if (error) {
        console.error('Error updating action item:', error);
        return;
      }
      
      // Update local state
      const updatedItems = actionItems.map(ai => {
        if (ai.id === item.id) {
          return {
            ...ai,
            completed: newCompletedState,
            completed_at: completedAt
          };
        }
        return ai;
      });
      
      setActionItems(updatedItems);
      groupActionItems(updatedItems);
    } catch (error) {
      console.error('Error in toggleActionItem:', error);
    }
  };

  // Delete action item
  const deleteActionItem = async (itemId: string) => {
    try {
      // Show confirmation dialog
      Alert.alert(
        "Delete Action Item",
        "Are you sure you want to delete this action item?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              // Close the swipeable
              if (swipeableRefs.current[itemId]) {
                swipeableRefs.current[itemId]?.close();
              }
            }
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Delete from database
              const { error } = await supabase
                .from('action_items')
                .delete()
                .eq('id', itemId);
                
              if (error) {
                console.error('Error deleting action item:', error);
                Alert.alert('Error', 'Failed to delete action item');
                return;
              }
              
              // Update local state
              const updatedItems = actionItems.filter(item => item.id !== itemId);
              setActionItems(updatedItems);
              groupActionItems(updatedItems);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in deleteActionItem:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Format date for display
  const formatDateHeader = (dateString: string) => {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'EEEE, MMMM d, yyyy');
    }
  };

  // Render right actions for swipeable
  const renderRightActions = (itemId: string) => {
    return (
      <View 
        style={{ 
          backgroundColor: colors.light.destructive,
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          height: '100%'
        }}
      >
        <TouchableOpacity
          onPress={() => deleteActionItem(itemId)}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%'
          }}
        >
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Clean up action item content (remove bullet points)
  const cleanActionItemContent = (content: string) => {
    return content.replace(/^[•\-\*]\s+/g, '').trim();
  };

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchActionItems();
    }, [user])
  );

  return (
    <SafeAreaView style={{ backgroundColor: theme.background }} className="flex-1">
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="py-4 flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.push('/')}
            className="mr-3"
          >
            <ChevronLeft size={24} color={theme.foreground} />
          </TouchableOpacity>
          <View>
            <H1 style={{ color: theme.foreground }}>Action Items</H1>
            <Muted style={{ color: theme.mutedForeground }}>
              Tasks from all your meetings
            </Muted>
          </View>
        </View>

        {/* Action Items List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : dateKeys.length > 0 ? (
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {dateKeys.map(dateKey => (
              <View key={dateKey} className="mb-6">
                {/* Date Header */}
                <View className="mb-3 border-b border-gray-200 pb-1">
                  <Text style={{ color: theme.foreground }} className="text-xl font-bold">
                    {formatDateHeader(dateKey)}
                  </Text>
                </View>
                
                {/* Meetings for this date */}
                {Object.keys(groupedItems[dateKey]).map(meetingId => (
                  <View key={meetingId} className="mb-3">
                    {/* Meeting Header */}
                    <View className="mb-1">
                      <Text style={{ color: theme.foreground }} className="text-base font-medium">
                        {groupedItems[dateKey][meetingId].meetingName}
                      </Text>
                    </View>
                    
                    {/* Action Items for this meeting */}
                    {groupedItems[dateKey][meetingId].items.map(item => (
                      <Swipeable
                        key={item.id}
                        ref={ref => swipeableRefs.current[item.id] = ref}
                        renderRightActions={() => renderRightActions(item.id)}
                        onSwipeableOpen={() => {
                          // Close any other open swipeables
                          Object.keys(swipeableRefs.current).forEach((key) => {
                            if (key !== item.id && swipeableRefs.current[key]) {
                              swipeableRefs.current[key]?.close();
                            }
                          });
                        }}
                        friction={2}
                        rightThreshold={40}
                      >
                        <TouchableOpacity
                          onPress={() => toggleActionItem(item)}
                          className="flex-row items-start py-1.5 px-1"
                          style={{ backgroundColor: theme.background }}
                        >
                          <View className="mr-3 mt-1">
                            {item.completed ? (
                              <CheckCircle size={20} color={colors.light.primary} />
                            ) : (
                              <Circle size={20} color={theme.mutedForeground} />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text 
                              style={{ 
                                color: theme.foreground,
                                textDecorationLine: item.completed ? 'line-through' : 'none',
                                opacity: item.completed ? 0.7 : 1
                              }} 
                              className="text-base"
                            >
                              {cleanActionItemContent(item.content)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </Swipeable>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text style={{ color: theme.mutedForeground }} className="text-center mb-2">
              No action items found
            </Text>
            <Muted style={{ color: theme.mutedForeground }} className="text-center">
              Record a meeting to create action items
            </Muted>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
