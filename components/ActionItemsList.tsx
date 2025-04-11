import { View, Text, TouchableOpacity } from 'react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/config/supabase';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';

interface ActionItem {
  id: string;
  content: string;
  completed: boolean;
  completed_at: string | null;
  assigned_to: string | null;
  meeting_id: string;
}

interface ActionItemsListProps {
  meetingId: string;
  actionItems?: ActionItem[] | any[];
}

export function ActionItemsList({ meetingId, actionItems: initialItems }: ActionItemsListProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialItems || []);
  const [isLoading, setIsLoading] = useState(!initialItems);

  useEffect(() => {
    if (!initialItems) {
      fetchActionItems();
    } else if (initialItems.length > 0) {
      setActionItems(initialItems);
      setIsLoading(false);
    }
  }, [meetingId, initialItems]);

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
    // Skip toggling for placeholder items
    if (actionItems.find(item => item.id === id)?.content === 'No action items identified') {
      return;
    }
    
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
        <Text style={{ color: colors.light.mutedForeground }} className="text-muted-foreground">Loading action items...</Text>
      </View>
    );
  }

  // Special handling for placeholder items
  const hasPlaceholder = actionItems.some(item => item.content === 'No action items identified');
  
  if (actionItems.length === 0 || hasPlaceholder) {
    return (
      <View className="py-2 pl-0">
        <Text style={{ color: colors.light.mutedForeground }} className="text-muted-foreground italic">
          No action items identified
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-2 pl-0">
      {actionItems.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => toggleActionItem(item.id, !item.completed)}
          className="flex-row items-center bg-card rounded-lg active:opacity-70 pl-0 pr-3 py-3"
          style={{ backgroundColor: colors.light.card }}
          activeOpacity={0.7}
        >
          <View className="ml-0 mr-3">
            <Checkbox
              checked={item.completed}
              onCheckedChange={(checked: boolean) => toggleActionItem(item.id, checked)}
            />
          </View>
          <Text 
            style={{ 
              color: item.completed ? colors.light.mutedForeground : colors.light.foreground,
              textDecorationLine: item.completed ? 'line-through' : 'none'
            }}
            className="flex-1"
          >
            {item.content}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
