import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Modal,
    FlatList
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { Text } from '@/components/ui/text';
import { ChevronLeft, Camera, Calendar, DollarSign, Save, Trash2, X, ChevronDown } from 'lucide-react-native';
import { useSupabase } from '@/context/supabase-provider';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const expenseSchema = z.object({
    merchant_name: z.string().min(1, 'Merchant is required'),
    total_amount: z.string().min(1, 'Amount is required').regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
    tax_amount: z.string().optional().regex(/^(\d+(\.\d{1,2})?)?$/, 'Invalid tax amount'),
    category_id: z.string().min(1, 'Category is required'),
    description: z.string().optional(),
    expense_date: z.date(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

type Category = {
    id: string;
    category_name: string;
    icon_emoji: string;
};

export default function EditExpenseScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { theme } = useTheme();
    const { supabase, user } = useSupabase();
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);

    // Category State
    const [categories, setCategories] = useState<Category[]>([]);
    const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    const { control, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            merchant_name: '',
            total_amount: '',
            tax_amount: '',
            category_id: '',
            description: '',
            expense_date: new Date(),
        }
    });

    const expenseDate = watch('expense_date');

    useEffect(() => {
        loadCategories();
        loadExpense();
    }, [id]);

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

    const loadExpense = async () => {
        if (!user || !supabase || !id) return;
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                reset({
                    merchant_name: data.merchant_name,
                    total_amount: data.total_amount.toString(),
                    tax_amount: data.tax_amount ? data.tax_amount.toString() : '',
                    category_id: data.category_id,
                    description: data.description || '',
                    expense_date: new Date(data.expense_date),
                });

                if (data.receipt_image_url) {
                    setReceiptImage(data.receipt_image_url);
                }

                // Set selected category for UI
                // We need to wait for categories to load or fetch this specific category if not loaded yet
                // For simplicity, we'll rely on the categories list being loaded or load it here if needed
                // Ideally, we'd fetch the category details with the expense
            }
        } catch (error) {
            console.error('Error loading expense:', error);
            Alert.alert('Error', 'Failed to load expense details');
        } finally {
            setIsLoading(false);
        }
    };

    // Sync selected category when categories and form data are ready
    useEffect(() => {
        const currentCategoryId = watch('category_id');
        if (currentCategoryId && categories.length > 0) {
            const category = categories.find(c => c.id === currentCategoryId);
            if (category) {
                setSelectedCategory(category);
            }
        }
    }, [categories, watch('category_id')]);

    const showDatePicker = () => setDatePickerVisibility(true);
    const hideDatePicker = () => setDatePickerVisibility(false);
    const handleConfirmDate = (selectedDate: Date) => {
        setValue('expense_date', selectedDate);
        hideDatePicker();
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setReceiptImage(result.assets[0].uri);
        }
    };

    const onSubmit = async (data: ExpenseFormData) => {
        if (!user || !supabase || !id) return;

        setIsSubmitting(true);
        try {
            let receiptUrl = receiptImage;

            // Logic to upload new image if changed would go here

            const { error } = await supabase
                .from('expenses')
                .update({
                    merchant_name: data.merchant_name,
                    total_amount: parseFloat(data.total_amount),
                    tax_amount: data.tax_amount ? parseFloat(data.tax_amount) : 0,
                    category_id: data.category_id,
                    description: data.description,
                    expense_date: data.expense_date.toISOString(),
                    receipt_image_url: receiptUrl,
                })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            Alert.alert('Success', 'Expense updated successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Error updating expense:', error);
            Alert.alert('Error', error.message || 'Failed to update expense');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!user || !supabase || !id) return;
                        try {
                            const { error } = await supabase
                                .from('expenses')
                                .delete()
                                .eq('id', id)
                                .eq('user_id', user.id);

                            if (error) throw error;
                            router.back();
                        } catch (error) {
                            console.error('Error deleting expense:', error);
                            Alert.alert('Error', 'Failed to delete expense');
                        }
                    }
                }
            ]
        );
    };

    const renderCategoryItem = ({ item }: { item: Category }) => (
        <TouchableOpacity
            style={[styles.categoryItem, { borderBottomColor: theme.border }]}
            onPress={() => {
                setSelectedCategory(item);
                setValue('category_id', item.id, { shouldValidate: true });
                setCategoryModalVisible(false);
            }}
        >
            <Text style={styles.categoryEmoji}>{item.icon_emoji}</Text>
            <Text style={[styles.categoryName, { color: theme.foreground }]}>{item.category_name}</Text>
            {selectedCategory?.id === item.id && (
                <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]} />
            )}
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={theme.foreground} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.foreground }]}>Edit Expense</Text>
                <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                    <Trash2 size={20} color="red" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.formCard, { backgroundColor: theme.card }]}>

                    {/* Merchant */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.mutedForeground }]}>Merchant</Text>
                        <Controller
                            control={control}
                            name="merchant_name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, { color: theme.foreground, borderColor: theme.border }]}
                                    placeholder="e.g. Starbucks"
                                    placeholderTextColor={theme.mutedForeground}
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                        {errors.merchant_name && <Text style={styles.errorText}>{errors.merchant_name.message}</Text>}
                    </View>

                    {/* Category Selector */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.mutedForeground }]}>Category</Text>
                        <TouchableOpacity
                            style={[styles.selectorButton, { borderColor: theme.border }]}
                            onPress={() => setCategoryModalVisible(true)}
                        >
                            {selectedCategory ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ marginRight: 8, fontSize: 18 }}>{selectedCategory.icon_emoji}</Text>
                                    <Text style={{ color: theme.foreground, fontSize: 16 }}>{selectedCategory.category_name}</Text>
                                </View>
                            ) : (
                                <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>Select Category</Text>
                            )}
                            <ChevronDown size={20} color={theme.mutedForeground} />
                        </TouchableOpacity>
                        {errors.category_id && <Text style={styles.errorText}>{errors.category_id.message}</Text>}
                    </View>

                    {/* Amount & Tax Row */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={[styles.label, { color: theme.mutedForeground }]}>Total Amount</Text>
                            <View style={[styles.amountContainer, { borderColor: theme.border }]}>
                                <DollarSign size={18} color={theme.mutedForeground} style={styles.currencyIcon} />
                                <Controller
                                    control={control}
                                    name="total_amount"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={[styles.amountInput, { color: theme.foreground }]}
                                            placeholder="0.00"
                                            placeholderTextColor={theme.mutedForeground}
                                            keyboardType="decimal-pad"
                                            value={value}
                                            onChangeText={onChange}
                                        />
                                    )}
                                />
                            </View>
                            {errors.total_amount && <Text style={styles.errorText}>{errors.total_amount.message}</Text>}
                        </View>

                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={[styles.label, { color: theme.mutedForeground }]}>Tax Amount</Text>
                            <View style={[styles.amountContainer, { borderColor: theme.border }]}>
                                <DollarSign size={18} color={theme.mutedForeground} style={styles.currencyIcon} />
                                <Controller
                                    control={control}
                                    name="tax_amount"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={[styles.amountInput, { color: theme.foreground }]}
                                            placeholder="0.00"
                                            placeholderTextColor={theme.mutedForeground}
                                            keyboardType="decimal-pad"
                                            value={value}
                                            onChangeText={onChange}
                                        />
                                    )}
                                />
                            </View>
                            {errors.tax_amount && <Text style={styles.errorText}>{errors.tax_amount.message}</Text>}
                        </View>
                    </View>

                    {/* Date */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.mutedForeground }]}>Date</Text>
                        <TouchableOpacity
                            style={[styles.dateButton, { borderColor: theme.border }]}
                            onPress={showDatePicker}
                        >
                            <Text style={{ color: theme.foreground }}>{expenseDate.toLocaleDateString()}</Text>
                            <Calendar size={20} color={theme.mutedForeground} />
                        </TouchableOpacity>
                    </View>

                    {/* Description */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.mutedForeground }]}>Description</Text>
                        <Controller
                            control={control}
                            name="description"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[styles.input, { color: theme.foreground, borderColor: theme.border, height: 80 }]}
                                    placeholder="Optional notes..."
                                    placeholderTextColor={theme.mutedForeground}
                                    multiline
                                    textAlignVertical="top"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />
                    </View>

                    {/* Receipt Image */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.mutedForeground }]}>Receipt</Text>
                        <TouchableOpacity
                            style={[styles.imagePicker, { borderColor: theme.border, borderStyle: 'dashed' }]}
                            onPress={pickImage}
                        >
                            {receiptImage ? (
                                <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Camera size={24} color={theme.mutedForeground} />
                                    <Text style={[styles.imagePlaceholderText, { color: theme.mutedForeground }]}>
                                        Tap to attach receipt
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                </View>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.primary }]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Save size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>Update Expense</Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>

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
                        <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.closeButton}>
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

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    deleteButton: {
        padding: 8,
        marginRight: -8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 16,
    },
    formCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    currencyIcon: {
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
    },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
    },
    imagePicker: {
        borderWidth: 1,
        borderRadius: 8,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    imagePlaceholder: {
        alignItems: 'center',
    },
    imagePlaceholderText: {
        marginTop: 8,
        fontSize: 14,
    },
    receiptPreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
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
        borderBottomColor: '#ccc',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    categoryList: {
        padding: 16,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    categoryEmoji: {
        fontSize: 24,
        marginRight: 16,
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
});
