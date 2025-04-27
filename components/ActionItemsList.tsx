import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/config/supabase';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { Muted } from '@/components/ui/typography';

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
    if (!initialItems && meetingId) {
      fetchActionItems();
    } else if (initialItems) {
      setActionItems(initialItems);
      setIsLoading(false);
    }
  }, [meetingId, initialItems]);

  const fetchActionItems = async () => {
    if (!meetingId) return;
    setIsLoading(true);
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
    if (actionItems.find(item => item.id === id)?.content === 'No action items identified') {
      return;
    }
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  const noRealItems = 
    actionItems.length === 0 || 
    (actionItems.length === 1 && actionItems[0].content === 'No action items identified');

  return (
    <View>
      {isLoading ? (
        <View style={{ paddingVertical: 10 }}>
          <ActivityIndicator size="small" color={colors.light.primary} />
        </View>
      ) : noRealItems ? (
        <Muted style={{ paddingVertical: 10 }}>No action items were identified for this meeting.</Muted>
      ) : (
        actionItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => toggleActionItem(item.id, !item.completed)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.light.border, 
            }}
          >
            <View style={{ marginLeft: 0, marginRight: 8 }}>
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
            >
              {item.content}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}
