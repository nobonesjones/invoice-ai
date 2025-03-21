import { View, Text, TouchableOpacity } from 'react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/config/supabase';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

interface ActionItem {
  id: string;
  content: string;
  completed: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  meeting_id: string;
}

export function ActionItemsList({ meetingId }: { meetingId: string }) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActionItems();
  }, [meetingId]);

  const fetchActionItems = async () => {
    try {
      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        setActionItems(data);
      }
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActionItem = async (id: string, completed: boolean) => {
    // Add subtle haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistically update the UI
    setActionItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
          : item
      )
    );

    try {
      const { error } = await supabase
        .from('action_items')
        .update({ 
          completed,
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq('id', id);

      if (error) {
        // Revert the optimistic update if there was an error
        setActionItems(prevItems => 
          prevItems.map(item => 
            item.id === id 
              ? { ...item, completed: !completed, completed_at: !completed ? new Date().toISOString() : null }
              : item
          )
        );
        console.error('Error updating action item:', error);
      }
    } catch (error) {
      // Revert the optimistic update if there was an error
      setActionItems(prevItems => 
        prevItems.map(item => 
          item.id === id 
            ? { ...item, completed: !completed, completed_at: !completed ? new Date().toISOString() : null }
            : item
        )
      );
      console.error('Error updating action item:', error);
    }
  };

  if (isLoading) {
    return (
      <View className="py-4">
        <Text className="text-muted-foreground">Loading action items...</Text>
      </View>
    );
  }

  if (actionItems.length === 0) {
    return (
      <View className="py-4">
        <Text className="text-muted-foreground">No action items found</Text>
      </View>
    );
  }

  return (
    <View className="space-y-2">
      {actionItems.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => toggleActionItem(item.id, !item.completed)}
          className="flex-row items-center space-x-3 p-3 bg-card rounded-lg active:opacity-70"
        >
          <Checkbox
            checked={item.completed}
            onCheckedChange={(checked: boolean) => toggleActionItem(item.id, checked)}
          />
          <Text className={`flex-1 text-white ${item.completed ? 'line-through text-gray-500' : ''}`}>
            {item.content}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
