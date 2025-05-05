import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, CheckCircle, Circle, ChevronLeft, MoreHorizontal, Trash2 } from 'lucide-react-native';
import { TextInput } from 'react-native-gesture-handler'; 
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';

import { SafeAreaView } from "@/components/safe-area-view";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { supabase } from '@/config/supabase';
import ActionItemsMenuModal from '@/components/modals/ActionItemsMenuModal';
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
  const { theme, isLightMode } = useTheme();
  const { user } = useSupabase();
  const router = useRouter();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedActionItems>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const [isMenuModalVisible, setIsMenuModalVisible] = useState(false); // State for modal
  const [filterStatus, setFilterStatus] = useState<'all' | 'incomplete'>('all'); // Filter state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState<string>('');

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
        .eq('meetings.is_deleted', false)
        .neq('content', 'No action items identified'); // Filter out specific content

      if (error) {
        setIsLoading(false);
        return;
      }

      // --- DEBUG LOG START --- 
      // console.log(`Raw Action Items Data Count: ${data?.length ?? 0}`);
      // data?.forEach((item, index) => {
      //   console.log(`Item ${index}: meetings data =`, JSON.stringify(item.meetings));
      // });
      // console.log('--- DEBUG LOG END ---');
      // --- END DEBUG LOG --- 

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
      groupActionItems(transformedData); // Initial grouping with all items
    } catch (error) {
      console.error('Error in fetchActionItems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group action items by date and meeting
  const groupActionItems = useCallback((itemsToGroup: ActionItem[]) => { // Accept items to group
    const grouped: GroupedActionItems = {};
    
    // Sort items by date (newest first)
    itemsToGroup.sort((a, b) => {
      return new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime();
    });
    
    // Group by date and meeting
    itemsToGroup.forEach(item => {
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
    
    // Create sorted date keys from the grouped data
    setDateKeys(Object.keys(grouped)); 
  }, []); // Dependencies: none, relies on passed items

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
              } else {
                console.log('Action item deleted successfully');
                fetchActionItems(); // Refresh the list
              }
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

  // --- Placeholder Modal Actions --- 
  const handleClearAll = () => {
    setIsMenuModalVisible(false); // Close modal immediately

    // Use the currently filtered items for the action
    const itemsToClear = filteredItems;

    if (itemsToClear.length === 0) {
      Alert.alert("No items", "There are no action items to clear.");
      return;
    }

    Alert.alert(
      'Confirm Clear All',
      `Are you sure you want to delete ${itemsToClear.length} action item(s)? This cannot be undone.`, 
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('Confirmed Clear All');
            try {
              const itemIdsToDelete = itemsToClear.map(item => item.id);
              const { error } = await supabase
                .from('action_items')
                .delete()
                .in('id', itemIdsToDelete);

              if (error) {
                console.error('Error clearing action items:', error);
                Alert.alert('Error', 'Could not clear action items.');
              } else {
                console.log('Action items cleared successfully');
                fetchActionItems(); // Refresh the list
              }
            } catch (e) {
              console.error('Exception clearing action items:', e);
              Alert.alert('Error', 'An unexpected error occurred.');
            }
          },
        },
      ]
    );
  };

  const handleCheckAll = () => {
    setIsMenuModalVisible(false); // Close modal immediately

    // Find incomplete items within the current filter
    const itemsToCheck = filteredItems.filter(item => !item.completed);

    if (itemsToCheck.length === 0) {
      Alert.alert("No items", "There are no incomplete action items to check.");
      return;
    }

    console.log(`Checking ${itemsToCheck.length} items...`);
    const itemIdsToCheck = itemsToCheck.map(item => item.id);

    // Perform the update
    (async () => {
      try {
        const { error } = await supabase
          .from('action_items')
          .update({ completed: true, completed_at: new Date().toISOString() })
          .in('id', itemIdsToCheck);

        if (error) {
          console.error('Error checking all action items:', error);
          Alert.alert('Error', 'Could not update action items.');
        } else {
          console.log('Action items checked successfully');
          fetchActionItems(); // Refresh the list
        }
      } catch (e) {
        console.error('Exception checking all action items:', e);
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    })();
  };

  const handleViewIncomplete = () => {
    console.log('View Incomplete Pressed');
    setFilterStatus('incomplete');
    setIsMenuModalVisible(false);
    // Add actual logic later
  };

  const handleViewAll = () => {
    console.log('View All Pressed');
    setFilterStatus('all');
    setIsMenuModalVisible(false);
    // Add actual logic later
  };
  // --- End Placeholder Modal Actions --- 

  // Start Editing
  const startEditing = (item: ActionItem) => {
    setEditingItemId(item.id);
    setEditingItemText(cleanActionItemContent(item.content)); // Start with current clean text
  };

  // Save Edit
  const saveEdit = async () => {
    if (!editingItemId) return;

    const newContent = editingItemText.trim();
    if (!newContent) {
      Alert.alert("Error", "Action item content cannot be empty.");
      // Optionally keep editing mode active or revert
      // setEditingItemText(originalText); // Need to store original text if reverting
      return; 
    }

    console.log(`Saving item ${editingItemId} with new content: ${newContent}`);

    try {
      const { error } = await supabase
        .from('action_items')
        .update({ content: newContent })
        .eq('id', editingItemId);

      if (error) {
        console.error('Error saving action item:', error);
        Alert.alert('Error', 'Failed to save changes.');
        // Optionally revert local state or keep editing? For now, we just alert.
      } else {
        console.log('Action item saved successfully');
        fetchActionItems(); // Refresh the list after successful save
      }
    } catch (e) {
      console.error('Exception saving action item:', e);
      Alert.alert('Error', 'An unexpected error occurred while saving.');
    }

    setEditingItemId(null);
    setEditingItemText('');
  };

  // Cancel Edit
  const cancelEdit = () => {
    setEditingItemId(null);
    setEditingItemText('');
  };

  // Filtered items based on state
  const filteredItems = useMemo(() => {
    if (filterStatus === 'incomplete') {
      return actionItems.filter(item => !item.completed);
    } 
    return actionItems; // 'all'
  }, [actionItems, filterStatus]);

  // Regroup items when filter or items change
  useEffect(() => {
    if (!isLoading) {
       groupActionItems(filteredItems);
    }
  }, [filteredItems, isLoading, groupActionItems]);

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchActionItems();
    }, [user])
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
      edges={["top", "bottom"]}
    >
      {/* Header with Menu Button */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1 mr-2">
          <ChevronLeft size={26} color={theme.foreground} />
        </TouchableOpacity>
        {/* Title and Subtitle */}
        <View className="mr-2">
          <H1 style={{ color: theme.foreground }}>Action Items</H1>
          <Muted style={{ color: theme.mutedForeground }}>Action items from all of your meetings.</Muted>
        </View>
        {/* Flexible spacer to push menu button to the right */}
        <View className="flex-1" />
        <TouchableOpacity onPress={() => setIsMenuModalVisible(true)} className="p-1 ml-2">
          <MoreHorizontal size={26} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={{ flex: 1, backgroundColor: isLightMode ? '#FFFFFF' : theme.card }}>
        {/* Action Items List or Loading/Empty State */}
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
                  <Text style={{ color: theme.foreground, paddingLeft: 15 }} className="text-xl font-bold">
                    {formatDateHeader(dateKey)}
                  </Text>
                </View>
                
                {/* Meetings for this date */}
                {Object.keys(groupedItems[dateKey]).map(meetingId => (
                  <View key={meetingId} className="mb-3">
                    {/* Meeting Header */}
                    <View className="mb-1">
                      <Text 
                        style={{ 
                          color: theme.foreground, 
                          fontWeight: '500', 
                          fontSize: 16, 
                          lineHeight: 24, 
                          paddingLeft: 15 
                        }} 
                      >
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
                        {/* Row Content - Separate touch targets */}
                        <View 
                          className="flex-row items-start py-1.5 px-1"
                          style={{ backgroundColor: isLightMode ? '#FFFFFF' : theme.card }} // Conditional background
                        >
                          {/* Checkbox Area (Touchable) */}
                          <TouchableOpacity onPress={() => toggleActionItem(item)} className="mr-3 p-1">
                            {item.completed ? (
                              <CheckCircle size={20} color={isLightMode ? '#000000' : '#FFFFFF'} /> 
                            ) : (
                              <Circle size={20} color={theme.mutedForeground} />
                            )}
                          </TouchableOpacity>
                          
                          {/* Text Area (Touchable for Editing) */}
                          <TouchableOpacity onPress={() => startEditing(item)} className="flex-1 py-0.5">
                            {/* Conditional Rendering: Text or TextInput */}
                            {editingItemId === item.id ? (
                              <TextInput
                                style={[
                                  {
                                    color: theme.foreground,
                                    // Mimic Text styles 
                                    fontSize: 16, // Match text size
                                    lineHeight: 24, // Match text line height if needed
                                    paddingVertical: 0, // Adjust as needed
                                    paddingHorizontal: 0,
                                    // Add border on focus if desired
                                    borderColor: colors.light.primary, 
                                    // borderWidth: 1, 
                                  },
                                ]}
                                value={editingItemText}
                                onChangeText={setEditingItemText}
                                autoFocus={true} // Focus automatically
                                onBlur={saveEdit} // Save when focus is lost
                                onSubmitEditing={saveEdit} // Save on keyboard submit
                                multiline={true} // Allow multiline editing
                                returnKeyType="done" // Show 'Done' on keyboard
                                blurOnSubmit={true} // Blur input on submit
                              />
                            ) : (
                              <Text 
                                style={{ 
                                  color: theme.foreground,
                                  textDecorationLine: item.completed ? 'line-through' : 'none',
                                  opacity: item.completed ? 0.7 : 1,
                                  fontSize: 16, // Explicitly match TextInput
                                  lineHeight: 24, // Explicitly match TextInput
                                }} 
                              >
                                {cleanActionItemContent(item.content)}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
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
              {filterStatus === 'incomplete' 
                ? 'All action items are completed!'
                : 'Record a meeting to create action items'} 
            </Muted>
          </View>
        )}
      </View>

      {/* Action Items Menu Modal */}
      <ActionItemsMenuModal
        isVisible={isMenuModalVisible}
        onClose={() => setIsMenuModalVisible(false)}
        onClearAll={handleClearAll}
        onCheckAll={handleCheckAll}
        onViewIncomplete={handleViewIncomplete}
        onViewAll={handleViewAll}
      />
    </SafeAreaView>
  );
}
