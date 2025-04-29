import { View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/config/supabase';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { Muted } from '@/components/ui/typography';
import { useTheme } from '@/context/theme-provider'; // Import useTheme

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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState<string>('');
  const { theme } = useTheme(); // Get theme context

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
    
    // Optimistic UI update first
    setActionItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
          : item
      )
    );

    // Trigger haptics *after* UI update
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  const startEditing = (item: ActionItem) => {
    if (item.content === 'No action items identified') return; // Don't edit placeholder
    setEditingItemId(item.id);
    setEditingItemText(item.content);
  };

  const saveEdit = async () => {
    if (!editingItemId) return;

    const originalText = actionItems.find(item => item.id === editingItemId)?.content;
    if (originalText === editingItemText) { // No change
      setEditingItemId(null);
      setEditingItemText('');
      return;
    }

    // Optimistic update
    setActionItems(prevItems =>
      prevItems.map(item =>
        item.id === editingItemId ? { ...item, content: editingItemText } : item
      )
    );

    const itemIdToSave = editingItemId; // Store ID before resetting state
    setEditingItemId(null);
    setEditingItemText('');

    try {
      const { error } = await supabase
        .from('action_items')
        .update({ content: editingItemText })
        .eq('id', itemIdToSave);

      if (error) {
        console.error('Error saving action item edit:', error);
        // Revert optimistic update on error
        setActionItems(prevItems =>
          prevItems.map(item =>
            item.id === itemIdToSave ? { ...item, content: originalText || '' } : item
          )
        );
      }
    } catch (error) {
      console.error('Error saving action item edit:', error);
      // Revert optimistic update on error
      setActionItems(prevItems =>
        prevItems.map(item =>
          item.id === itemIdToSave ? { ...item, content: originalText || '' } : item
        )
      );
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditingItemText('');
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
          <View 
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center', 
              paddingVertical: 8,
            }}
          >
            {/* Checkbox Area (still toggles) */}
            <TouchableOpacity 
              onPress={() => toggleActionItem(item.id, !item.completed)} 
              style={{ 
                paddingVertical: 8, 
                paddingLeft: 0, 
                paddingRight: 12, 
              }}
              hitSlop={{ top: 10, bottom: 10, left: 20, right: 10 }} 
            >
              <Checkbox
                checked={item.completed}
              />
            </TouchableOpacity>
            
            {/* Text/Input Area (Touchable for editing) */}
            <TouchableOpacity 
              onPress={() => startEditing(item)} 
              style={{ 
                flex: 1, 
                marginLeft: 8, 
                paddingVertical: 4, 
                marginTop: 3,
              }}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }} 
            >
              {editingItemId === item.id ? (
                <TextInput
                  value={editingItemText}
                  onChangeText={setEditingItemText}
                  autoFocus
                  onBlur={saveEdit} 
                  onSubmitEditing={saveEdit} 
                  style={{
                    flex: 1, 
                    color: theme.foreground, 
                    fontSize: 16, 
                    paddingVertical: 0, 
                    paddingHorizontal: 0,
                  }}
                  multiline 
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
              ) : (
                <Text 
                  style={{
                    flex: 1, 
                    color: item.completed ? theme.mutedForeground : theme.foreground,
                    textDecorationLine: item.completed ? 'line-through' : 'none',
                    fontSize: 16, 
                  }}
                >
                  {item.content}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}
