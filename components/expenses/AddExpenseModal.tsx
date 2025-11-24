import React, { forwardRef, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, TextInput, Platform, Image } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { Text } from '@/components/ui/text';
import { X, Save, Calendar, ChevronDown } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { useSupabase } from '@/context/supabase-provider';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export interface AddExpenseModalRef {
  present: () => void;
  dismiss: () => void;
  presentWithData?: (expense: any) => void;
}

export interface AddExpenseModalProps {
  onExpenseAdded?: () => void;
}

type Category = {
  id: string;
  category_name: string;
  icon_emoji: string;
};

const AddExpenseModal = forwardRef<AddExpenseModalRef, AddExpenseModalProps>(({ onExpenseAdded }, ref) => {
  const { theme } = useTheme();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { supabase, user } = useSupabase();

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date picker state
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Receipt image state
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const clearForm = () => {
    setMerchant('');
    setAmount('');
    setTaxAmount('');
    setDescription('');
    setExpenseDate(new Date());
    setSelectedCategory(null);
    setIsSubmitting(false);
    setIsEditMode(false);
    setEditingExpenseId(null);
    setReceiptUrl(null);
  };

  const populateFormWithExpense = (expense: any) => {
    setMerchant(expense.merchant_name || '');
    setAmount(expense.total_amount?.toString() || '');
    setTaxAmount(expense.tax_amount?.toString() || '');
    setDescription(expense.description || '');
    setExpenseDate(expense.expense_date ? new Date(expense.expense_date) : new Date());
    setReceiptUrl(expense.receipt_url || null);
    setIsEditMode(!!expense.id);
    setEditingExpenseId(expense.id || null);

    // Find and set the category from already loaded categories
    if (expense.category_id && categories.length > 0) {
      const category = categories.find(cat => cat.id === expense.category_id);
      if (category) {
        setSelectedCategory(category);
      }
    } else if (expense.category_id) {
      // Set a temporary category from the expense data if categories aren't loaded yet
      if (expense.expense_categories) {
        setSelectedCategory({
          id: expense.category_id,
          category_name: expense.expense_categories.category_name,
          icon_emoji: expense.expense_categories.icon_emoji
        });
      }
    }
  };

  React.useImperativeHandle(ref, () => ({
    present: () => {
      bottomSheetModalRef.current?.present();
      clearForm();
      loadCategories();
    },
    presentWithData: (expense: any) => {
      bottomSheetModalRef.current?.present();
      loadCategories().then(() => {
        populateFormWithExpense(expense);
      });
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  const snapPoints = useMemo(() => ['85%'], []);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('category_name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
  ), []);

  const handleFocus = () => {
    setTimeout(() => {
      try { scrollRef.current?.scrollToEnd?.({ animated: true }); } catch { }
    }, 50);
  };

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (selectedDate: Date) => {
    setExpenseDate(selectedDate);
    hideDatePicker();
  };

  // Helper to render Lucide icon from icon name
  const renderCategoryIcon = (iconName: string, size: number = 20, color?: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    if (IconComponent) {
      return <IconComponent size={size} color={color || theme.foreground} />;
    }
    // Fallback to a default icon if not found
    return <LucideIcons.Package size={size} color={color || theme.foreground} />;
  };

  const handleSave = useCallback(async () => {
    if (!merchant.trim() || !amount.trim()) {
      Alert.alert('Missing Information', 'Please enter merchant and amount');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Missing Information', 'Please select a category');
      return;
    }

    if (!user || !supabase) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseData = {
        user_id: user.id,
        merchant_name: merchant,
        total_amount: parseFloat(amount),
        tax_amount: taxAmount ? parseFloat(taxAmount) : 0,
        category_id: selectedCategory.id,
        description: description || null,
        expense_date: expenseDate.toISOString(),
        receipt_image_url: null,
        is_reimbursable: false,
        reimbursement_status: 'pending',
      };

      console.log(`${isEditMode ? 'Updating' : 'Saving'} expense:`, expenseData);

      let error;
      if (isEditMode && editingExpenseId) {
        // Update existing expense
        const result = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpenseId);
        error = result.error;
      } else {
        // Create new expense
        const result = await supabase.from('expenses').insert(expenseData);
        error = result.error;
      }

      console.log('Expense save result:', { error });

      if (error) throw error;

      Alert.alert('Success', `Expense ${isEditMode ? 'updated' : 'added'} successfully`);
      bottomSheetModalRef.current?.dismiss();
      onExpenseAdded?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to ${isEditMode ? 'update' : 'add'} expense`);
    } finally {
      setIsSubmitting(false);
    }
  }, [merchant, amount, taxAmount, description, expenseDate, selectedCategory, user, supabase, onExpenseAdded, isEditMode, editingExpenseId]);

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[styles.categoryItem, { borderBottomColor: theme.border }]}
      onPress={() => {
        setSelectedCategory(item);
        setCategoryModalVisible(false);
      }}
    >
      <View style={styles.categoryIconContainer}>
        {renderCategoryIcon(item.icon_emoji, 20)}
      </View>
      <Text style={[styles.categoryName, { color: theme.foreground }]}>{item.category_name}</Text>
      {selectedCategory?.id === item.id && (
        <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]} />
      )}
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20
    },
    contentContainerStyle: {
      paddingBottom: 40,
      paddingTop: Platform.OS === 'ios' ? 10 : 15
    },
    modalBackground: {
      backgroundColor: theme.background
    },
    handleIndicator: {
      backgroundColor: theme.mutedForeground
    },
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 10 : 15,
      right: 15,
      padding: 5,
      zIndex: 1
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.foreground,
      marginBottom: 20,
      textAlign: 'center'
    },
    inputGroupContainer: {
      backgroundColor: theme.card,
      borderRadius: 12,
      marginBottom: 20,
      paddingHorizontal: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    inputRow_last: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15
    },
    inputLabelText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.foreground,
      marginRight: 10,
      minWidth: '25%'
    },
    inputValueArea: {
      flex: 1
    },
    textInputStyled: {
      fontSize: 16,
      color: theme.foreground,
      paddingVertical: 0,
      backgroundColor: 'transparent'
    },
    selectorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 0,
    },
    descriptionInputContainer: {
      paddingVertical: 12,
      paddingHorizontal: 15,
      minHeight: 0
    },
    descriptionInput: {
      fontSize: 16,
      color: theme.foreground,
      paddingVertical: 0,
      backgroundColor: 'transparent',
      minHeight: 80,
      textAlignVertical: 'top',
    },
    button: {
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10
    },
    saveButton: {
      backgroundColor: theme.primary,
      flexDirection: 'row',
      justifyContent: 'center'
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600'
    },
    saveButtonText: {
      color: theme.primaryForeground
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    closeButtonModal: {
      padding: 4,
    },
    categoryList: {
      padding: 16,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    categoryIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    categorySelectButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    categoryName: {
      fontSize: 16,
      flex: 1,
    },
    selectedIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    // Image placeholder styles
    imagePlaceholderContainer: {
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    imagePlaceholder: {
      height: 100,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePlaceholderText: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    imagePlaceholderSubtext: {
      fontSize: 14,
    },
    receiptImageContainer: {
      width: '100%',
      height: 120,
      borderRadius: 8,
      borderWidth: 1,
      overflow: 'hidden',
    },
    receiptThumbnail: {
      width: '100%',
      height: '100%',
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      name="addExpenseModal"
      stackBehavior="push"
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      enablePanDownToClose={!isSubmitting}
      enableContentPanningGesture={!isSubmitting}
      topInset={6}
    >
      <BottomSheetScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.contentContainerStyle}>
        <TouchableOpacity style={styles.closeButton} onPress={() => bottomSheetModalRef.current?.dismiss()}>
          <X size={22} color={theme.mutedForeground} />
        </TouchableOpacity>

        <Text style={styles.title}>{isEditMode ? 'Edit Expense' : 'Add Expense'}</Text>

        <View style={styles.inputGroupContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabelText}>Merchant</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={merchant}
                onChangeText={setMerchant}
                placeholder="e.g. Starbucks"
                placeholderTextColor={theme.mutedForeground}
                onFocus={handleFocus}
              />
            </View>
          </View>

          <View style={styles.inputRow_last}>
            <Text style={styles.inputLabelText}>Category</Text>
            <TouchableOpacity
              style={styles.inputValueArea}
              onPress={() => setCategoryModalVisible(true)}
            >
              <View style={styles.selectorContent}>
                {selectedCategory ? (
                  <View style={styles.categorySelectButton}>
                    <View style={{ marginRight: 8 }}>
                      {selectedCategory && renderCategoryIcon(selectedCategory.icon_emoji, 18)}
                    </View>
                    <Text style={{ color: theme.foreground, fontSize: 16 }}>{selectedCategory.category_name}</Text>
                  </View>
                ) : (
                  <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>Select Category</Text>
                )}
                <ChevronDown size={20} color={theme.mutedForeground} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroupContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabelText}>Amount</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                onFocus={handleFocus}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabelText}>Tax (Optional)</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={taxAmount}
                onChangeText={setTaxAmount}
                placeholder="0.00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                onFocus={handleFocus}
              />
            </View>
          </View>

          <View style={styles.inputRow_last}>
            <Text style={styles.inputLabelText}>Date</Text>
            <TouchableOpacity
              style={styles.inputValueArea}
              onPress={showDatePicker}
            >
              <View style={styles.selectorContent}>
                <Text style={{ color: theme.foreground }}>{expenseDate.toLocaleDateString()}</Text>
                <Calendar size={20} color={theme.mutedForeground} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroupContainer}>
          <View style={styles.descriptionInputContainer}>
            <TextInput
              style={[styles.descriptionInput, {
                color: theme.foreground
              }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={theme.mutedForeground}
              multiline={true}
              textAlignVertical="top"
              blurOnSubmit={true}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Receipt Image */}
        <View style={styles.inputGroupContainer}>
          <View style={styles.imagePlaceholderContainer}>
            {receiptUrl ? (
              <View style={[styles.receiptImageContainer, { borderColor: theme.border }]}>
                <Image
                  source={{ uri: receiptUrl }}
                  style={styles.receiptThumbnail}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={[styles.imagePlaceholder, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                <Text style={[styles.imagePlaceholderText, { color: theme.mutedForeground }]}>
                  Receipt Image
                </Text>
                <Text style={[styles.imagePlaceholderSubtext, { color: theme.mutedForeground }]}>
                  Coming Soon
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, styles.saveButtonText]}>
              {editingExpenseId ? 'Update Expense' : receiptUrl ? 'Save' : 'Save Expense'}
            </Text>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>

      {/* Date Picker */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={expenseDate}
      />

      {/* Category Selection Modal */}
      <Modal
        visible={isCategoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>Select Category</Text>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.closeButtonModal}>
              <X size={24} color={theme.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoryList}
          />
        </View>
      </Modal>

    </BottomSheetModal>
  );
});

export default AddExpenseModal;