import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Send, Mic, RefreshCw, FileText, Calendar, DollarSign, User, Mail, Phone, MapPin } from "lucide-react-native";
import { router } from 'expo-router';

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";
import { ChatService } from "@/services/chatService";
import { OpenAIService } from "@/services/openaiService";
import { useAIChat } from "@/hooks/useAIChat";
import SkiaInvoiceCanvas from "@/components/skia/SkiaInvoiceCanvas";
import { SkiaInvoiceCanvasSimple } from "@/components/skia/SkiaInvoiceCanvasSimple";
import { SkiaInvoiceCanvasWorking } from "@/components/skia/SkiaInvoiceCanvasWorking";
import { BusinessSettingsRow } from "./invoices/InvoiceTemplateOne";
import { InvoicePreviewModal, InvoicePreviewModalRef } from "@/components/InvoicePreviewModal";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Simple Invoice Modal using our new InvoicePreviewModal component

// Invoice Preview Component for Chat
const InvoicePreview = ({ invoiceData, theme }: { invoiceData: any; theme: any }) => {
	const { invoice, line_items, client_id } = invoiceData;
	const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
	const [fullClientData, setFullClientData] = useState<any>(null);
	const invoicePreviewModalRef = useRef<InvoicePreviewModalRef>(null);
	
	const { supabase } = useSupabase();
	
	// Load business settings and client data on mount and when client_id or invoice changes
	useEffect(() => {
		loadBusinessSettings();
		loadFullClientData();
	}, [client_id, invoice.id]); // Re-run when client_id or invoice.id changes

	const loadFullClientData = async () => {
		if (!client_id) {
			console.log('[AI Invoice Preview] No client_id provided, clearing client data');
			setFullClientData(null);
			return;
		}
		
		try {
			console.log('[AI Invoice Preview] Loading full client data for client_id:', client_id);
			console.log('[AI Invoice Preview] Invoice client_name for comparison:', invoice.client_name);
			
			const { data: clientData, error } = await supabase
				.from('clients')
				.select('*')
				.eq('id', client_id)
				.single();

			if (error) {
				console.error('Error loading client data:', error);
				// If we can't load client data, clear it to force fallback to invoice data
				setFullClientData(null);
			} else {
				console.log('[AI Invoice Preview] Loaded full client data:', clientData);
				console.log('[AI Invoice Preview] DB client name vs invoice client name:', clientData.name, 'vs', invoice.client_name);
				setFullClientData(clientData);
			}
		} catch (error) {
			console.error('[AI Invoice Preview] Error loading client data:', error);
			console.error('[AI Invoice Preview] Failed to load client for client_id:', client_id);
			setFullClientData(null);
		}
	};

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

	// DEBUG: Log the invoice data to see what fields are available
	console.log('[AI Invoice Preview] Available invoice fields:', Object.keys(invoice));
	console.log('[AI Invoice Preview] Full invoiceData structure:', invoiceData);
	console.log('[AI Invoice Preview] Invoice data:', {
		client_name: invoice.client_name,
		client_email: invoice.client_email,
		client_phone: invoice.client_phone,
		client_address: invoice.client_address,
		client_tax_number: invoice.client_tax_number,
		all_client_fields: Object.keys(invoice).filter(key => key.startsWith('client_'))
	});
	console.log('[AI Invoice Preview] client_id from invoiceData:', client_id);

	// Transform data for our modal - separate client from invoice like the invoice viewer
	const transformedInvoice = {
		...invoice,
		invoice_line_items: line_items || [],
	};

	// Use the full client data from database but prefer current invoice client name if different
	let transformedClient = null;
	if (fullClientData) {
		// Use database client data but update the name if invoice has a different one
		transformedClient = {
			...fullClientData,
			name: invoice.client_name || fullClientData.name, // Prefer invoice name
			email: invoice.client_email || fullClientData.email, // Prefer invoice email if available
		};
	} else if (invoice.client_name) {
		// Fallback to invoice data only
		transformedClient = {
			id: client_id,
			user_id: invoice.user_id,
			name: invoice.client_name,
			email: invoice.client_email,
			phone: invoice.client_phone || null,
			address_client: invoice.client_address || null,
			tax_number: invoice.client_tax_number || null,
			notes: null,
			avatar_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
	}

	// DEBUG: Log the transformed client to see what we're passing
	console.log('[AI Invoice Preview] Transformed client:', transformedClient);
	console.log('[AI Invoice Preview] Using full client data:', !!fullClientData);

	const handleTapToView = () => {
		invoicePreviewModalRef.current?.present();
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

					{/* Scaled down invoice preview - using exact same approach as InvoicePreviewModal */}
					<View 
						style={{
							height: 200,
							width: '100%',
							alignItems: 'center',
							justifyContent: 'center',
							overflow: 'hidden',
							marginTop: 10,
							marginBottom: 10,
						}}
					>
						{businessSettings && transformedInvoice ? (
							<View style={{
								transform: [{ scale: 0.6 }], // Slightly smaller than modal for chat preview
								marginLeft: -120, // Center the invoice by shifting left
							}}>
								<SkiaInvoiceCanvas
									renderSinglePage={0}
									style={{
										width: 200,
										height: 280,
										backgroundColor: 'white',
										borderRadius: 8,
										shadowColor: '#000',
										shadowOffset: { width: 0, height: 4 },
										shadowOpacity: 0.15,
										shadowRadius: 8,
										elevation: 5,
									}}
							invoice={transformedInvoice}
									business={businessSettings}
									client={transformedClient}
									currencySymbol={businessSettings?.currency_symbol || '$'}
									displaySettings={{
										show_business_logo: businessSettings?.show_business_logo ?? true,
										show_business_name: businessSettings?.show_business_name ?? true,
										show_business_address: businessSettings?.show_business_address ?? true,
										show_business_tax_number: businessSettings?.show_business_tax_number ?? true,
										show_notes_section: businessSettings?.show_notes_section ?? true,
									}}
								/>
							</View>
						) : (
							<View style={{
								width: 120,
								height: 168,
								backgroundColor: 'white',
								borderRadius: 8,
								justifyContent: 'center',
								alignItems: 'center',
								shadowColor: '#000',
								shadowOffset: { width: 0, height: 4 },
								shadowOpacity: 0.15,
								shadowRadius: 8,
								elevation: 5,
							}}>
								<Text style={{ color: '#666', fontSize: 12 }}>Loading...</Text>
							</View>
						)}
					</View>

				</View>
			</TouchableOpacity>

			{/* Invoice Preview Modal */}
			<InvoicePreviewModal
				ref={invoicePreviewModalRef}
				invoiceData={transformedInvoice}
				businessSettings={businessSettings}
				clientData={transformedClient}
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
					padding: 12,
					marginTop: 8,
				}}
			>
				{/* Tap to view hint */}
				<View style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}>
					<Text style={{ color: theme.mutedForeground, fontSize: 10, backgroundColor: theme.background + 'E6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
						Tap to view
					</Text>
				</View>

				{/* Client Header - Compact */}
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<View 
						style={{
							width: 32,
							height: 32,
							borderRadius: 16,
							backgroundColor: theme.primary,
							justifyContent: 'center',
							alignItems: 'center',
							marginRight: 10,
						}}
					>
						<Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
							{getInitials(client.name)}
						</Text>
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ color: theme.foreground, fontSize: 14, fontWeight: 'bold', marginBottom: 2 }}>
							{client.name}
						</Text>
					{client.email && (
							<Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
								{client.email}
							</Text>
						)}
						</View>
				</View>
			</View>
		</TouchableOpacity>
	);
};

// Removed SafeSkiaInvoiceCanvas - now using SkiaInvoiceCanvas directly with renderSinglePage prop

// Removed SimpleErrorBoundary - using SkiaInvoiceCanvas directly with proper error handling

export default function AiScreen() {
	const { user, supabase } = useSupabase();
	const { theme } = useTheme();
	const scrollViewRef = useRef<ScrollView>(null);
	const [inputText, setInputText] = useState('');
	const [showSetupMessage, setShowSetupMessage] = useState(false);
	const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);

	// Use our custom hook for chat functionality
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

	// Load business settings for currency context
	const loadBusinessSettings = async () => {
		if (!user?.id) return;
		
		try {
			console.log('[AI Screen] Loading business settings for currency context...');
			
			const { data: settings, error } = await supabase
				.from('business_settings')
				.select('*')
				.eq('user_id', user.id)
				.single();

			if (error) {
				console.log('[AI Screen] No business settings found, using default USD');
				// Default to USD if no settings found
				const defaultSettings: BusinessSettingsRow = {
					id: 'default',
					user_id: user.id,
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
				// Map currency_code to currency_symbol
				const getCurrencySymbol = (code: string) => {
					const mapping: Record<string, string> = {
						GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$', JPY: '¥',
						INR: '₹', CHF: 'Fr', CNY: '¥', NZD: 'NZ$', SEK: 'kr', NOK: 'kr',
						DKK: 'kr', SGD: 'S$', HKD: 'HK$'
					};
					if (!code) return '$';
					const normalized = code.split(' ')[0];
					return mapping[normalized] || '$';
				};
				
				const currencySymbol = getCurrencySymbol(settings.currency_code || 'USD');
				const enhancedSettings: BusinessSettingsRow = {
					...settings,
					currency: settings.currency_code || 'USD',
					currency_symbol: currencySymbol,
				};
				
				console.log('[AI Screen] Loaded currency:', enhancedSettings.currency, 'symbol:', currencySymbol);
				setBusinessSettings(enhancedSettings);
			}
		} catch (error) {
			console.error('[AI Screen] Error loading business settings:', error);
		}
	};

	// Load business settings and test OpenAI configuration on mount
	useEffect(() => {
		const initialize = async () => {
			// Load business settings for currency context
			await loadBusinessSettings();
			
			// Test OpenAI configuration
			console.log('[AI Screen] Testing OpenAI configuration...');
			const isConfigured = OpenAIService.isConfigured();
			console.log('[AI Screen] OpenAI configured:', isConfigured);
			
			if (!isConfigured) {
				setShowSetupMessage(true);
			}
		};

		if (user?.id) {
			initialize();
		}
	}, [user?.id]);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messages.length > 0) {
			setTimeout(() => {
				scrollViewRef.current?.scrollToEnd({ animated: true });
			}, 100);
		}
	}, [messages]);

	// Helper function to extract first name from user's display name
	const getFirstName = () => {
		if (!user) return '';
		
		// Try to get display name from user metadata first
		const displayName = user.user_metadata?.display_name;
		if (displayName && typeof displayName === 'string') {
			// Extract first name (everything before the first space)
			const firstName = displayName.trim().split(' ')[0];
			return firstName;
		}
		
		// Fallback to email username if no display name
		const emailName = user.email?.split('@')[0];
		if (emailName) {
			// Capitalize first letter
			return emailName.charAt(0).toUpperCase() + emailName.slice(1);
		}
		
		return '';
	};

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
		
		const firstName = getFirstName();
		const greeting = firstName ? `Hi ${firstName}` : 'Hello';
		
		return {
			id: 'welcome',
			conversation_id: '',
			role: 'assistant' as const,
			content: `${greeting}, I'm SupaAI your invoice assistant. I can help create, manage, update or chase unpaid invoices (and much more). You can type or send a voice note and I will understand. What can I help with?`,
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
			
			// Prepare currency context if business settings are loaded
			const currencyContext = businessSettings ? {
				currency: businessSettings.currency,
				symbol: businessSettings.currency_symbol
			} : undefined;

			await sendMessage(messageToSend, currencyContext);
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
		<BottomSheetModalProvider>
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
		</BottomSheetModalProvider>
	);
}
