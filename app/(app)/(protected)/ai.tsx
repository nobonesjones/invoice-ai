import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Send, Mic, RefreshCw, FileText, Calendar, DollarSign, X, User, Mail, Phone, MapPin } from "lucide-react-native";
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
	useAnimatedGestureHandler,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";
import { ChatService } from "@/services/chatService";
import { OpenAIService } from "@/services/openaiService";
import { useAIChat } from "@/hooks/useAIChat";
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from "./invoices/InvoiceTemplateOne";

// Full-screen Invoice Modal Component
const InvoiceModal = ({ 
	visible, 
	onClose, 
	invoiceData, 
	businessSettings, 
	theme 
}: { 
	visible: boolean; 
	onClose: () => void; 
	invoiceData: any; 
	businessSettings: BusinessSettingsRow | null; 
	theme: any; 
}) => {
	// Zoom and pan animation values
	const scale = useSharedValue(1);
	const translateX = useSharedValue(0);
	const translateY = useSharedValue(0);

	// Reset animation values when modal opens
	useEffect(() => {
		if (visible) {
			scale.value = 1;
			translateX.value = 0;
			translateY.value = 0;
		}
	}, [visible]);

	// Pan gesture handler
	const panGestureHandler = useAnimatedGestureHandler({
		onStart: (_, context: any) => {
			context.translateX = translateX.value;
			context.translateY = translateY.value;
		},
		onActive: (event, context) => {
			translateX.value = context.translateX + event.translationX;
			translateY.value = context.translateY + event.translationY;
		},
	});

	// Pinch gesture handler
	const pinchGestureHandler = useAnimatedGestureHandler({
		onStart: (_, context: any) => {
			context.scale = scale.value;
		},
		onActive: (event, context) => {
			scale.value = Math.max(0.5, Math.min(context.scale * event.scale, 3));
		},
		onEnd: () => {
			// Snap back if zoomed out too much
			if (scale.value < 0.8) {
				scale.value = withSpring(1);
				translateX.value = withSpring(0);
				translateY.value = withSpring(0);
			}
		},
	});

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{ translateX: translateX.value },
				{ translateY: translateY.value },
				{ scale: scale.value },
			],
		};
	});

	if (!invoiceData || !businessSettings) return null;

	const { invoice, line_items, client_id } = invoiceData;

	// Transform data to InvoiceForTemplate format
	const transformedInvoice: InvoiceForTemplate = {
		...invoice,
		currency: businessSettings?.currency || 'USD',
		currency_symbol: businessSettings?.currency_symbol || '$',
		clients: invoice.client_name ? {
			id: client_id,
			user_id: invoice.user_id,
			name: invoice.client_name,
			email: invoice.client_email,
			phone: null,
			address_client: null,
			notes: null,
			avatar_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		} : null,
		invoice_line_items: line_items.map((item: any) => ({
			id: `temp-${Math.random()}`,
			invoice_id: invoice.id,
			user_id: invoice.user_id,
			item_name: item.item_name,
			item_description: item.item_description,
			quantity: item.quantity,
			unit_price: item.unit_price,
			total_price: item.total_price,
			line_item_discount_type: null,
			line_item_discount_value: null,
			item_image_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
	};

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
			<View style={{ flex: 1, backgroundColor: theme.background, height: '90%' }}>
				{/* Header with close button */}
				<View 
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
						paddingHorizontal: 16,
						paddingVertical: 12,
						borderBottomWidth: 1,
						borderBottomColor: theme.border,
					}}
				>
					<Text style={{ color: theme.foreground, fontSize: 18, fontWeight: 'bold' }}>
						Invoice Preview
					</Text>
					<TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
						<X size={24} color={theme.foreground} />
					</TouchableOpacity>
				</View>

				{/* Invoice content with gestures */}
				<View style={{ flex: 1, backgroundColor: theme.border }}>
					<GestureHandlerRootView style={{ flex: 1 }}>
						<PanGestureHandler onGestureEvent={panGestureHandler}>
							<Animated.View style={{ flex: 1 }}>
								<PinchGestureHandler onGestureEvent={pinchGestureHandler}>
									<Animated.View 
										style={[
											{
												flex: 1,
												justifyContent: 'flex-start',
												alignItems: 'center',
												padding: 20,
												paddingTop: 20,
											},
											animatedStyle
										]}
									>
										<InvoiceTemplateOne
											invoice={transformedInvoice}
											clientName={invoice.client_name}
											businessSettings={businessSettings}
										/>
									</Animated.View>
								</PinchGestureHandler>
							</Animated.View>
						</PanGestureHandler>
					</GestureHandlerRootView>
				</View>

				{/* Help text */}
				<View style={{ padding: 16, alignItems: 'center' }}>
					<Text style={{ color: theme.mutedForeground, fontSize: 12, textAlign: 'center' }}>
						Pinch to zoom • Drag to pan • Tap X to close
					</Text>
				</View>
			</View>
		</Modal>
	);
};

// Invoice Preview Component for Chat
const InvoicePreview = ({ invoiceData, theme }: { invoiceData: any; theme: any }) => {
	const { invoice, line_items, client_id } = invoiceData;
	const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
	const [showModal, setShowModal] = useState(false);
	const { supabase } = useSupabase();
	
	// Load business settings on mount
	useEffect(() => {
		loadBusinessSettings();
	}, []);

	const loadBusinessSettings = async () => {
		try {
			console.log('[AI Invoice Preview] Loading business settings for user:', invoice.user_id);
			
			// Fetch actual business settings from the database
			const { data: businessSettings, error } = await supabase
				.from('business_settings')
				.select('*')
				.eq('user_id', invoice.user_id)
				.single();

			if (error) {
				console.error('Error loading business settings:', error);
				// Fall back to default settings if no business settings found
				const defaultSettings: BusinessSettingsRow = {
					id: 'default',
					user_id: invoice.user_id,
					business_name: 'Your Business',
					business_address: 'Your Address',
					business_logo_url: null,
					currency: 'USD',
					currency_symbol: '$',
					paypal_enabled: true,
					stripe_enabled: true,
					bank_transfer_enabled: true,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};
				setBusinessSettings(defaultSettings);
			} else {
				// Use actual business settings from database
				console.log('[AI Invoice Preview] Loaded business settings:', businessSettings);
				
				// Map currency_code to currency_symbol
				const currencySymbol = getCurrencySymbol(businessSettings.currency_code || 'USD');
				
				const enhancedSettings: BusinessSettingsRow = {
					...businessSettings,
					currency: businessSettings.currency_code || 'USD',
					currency_symbol: currencySymbol,
				};
				
				console.log('[AI Invoice Preview] Using currency symbol:', currencySymbol, 'for currency:', businessSettings.currency_code);
				setBusinessSettings(enhancedSettings);
			}
		} catch (error) {
			console.error('Error loading business settings:', error);
			// Fall back to default settings on error
			const defaultSettings: BusinessSettingsRow = {
				id: 'default',
				user_id: invoice.user_id,
				business_name: 'Your Business',
				business_address: 'Your Address',
				business_logo_url: null,
				currency: 'USD',
				currency_symbol: '$',
				paypal_enabled: true,
				stripe_enabled: true,
				bank_transfer_enabled: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			setBusinessSettings(defaultSettings);
		}
	};

	// Currency symbol mapping function
	const getCurrencySymbol = (code: string) => {
		const mapping: Record<string, string> = {
			GBP: '£',
			USD: '$',
			EUR: '€',
			AUD: 'A$',
			CAD: 'C$',
			JPY: '¥',
			INR: '₹',
			CHF: 'Fr',
			CNY: '¥',
			NZD: 'NZ$',
			SEK: 'kr',
			NOK: 'kr',
			DKK: 'kr',
			SGD: 'S$',
			HKD: 'HK$'
		};
		if (!code) return '$';
		const normalized = code.split(' ')[0]; // Handle "GBP - British Pound" format
		return mapping[normalized] || '$';
	};

	// Transform data to InvoiceForTemplate format
	const transformedInvoice: InvoiceForTemplate = {
		...invoice,
		currency: businessSettings?.currency || 'USD',
		currency_symbol: businessSettings?.currency_symbol || '$',
		clients: invoice.client_name ? {
			id: client_id,
			user_id: invoice.user_id,
			name: invoice.client_name,
			email: invoice.client_email,
			phone: null,
			address_client: null,
			notes: null,
			avatar_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		} : null,
		invoice_line_items: line_items.map((item: any) => ({
			id: `temp-${Math.random()}`,
			invoice_id: invoice.id,
			user_id: invoice.user_id,
			item_name: item.item_name,
			item_description: item.item_description,
			quantity: item.quantity,
			unit_price: item.unit_price,
			total_price: item.total_price,
			line_item_discount_type: null,
			line_item_discount_value: null,
			item_image_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})),
	};

	const handleTapToView = () => {
		setShowModal(true);
	};

	if (!businessSettings) {
		return (
			<View 
				style={{
					backgroundColor: theme.background,
					borderWidth: 1,
					borderColor: theme.border,
					borderRadius: 12,
					padding: 16,
					marginTop: 8,
					height: 200,
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<Text style={{ color: theme.mutedForeground }}>Loading invoice preview...</Text>
			</View>
		);
	}

	return (
		<>
			<TouchableOpacity onPress={handleTapToView} activeOpacity={0.8}>
				<View 
					style={{
						backgroundColor: theme.background,
						borderWidth: 1,
						borderColor: theme.border,
						borderRadius: 12,
						padding: 4,
						marginTop: 8,
						overflow: 'hidden',
					}}
				>
					{/* Tap to view hint in top right */}
					<View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
						<Text style={{ color: theme.mutedForeground, fontSize: 12, backgroundColor: theme.background + 'E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
							Tap to view
						</Text>
					</View>

					{/* Scaled down invoice preview */}
					<View 
						style={{
							transform: [{ scale: 0.85 }],
							height: 380,
							width: '100%',
							alignItems: 'center',
							overflow: 'hidden',
							marginTop: -20,
							marginBottom: -20,
						}}
					>
						<InvoiceTemplateOne
							invoice={transformedInvoice}
							clientName={invoice.client_name}
							businessSettings={businessSettings}
						/>
					</View>
				</View>
			</TouchableOpacity>

			{/* Full-screen modal */}
			<InvoiceModal
				visible={showModal}
				onClose={() => setShowModal(false)}
				invoiceData={invoiceData}
				businessSettings={businessSettings}
				theme={theme}
			/>
		</>
	);
};

// Client Preview Component for Chat
const ClientPreview = ({ clientData, theme }: { clientData: any; theme: any }) => {
	const { client } = clientData;
	
	const handleClientTap = () => {
		router.push(`/(app)/(protected)/customers/${client.id}`);
	};

	const getInitials = (name: string) => {
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<TouchableOpacity onPress={handleClientTap} activeOpacity={0.8}>
			<View 
				style={{
					backgroundColor: theme.background,
					borderWidth: 1,
					borderColor: theme.border,
					borderRadius: 12,
					padding: 16,
					marginTop: 8,
				}}
			>
				{/* Tap to view hint */}
				<View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
					<Text style={{ color: theme.mutedForeground, fontSize: 12, backgroundColor: theme.background + 'E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
						Tap to view
					</Text>
				</View>

				{/* Client Header */}
				<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
					<View 
						style={{
							width: 48,
							height: 48,
							borderRadius: 24,
							backgroundColor: theme.primary,
							justifyContent: 'center',
							alignItems: 'center',
							marginRight: 12,
						}}
					>
						<Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
							{getInitials(client.name)}
						</Text>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ color: theme.foreground, fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>
							{client.name}
						</Text>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<User size={12} color={theme.mutedForeground} />
							<Text style={{ color: theme.mutedForeground, fontSize: 12, marginLeft: 4 }}>
								Client
							</Text>
						</View>
					</View>
				</View>

				{/* Client Details */}
				<View style={{ gap: 8 }}>
					{client.email && (
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<Mail size={14} color={theme.mutedForeground} />
							<Text style={{ color: theme.foreground, fontSize: 14, marginLeft: 8 }}>
								{client.email}
							</Text>
						</View>
					)}
					
					{client.phone && (
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<Phone size={14} color={theme.mutedForeground} />
							<Text style={{ color: theme.foreground, fontSize: 14, marginLeft: 8 }}>
								{client.phone}
							</Text>
						</View>
					)}
					
					{client.address_client && (
						<View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
							<MapPin size={14} color={theme.mutedForeground} style={{ marginTop: 2 }} />
							<Text style={{ color: theme.foreground, fontSize: 14, marginLeft: 8, flex: 1 }}>
								{client.address_client}
							</Text>
						</View>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);
};

export default function AiScreen() {
	const { user } = useSupabase();
	const { theme } = useTheme();
	const scrollViewRef = useRef<ScrollView>(null);
	const [inputText, setInputText] = useState('');
	const [showSetupMessage, setShowSetupMessage] = useState(false);

	// Use our custom hook for chat functionality - this might be the issue!
	const { 
		messages, 
		isLoading,
		conversation,
		sendMessage, 
		loadMessages, 
		clearConversation,
		error, 
		clearError 
	} = useAIChat();

	// Test OpenAI configuration on mount
	useEffect(() => {
		const testOpenAI = () => {
			console.log('[AI Screen] Testing OpenAI configuration...');
			const isConfigured = OpenAIService.isConfigured();
			console.log('[AI Screen] OpenAI configured:', isConfigured);
			
			if (!isConfigured) {
				setShowSetupMessage(true);
			}
		};

		testOpenAI();
	}, []);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messages.length > 0) {
			setTimeout(() => {
				scrollViewRef.current?.scrollToEnd({ animated: true });
			}, 100);
		}
	}, [messages]);

	// Show setup message if OpenAI is not configured, otherwise show welcome message
	const getWelcomeMessage = () => {
		if (showSetupMessage) {
			return {
				id: 'setup',
				conversation_id: '',
				role: 'assistant' as const,
				content: `Welcome to your AI assistant! To get started, you'll need to configure your OpenAI API key in your environment variables (EXPO_PUBLIC_OPENAI_API_KEY). Once configured, restart the app and I'll be ready to help you manage your invoices!`,
				message_type: 'text' as const,
				created_at: new Date().toISOString()
			};
		}
		
		return {
			id: 'welcome',
			conversation_id: '',
			role: 'assistant' as const,
			content: `Hello${user ? ` ${user.email?.split('@')[0]}` : ''}! I'm your AI assistant for invoice management. I can help you create invoices, search for existing ones, mark them as paid, and much more. What would you like to do?`,
			message_type: 'text' as const,
			created_at: new Date().toISOString()
		};
	};

	const displayMessages = messages.length > 0 ? messages : [getWelcomeMessage()];

	const handleSendMessage = async () => {
		if (!inputText.trim() || isLoading) return;

		// Check if API is configured before sending
		if (showSetupMessage) {
			Alert.alert(
				'Setup Required', 
				'Please configure your OpenAI API key in environment variables first.'
			);
			return;
		}

		const messageToSend = inputText.trim();
		setInputText(''); // Clear input immediately

		try {
			console.log('[AI Screen] Sending message via useAIChat...');
			await sendMessage(messageToSend);
			console.log('[AI Screen] Message sent successfully');
		} catch (error) {
			console.error('[AI Screen] Failed to send message:', error);
		}
	};

	const handleRefresh = async () => {
		try {
			console.log('[AI Screen] Clearing conversation and starting fresh...');
			
			// Clear the conversation and start fresh
			await clearConversation();
			
			console.log('[AI Screen] New conversation ready');
		} catch (error) {
			console.error('[AI Screen] Failed to clear conversation:', error);
			Alert.alert('Error', 'Failed to clear conversation');
		}
	};

	return (
		<SafeAreaView style={{ backgroundColor: theme.background, flex: 1 }} edges={['top', 'left', 'right']}>
			<KeyboardAvoidingView 
				style={{ flex: 1 }}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
			>
			{/* Header */}
			<View 
				style={{
					flex: 1,
					paddingHorizontal: 0,
					paddingTop: 16,
					backgroundColor: theme.background,
				}}
			>
				<View 
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						paddingHorizontal: 16,
						marginBottom: 16,
					}}
				>
					<Text 
						style={{
							fontSize: 30,
							fontWeight: "bold",
							color: theme.foreground,
						}}
					>
						AI Assistant
					</Text>
						{messages.length > 0 && (
						<TouchableOpacity onPress={handleRefresh} disabled={isLoading}>
							<RefreshCw 
								size={20} 
								color={isLoading ? theme.mutedForeground : theme.foreground} 
							/>
						</TouchableOpacity>
					)}
				</View>

				{/* Error Banner */}
				{error && (
					<View 
						style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
						className="mx-4 mb-4 p-3 rounded-lg border"
					>
						<Text style={{ color: '#DC2626', fontSize: 14 }}>
							{error}
						</Text>
						<TouchableOpacity onPress={clearError} className="mt-2">
							<Text style={{ color: '#DC2626', fontSize: 12, textDecorationLine: 'underline' }}>
								Dismiss
							</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Messages */}
				<ScrollView 
					ref={scrollViewRef}
					className="flex-1 px-4"
					contentContainerStyle={{ paddingBottom: 20 }}
					showsVerticalScrollIndicator={false}
				>
					{displayMessages.map((message) => (
						<View
							key={message.id}
							className={`mb-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
						>
							<View
								style={{
									backgroundColor: message.role === 'user' ? theme.primary : theme.card,
									maxWidth: '90%',
									paddingHorizontal: 16,
									paddingVertical: 12,
									borderRadius: 16,
									borderBottomRightRadius: message.role === 'user' ? 4 : 16,
									borderBottomLeftRadius: message.role === 'user' ? 16 : 4,
								}}
							>
								<Text
									style={{
										color: message.role === 'user' ? '#FFFFFF' : theme.foreground,
										fontSize: 16,
										lineHeight: 22,
									}}
								>
									{message.content}
								</Text>

									{/* Show invoice and client previews if this message has attachment data */}
									{message.role === 'assistant' && (message as any).attachments && (message as any).attachments.length > 0 && (
										(message as any).attachments.map((attachment: any, index: number) => {
										// Check if attachment has invoice data
										if (attachment && attachment.invoice && attachment.line_items) {
											return (
												<InvoicePreview 
														key={`invoice-${index}`}
													invoiceData={attachment} 
													theme={theme} 
												/>
											);
										}
											
											// Check if attachment has client data
											if (attachment && attachment.type === 'client' && attachment.client) {
												return (
													<ClientPreview 
														key={`client-${index}`}
														clientData={attachment} 
														theme={theme} 
													/>
												);
											}
											
										return null;
									})
								)}

								{/* Show timestamp for saved messages */}
								{message.id !== 'welcome' && message.id !== 'setup' && (
									<Text
										style={{
											color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : theme.mutedForeground,
											fontSize: 12,
											marginTop: 4,
										}}
									>
										{new Date(message.created_at).toLocaleTimeString([], { 
											hour: '2-digit', 
											minute: '2-digit' 
										})}
									</Text>
								)}
							</View>
						</View>
					))}

					{/* Loading indicator */}
					{isLoading && (
						<View className="items-start mb-4">
							<View
								style={{
									backgroundColor: theme.card,
									paddingHorizontal: 16,
									paddingVertical: 12,
									borderRadius: 16,
									borderBottomLeftRadius: 4,
								}}
							>
								<Text style={{ color: theme.mutedForeground }}>
									AI is thinking...
								</Text>
							</View>
						</View>
					)}
				</ScrollView>

				{/* Input Area */}
				<View 
					style={{ 
						backgroundColor: theme.card,
							padding: 12,
						borderTopWidth: 1,
						borderTopColor: theme.border
					}}
				>
					<View className="flex-row items-center space-x-3">
						{/* Voice Input Button (placeholder for now) */}
						<TouchableOpacity
							style={{
								padding: 12,
								borderRadius: 24,
								backgroundColor: theme.muted
							}}
							onPress={() => Alert.alert('Coming Soon', 'Voice input will be available in the next update!')}
							disabled={isLoading}
						>
							<Mic size={20} color={isLoading ? theme.mutedForeground : theme.foreground} />
						</TouchableOpacity>

						{/* Text Input */}
						<TextInput
							value={inputText}
							onChangeText={setInputText}
							placeholder={showSetupMessage ? "Configure API key first..." : "Type your message..."}
							placeholderTextColor={theme.mutedForeground}
							style={{
								flex: 1,
								backgroundColor: theme.background,
								color: theme.foreground,
								paddingHorizontal: 16,
								paddingVertical: 12,
								borderRadius: 24,
								borderWidth: 1,
								borderColor: theme.border,
								fontSize: 16,
							}}
							multiline
							maxLength={1000}
								returnKeyType="default"
							editable={!isLoading && !showSetupMessage}
						/>

						{/* Send Button */}
						<TouchableOpacity
							onPress={() => {
								console.log('[AI Screen] Send button pressed');
								console.log('[AI Screen] inputText.trim():', !!inputText.trim());
								console.log('[AI Screen] isLoading:', isLoading);
								console.log('[AI Screen] showSetupMessage:', showSetupMessage);
								console.log('[AI Screen] Button disabled:', !inputText.trim() || isLoading || showSetupMessage);
								handleSendMessage();
							}}
							disabled={!inputText.trim() || isLoading || showSetupMessage}
							style={{
								padding: 12,
								borderRadius: 24,
								backgroundColor: (inputText.trim() && !isLoading && !showSetupMessage) ? theme.primary : theme.muted
							}}
						>
							<Send 
								size={20} 
								color={(inputText.trim() && !isLoading && !showSetupMessage) ? '#FFFFFF' : theme.mutedForeground} 
							/>
						</TouchableOpacity>
					</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
