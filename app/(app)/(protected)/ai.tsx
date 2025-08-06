import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Animated } from "react-native";
import * as Clipboard from 'expo-clipboard';
import * as Haptics from "expo-haptics";
import { Send, Mic, RefreshCw, FileText, Calendar, DollarSign, User, Mail, Phone, MapPin, Activity, X, Check } from "lucide-react-native";
import TranscribeButton, { TranscribeButtonRef } from "@/components/TranscribeButton";
import VoiceChatButton from "@/components/VoiceChatButton";
import { VoiceModal } from "@/components/VoiceModal";
import { useRouter, useFocusEffect } from 'expo-router';

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { useTheme } from "@/context/theme-provider";
import { ChatService } from "@/services/chatService";
// Using secure Edge Function version
import { OpenAIServiceSecure as OpenAIService } from "@/services/openaiServiceSecure";
import { useAIChat } from "@/hooks/useAIChat";
import { ChatMessage } from "@/services/chatService";
import UserContextService from "@/services/userContextService";
import SkiaInvoiceCanvas from "@/components/skia/SkiaInvoiceCanvas";
import { SkiaInvoiceCanvasWorking } from "@/components/skia/SkiaInvoiceCanvasWorking";
import SkiaInvoiceCanvasModern from "@/components/skia/SkiaInvoiceCanvasModern";
import SkiaInvoiceCanvasClean from "@/components/skia/SkiaInvoiceCanvasClean";
import SkiaInvoiceCanvasSimple from "@/components/skia/SkiaInvoiceCanvasSimple";
import { BusinessSettingsRow } from "./invoices/InvoiceTemplateOne";
import { InvoicePreviewModal, InvoicePreviewModalRef } from "@/components/InvoicePreviewModal";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DEFAULT_DESIGN_ID } from '@/constants/invoiceDesigns';

// Simple Invoice Modal using our new InvoicePreviewModal component

// Estimate Preview Component for Chat
const EstimatePreview = ({ estimateData, theme }: { estimateData: any; theme: any }) => {
	const { estimate: initialEstimate, line_items: initialLineItems, client_id } = estimateData;
	const [estimate, setEstimate] = useState(initialEstimate);
	const [lineItems, setLineItems] = useState(initialLineItems);
	const [businessSettings, setBusinessSettings] = useState<(BusinessSettingsRow & {
		currency: string;
		currency_symbol: string;
		show_business_logo?: boolean;
		show_business_name?: boolean;
		show_business_address?: boolean;
		show_business_tax_number?: boolean;
		show_notes_section?: boolean;
	}) | null>(null);
	const [fullClientData, setFullClientData] = useState<any>(null);
	const estimatePreviewModalRef = useRef<InvoicePreviewModalRef>(null);

	// Get the correct invoice design component based on estimate design type
	const getEstimateDesignComponent = () => {
		const designType = estimate?.estimate_template || DEFAULT_DESIGN_ID;
		// console.log('[AI EstimatePreview] Selected design type for estimate:', designType);
		
		switch (designType.toLowerCase()) {
			case 'modern':
				// console.log('[AI EstimatePreview] Using SkiaInvoiceCanvasModern');
				return SkiaInvoiceCanvasModern;
			case 'clean':
				// console.log('[AI EstimatePreview] Using SkiaInvoiceCanvasClean');
				return SkiaInvoiceCanvasClean;
			case 'simple':
				// console.log('[AI EstimatePreview] Using SkiaInvoiceCanvasSimple');
				return SkiaInvoiceCanvasSimple;
			case 'classic':
			default:
				// console.log('[AI EstimatePreview] Using SkiaInvoiceCanvas (classic)');
				return SkiaInvoiceCanvas;
		}
	};
	
	const { supabase } = useSupabase();
	
	// Load business settings, client data, and fresh estimate data on mount and when client_id or estimate changes
	useEffect(() => {
		loadBusinessSettings();
		loadFullClientData();
		loadFreshEstimateData();
	}, [client_id, initialEstimate.id]); // Re-run when client_id or estimate.id changes

	// Refresh when app comes back to foreground (user returns from editing)
	useEffect(() => {
		const handleAppStateChange = (nextAppState: string) => {
			if (nextAppState === 'active') {
				// console.log('[AI Estimate Preview] App became active - refreshing data and client info');
				loadFreshEstimateData();
				loadFullClientData(); // Also refresh client data
			}
		};

		const { AppState } = require('react-native');
		const subscription = AppState.addEventListener('change', handleAppStateChange);

		return () => subscription?.remove();
	}, [initialEstimate.id]);

	// Refresh when screen comes into focus (user navigates back to AI chat)
	useFocusEffect(
		React.useCallback(() => {
			// console.log('[AI Estimate Preview] Screen focused - refreshing data and client info');
			loadFreshEstimateData();
			loadFullClientData(); // Also refresh client data
		}, [initialEstimate.id])
	);

	// Periodic refresh for client data changes (useful when AI updates client info)
	useEffect(() => {
		const interval = setInterval(() => {
			// console.log('[AI Estimate Preview] Periodic client data refresh');
			loadFullClientData();
		}, 10000); // Refresh client data every 10 seconds

		return () => clearInterval(interval);
	}, [client_id]);

	const loadFreshEstimateData = async () => {
		try {
			// console.log('[AI Estimate Preview] Loading fresh estimate data for ID:', initialEstimate.id);
			
			// Add validation for initialEstimate.id
			if (!initialEstimate?.id) {
				console.warn('[AI Estimate Preview] No estimate ID available, skipping fresh data load');
				return;
			}
			
			const { data: freshEstimateData, error } = await supabase
				.from('estimates')
				.select(`
					*,
					estimate_line_items(*)
				`)
				.eq('id', initialEstimate.id)
				.maybeSingle();

			if (error) {
				console.error('[AI Estimate Preview] Error loading fresh estimate data:', error);
				console.error('[AI Estimate Preview] Estimate ID that failed:', initialEstimate.id);
				return;
			}

			// If estimate was deleted, gracefully handle it
			if (!freshEstimateData) {
				// console.log('[AI Estimate Preview] Estimate no longer exists - it may have been deleted');
				return;
			}

			if (freshEstimateData) {
				// console.log('[AI Estimate Preview] Loaded fresh estimate data - template:', freshEstimateData.estimate_template, 'color:', freshEstimateData.accent_color);
				
				// Always update with fresh data to ensure we have the latest design/color
				setEstimate(freshEstimateData);
				
				// Update line items if they exist
				if (freshEstimateData.estimate_line_items) {
					setLineItems(freshEstimateData.estimate_line_items);
				}
			}
		} catch (error) {
			console.error('[AI Estimate Preview] Error loading fresh estimate data:', error);
		}
	};

	const loadFullClientData = async () => {
		if (!client_id) {
			// console.log('[AI Estimate Preview] No client_id provided, clearing client data');
			setFullClientData(null);
			return;
		}
		
		try {
			// console.log('[AI Estimate Preview] Loading full client data for client_id:', client_id);
			// console.log('[AI Estimate Preview] Estimate client_name for comparison:', estimate.client_name);
			
			const { data: clientData, error } = await supabase
				.from('clients')
				.select('*')
				.eq('id', client_id)
				.single();

			if (error) {
				console.error('Error loading client data:', error);
				setFullClientData(null);
			} else {
				// console.log('[AI Estimate Preview] Loaded full client data:', clientData);
				setFullClientData(clientData);
			}
		} catch (error) {
			console.error('[AI Estimate Preview] Error loading client data:', error);
			setFullClientData(null);
		}
	};

	const loadBusinessSettings = async () => {
		try {
			// console.log('[AI Estimate Preview] Loading business settings for user:', estimate.user_id);
			
			// Fetch actual business settings from the database
			const { data: businessSettings, error } = await supabase
				.from('business_settings')
				.select('*')
				.eq('user_id', estimate.user_id)
				.single();

			if (error) {
				console.error('Error loading business settings:', error);
				// Fall back to default settings
				const defaultSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					id: 'default',
					user_id: estimate.user_id,
					business_name: 'Your Business',
					business_address: 'Your Address',
					business_logo_url: null,
					business_email: null,
					business_phone: null,
					business_website: null,
					currency_code: 'USD',
					tax_number: '',
					tax_name: '',
					default_tax_rate: null,
					auto_apply_tax: false,
					auto_update_default_design: null,
					default_accent_color: null,
					default_invoice_design: null,
					estimate_terminology: null,
					invoice_reference_format: null,
					region: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					currency: 'USD',
					currency_symbol: '$',
					show_business_logo: true,
					show_business_name: true,
					show_business_address: true,
					show_business_tax_number: true,
					show_notes_section: true,
				};
				setBusinessSettings(defaultSettings);
			} else {
				// console.log('[AI Estimate Preview] Loaded business settings:', businessSettings);
				
				// Map currency_code to currency_symbol
				const currencySymbol = getCurrencySymbol(businessSettings.currency_code || 'USD');
				
				const enhancedSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					...businessSettings,
					currency: businessSettings.currency_code || 'USD',
					currency_symbol: currencySymbol,
					show_business_logo: businessSettings.show_business_logo ?? true,
					show_business_name: businessSettings.show_business_name ?? true,
					show_business_address: businessSettings.show_business_address ?? true,
					show_business_tax_number: businessSettings.show_business_tax_number ?? true,
					show_notes_section: businessSettings.show_notes_section ?? true,
				};
				
				setBusinessSettings(enhancedSettings);
			}
		} catch (error) {
			console.error('Error loading business settings:', error);
			const defaultSettings: BusinessSettingsRow & {
				currency: string;
				currency_symbol: string;
				show_business_logo?: boolean;
				show_business_name?: boolean;
				show_business_address?: boolean;
				show_business_tax_number?: boolean;
				show_notes_section?: boolean;
			} = {
				id: 'default',
				user_id: estimate.user_id,
				business_name: 'Your Business',
				business_address: 'Your Address',
				business_logo_url: null,
				business_email: null,
				business_phone: null,
				business_website: null,
				currency_code: 'USD',
				tax_number: '',
				tax_name: '',
				default_tax_rate: null,
				auto_apply_tax: false,
				auto_update_default_design: null,
				default_accent_color: null,
				default_invoice_design: null,
				estimate_terminology: null,
				invoice_reference_format: null,
				region: null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				currency: 'USD',
				currency_symbol: '$',
				show_business_logo: true,
				show_business_name: true,
				show_business_address: true,
				show_business_tax_number: true,
				show_notes_section: true,
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
		const normalized = code.split(' ')[0];
		return mapping[normalized] || '$';
	};

	// Transform estimate data to work with invoice canvas components
	const transformedEstimate = {
		...estimate,
		// Transform estimate fields to invoice fields for canvas compatibility
		invoice_number: estimate?.estimate_number,
		invoice_date: estimate?.estimate_date,
		due_date: estimate?.valid_until_date,
		invoice_line_items: lineItems || [],
	};

	// Get the dynamic estimate component
	const EstimateDesignComponent = getEstimateDesignComponent();

	// Use the full client data from database but prefer current estimate client name if different
	let transformedClient = null;
	if (fullClientData) {
		transformedClient = {
			...fullClientData,
			name: estimate.client_name || fullClientData.name,
			email: estimate.client_email || fullClientData.email,
		};
	} else if (estimate.client_name) {
		transformedClient = {
			id: client_id,
			user_id: estimate.user_id,
			name: estimate.client_name,
			email: estimate.client_email,
			phone: estimate.client_phone || null,
			address_client: estimate.client_address || null,
			tax_number: estimate.client_tax_number || null,
			notes: null,
			avatar_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
	}

	const handleTapToView = () => {
		estimatePreviewModalRef.current?.present();
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
				<Text style={{ color: theme.mutedForeground }}>Loading estimate preview...</Text>
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

					{/* Scaled down estimate preview */}
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
						{businessSettings && transformedEstimate ? (
							<View style={{
								transform: [{ scale: 0.6 }],
								marginLeft: -120,
							}}>
								<EstimateDesignComponent
									key={`${estimate?.estimate_template || 'default'}-${estimate?.accent_color || '#14B8A6'}`}
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
									invoice={transformedEstimate}
									business={businessSettings}
									client={transformedClient}
									currencySymbol={businessSettings?.currency_symbol || '$'}
									accentColor={estimate?.accent_color || '#14B8A6'}
									documentType="estimate"
									estimateTerminology={'estimate'}
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

			{/* Estimate Preview Modal */}
			<InvoicePreviewModal
				ref={estimatePreviewModalRef}
				invoiceData={transformedEstimate}
				businessSettings={businessSettings}
				clientData={transformedClient}
				documentType="estimate"
				invoiceId={estimate?.id}
				onSaveComplete={() => {
					// console.log('[AI Estimate Preview] Save completed - refreshing estimate and client data');
					// Reload fresh estimate data to get the updated design/color
					loadFreshEstimateData();
					loadFullClientData();
				}}
			/>
		</>
	);
};

// Invoice Preview Component for Chat
const InvoicePreview = ({ invoiceData, theme }: { invoiceData: any; theme: any }) => {
	const { invoice: initialInvoice, line_items: initialLineItems, client_id } = invoiceData;
	const [invoice, setInvoice] = useState(initialInvoice);
	const [lineItems, setLineItems] = useState(initialLineItems);
	const [isDeleted, setIsDeleted] = useState(false);
	const [businessSettings, setBusinessSettings] = useState<(BusinessSettingsRow & {
		currency: string;
		currency_symbol: string;
		show_business_logo?: boolean;
		show_business_name?: boolean;
		show_business_address?: boolean;
		show_business_tax_number?: boolean;
		show_notes_section?: boolean;
	}) | null>(null);
	const [fullClientData, setFullClientData] = useState<any>(null);
	const invoicePreviewModalRef = useRef<InvoicePreviewModalRef>(null);

	// Get the correct invoice design component based on invoice design type
	const getInvoiceDesignComponent = () => {
		const designType = invoice?.invoice_design || DEFAULT_DESIGN_ID;
		// console.log('[AI InvoicePreview] Selected design type for invoice:', designType);
		
		switch (designType.toLowerCase()) {
			case 'modern':
				// console.log('[AI InvoicePreview] Using SkiaInvoiceCanvasModern');
				return SkiaInvoiceCanvasModern;
			case 'clean':
				// console.log('[AI InvoicePreview] Using SkiaInvoiceCanvasClean');
				return SkiaInvoiceCanvasClean;
			case 'simple':
				// console.log('[AI InvoicePreview] Using SkiaInvoiceCanvasSimple');
				return SkiaInvoiceCanvasSimple;
			case 'classic':
			default:
				// console.log('[AI InvoicePreview] Using SkiaInvoiceCanvas (classic)');
				return SkiaInvoiceCanvas;
		}
	};
	
	const { supabase } = useSupabase();
	
	// Load business settings, client data, and fresh invoice data on mount and when client_id or invoice changes
	useEffect(() => {
		loadBusinessSettings();
		loadFullClientData();
		loadFreshInvoiceData();
	}, [client_id, initialInvoice.id]); // Re-run when client_id or invoice.id changes

	// Refresh when app comes back to foreground (user returns from editing)
	useEffect(() => {
		const handleAppStateChange = (nextAppState: string) => {
			if (nextAppState === 'active') {
				// console.log('[AI Invoice Preview] App became active - refreshing data and client info');
				loadFreshInvoiceData();
				loadFullClientData(); // Also refresh client data
			}
		};

		const { AppState } = require('react-native');
		const subscription = AppState.addEventListener('change', handleAppStateChange);

		return () => subscription?.remove();
	}, [initialInvoice.id]);

	// Refresh when screen comes into focus (user navigates back to AI chat)
	useFocusEffect(
		React.useCallback(() => {
			// console.log('[AI Invoice Preview] Screen focused - refreshing data and client info');
			loadFreshInvoiceData();
			loadFullClientData(); // Also refresh client data
		}, [initialInvoice.id])
	);

	// Periodic refresh for client data changes (useful when AI updates client info)
	useEffect(() => {
		const interval = setInterval(() => {
			// console.log('[AI Invoice Preview] Periodic client data refresh');
			loadFullClientData();
		}, 10000); // Refresh client data every 10 seconds

		return () => clearInterval(interval);
	}, [client_id]);

	const loadFreshInvoiceData = async () => {
		try {
			// console.log('[AI Invoice Preview] Loading fresh invoice data for ID:', initialInvoice.id);
			
			// Add validation for initialInvoice.id
			if (!initialInvoice?.id) {
				console.warn('[AI Invoice Preview] No invoice ID available, skipping fresh data load');
				return;
			}
			
			const { data: freshInvoiceData, error } = await supabase
				.from('invoices')
				.select(`
					*,
					invoice_line_items(*)
				`)
				.eq('id', initialInvoice.id)
				.maybeSingle();

			if (error) {
				console.error('[AI Invoice Preview] Error loading fresh invoice data:', error);
				console.error('[AI Invoice Preview] Invoice ID that failed:', initialInvoice.id);
				return;
			}

			// If invoice was deleted, gracefully handle it
			if (!freshInvoiceData) {
				console.warn('[AI Invoice Preview] Invoice no longer exists - it may have been deleted');
				setIsDeleted(true);
				return;
			}

			if (freshInvoiceData) {
				// console.log('[AI Invoice Preview] Loaded fresh invoice data - design:', freshInvoiceData.invoice_design, 'color:', freshInvoiceData.accent_color);
				
				// Always update with fresh data to ensure we have the latest design/color
				setInvoice(freshInvoiceData);
				
				// Update line items if they exist
				if (freshInvoiceData.invoice_line_items) {
					setLineItems(freshInvoiceData.invoice_line_items);
				}
			}
		} catch (error) {
			console.error('[AI Invoice Preview] Error loading fresh invoice data:', error);
		}
	};

	const loadFullClientData = async () => {
		if (!client_id) {
			// console.log('[AI Invoice Preview] No client_id provided, clearing client data');
			setFullClientData(null);
			return;
		}
		
		try {
			// console.log('[AI Invoice Preview] Loading full client data for client_id:', client_id);
			// console.log('[AI Invoice Preview] Invoice client_name for comparison:', invoice.client_name);
			
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
				// console.log('[AI Invoice Preview] Loaded full client data:', clientData);
				// console.log('[AI Invoice Preview] DB client name vs invoice client name:', clientData.name, 'vs', invoice.client_name);
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
			// console.log('[AI Invoice Preview] Loading business settings for user:', invoice.user_id);
			
			// Fetch actual business settings from the database
			const { data: businessSettings, error } = await supabase
				.from('business_settings')
				.select('*')
				.eq('user_id', invoice.user_id)
				.single();

			if (error) {
				console.error('Error loading business settings:', error);
				// Fall back to default settings if no business settings found
				const defaultSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					id: 'default',
					user_id: invoice.user_id,
					business_name: 'Your Business',
					business_address: 'Your Address',
					business_logo_url: null,
					business_email: null,
					business_phone: null,
					business_website: null,
					currency_code: 'USD',
					tax_number: '',
					tax_name: '',
					default_tax_rate: null,
					auto_apply_tax: false,
					auto_update_default_design: null,
					default_accent_color: null,
					default_invoice_design: null,
					estimate_terminology: null,
					invoice_reference_format: null,
					region: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					currency: 'USD',
					currency_symbol: '$',
					show_business_logo: true,
					show_business_name: true,
					show_business_address: true,
					show_business_tax_number: true,
					show_notes_section: true,
				};
				setBusinessSettings(defaultSettings);
			} else {
				// Use actual business settings from database
				// console.log('[AI Invoice Preview] Loaded business settings:', businessSettings);
				
				// Map currency_code to currency_symbol
				const currencySymbol = getCurrencySymbol(businessSettings.currency_code || 'USD');
				
				const enhancedSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					...businessSettings,
					currency: businessSettings.currency_code || 'USD',
					currency_symbol: currencySymbol,
					show_business_logo: businessSettings.show_business_logo ?? true,
					show_business_name: businessSettings.show_business_name ?? true,
					show_business_address: businessSettings.show_business_address ?? true,
					show_business_tax_number: businessSettings.show_business_tax_number ?? true,
					show_notes_section: businessSettings.show_notes_section ?? true,
				};
				
				// console.log('[AI Invoice Preview] Using currency symbol:', currencySymbol, 'for currency:', businessSettings.currency_code);
				setBusinessSettings(enhancedSettings);
			}
		} catch (error) {
			console.error('Error loading business settings:', error);
			// Fall back to default settings on error
			const defaultSettings: BusinessSettingsRow & {
				currency: string;
				currency_symbol: string;
				show_business_logo?: boolean;
				show_business_name?: boolean;
				show_business_address?: boolean;
				show_business_tax_number?: boolean;
				show_notes_section?: boolean;
			} = {
				id: 'default',
				user_id: invoice.user_id,
				business_name: 'Your Business',
				business_address: 'Your Address',
				business_logo_url: null,
				business_email: null,
				business_phone: null,
				business_website: null,
				currency_code: 'USD',
				tax_number: '',
				tax_name: '',
				default_tax_rate: null,
				auto_apply_tax: false,
				auto_update_default_design: null,
				default_accent_color: null,
				default_invoice_design: null,
				estimate_terminology: null,
				invoice_reference_format: null,
				region: null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				currency: 'USD',
				currency_symbol: '$',
				show_business_logo: true,
				show_business_name: true,
				show_business_address: true,
				show_business_tax_number: true,
				show_notes_section: true,
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
	// console.log('[AI Invoice Preview] Available invoice fields:', Object.keys(invoice));
	// console.log('[AI Invoice Preview] Full invoiceData structure:', invoiceData);
	// console.log('[AI Invoice Preview] Invoice data:', {
	//	client_name: invoice.client_name,
	//	client_email: invoice.client_email,
	//	client_phone: invoice.client_phone,
	//	client_address: invoice.client_address,
	//	client_tax_number: invoice.client_tax_number,
	//	all_client_fields: Object.keys(invoice).filter(key => key.startsWith('client_'))
	// });
	// console.log('[AI Invoice Preview] client_id from invoiceData:', client_id);

	// Transform data for our modal - separate client from invoice like the invoice viewer
	const transformedInvoice = {
		...invoice,
		invoice_line_items: lineItems || [],
	};

	// Get the dynamic invoice component
	const InvoiceDesignComponent = getInvoiceDesignComponent();

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
	// console.log('[AI Invoice Preview] Transformed client:', transformedClient);
	// console.log('[AI Invoice Preview] Using full client data:', !!fullClientData);

	const handleTapToView = () => {
		if (isDeleted) {
			Alert.alert(
				'Invoice Deleted', 
				'This invoice has been deleted and is no longer available.',
				[{ text: 'OK' }]
			);
			return;
		}
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
						borderColor: isDeleted ? '#FECACA' : theme.border,
						borderRadius: 12,
						padding: 4,
						marginTop: 8,
						overflow: 'hidden',
						opacity: isDeleted ? 0.6 : 1,
					}}
				>
					{/* Tap to view hint in top right */}
					<View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
						<Text style={{ 
							color: isDeleted ? '#DC2626' : theme.mutedForeground, 
							fontSize: 12, 
							backgroundColor: isDeleted ? '#FEF2F2' : theme.background + 'E6', 
							paddingHorizontal: 6, 
							paddingVertical: 2, 
							borderRadius: 4,
							fontWeight: isDeleted ? 'bold' : 'normal'
						}}>
							{isDeleted ? 'Deleted' : 'Tap to view'}
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
																	<InvoiceDesignComponent
										key={`${invoice?.invoice_design || 'default'}-${invoice?.accent_color || '#14B8A6'}`}
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
										accentColor={invoice?.accent_color || '#14B8A6'}
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
				invoiceId={invoice?.id}
				onSaveComplete={() => {
					// console.log('[AI Invoice Preview] Save completed - refreshing invoice and client data');
					// Reload fresh invoice data to get the updated design/color
					loadFreshInvoiceData();
					loadFullClientData();
				}}
			/>
		</>
	);
};

// Client Preview Component for Chat
const ClientPreview = ({ clientData, theme, router }: { clientData: any; theme: any; router: any }) => {
	const { client } = clientData;
	
	const handleClientTap = () => {
		// console.log('Client tap - navigate to client:', client.id);
		router.push(`/customers/${client.id}`);
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
	const router = useRouter();
	const scrollViewRef = useRef<ScrollView>(null);
	const transcribeButtonRef = useRef<TranscribeButtonRef>(null);
	
	// State
	const [inputText, setInputText] = useState('');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [listeningDots, setListeningDots] = useState(1);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [transcribingDots, setTranscribingDots] = useState(1);
	const [businessSettings, setBusinessSettings] = useState<any>(null);
	const [showSetupMessage, setShowSetupMessage] = useState(false);
	const [currentAudioLevel, setCurrentAudioLevel] = useState(0);
	const [userContext, setUserContext] = useState<any>(null);

	// Animated values for waveform
	const waveformAnims = useRef([
		new Animated.Value(0.3),
		new Animated.Value(0.5),
		new Animated.Value(0.8),
		new Animated.Value(0.4),
		new Animated.Value(0.6),
		new Animated.Value(0.9),
		new Animated.Value(0.3),
		new Animated.Value(0.7),
	]).current;

	// Use our custom hook for chat functionality
	const { 
		messages: aiMessages, 
		isLoading: aiIsLoading,
		statusMessage, // This contains the real AI processing status
		conversation,
		sendMessage, 
		loadMessages, 
		clearConversation,
		error: aiError, 
		clearError: aiClearError 
	} = useAIChat();

	// Load user context for first invoice detection and currency
	const loadUserContext = async () => {
		if (!user?.id) return;
		
		try {
			const context = await UserContextService.getUserContext(user.id);
			console.log('[AI Screen] Loaded user context:', context);
			setUserContext(context);
		} catch (error) {
			console.error('[AI Screen] Error loading user context:', error);
		}
	};

	// Load business settings for currency context
	const loadBusinessSettings = async () => {
		if (!user?.id) return;
		
		try {
			// console.log('[AI Screen] Loading business settings for currency context...');
			
			const { data: settings, error } = await supabase
				.from('business_settings')
				.select('*')
				.eq('user_id', user.id)
				.single();

			if (error) {
				// console.log('[AI Screen] No business settings found, using default USD');
				// Default to USD if no settings found
				const defaultSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					id: 'default',
					user_id: user.id,
					business_name: 'Your Business',
					business_address: 'Your Address',
					business_logo_url: null,
					business_email: null,
					business_phone: null,
					business_website: null,
					currency_code: 'USD',
					tax_number: '',
					tax_name: '',
					default_tax_rate: null,
					auto_apply_tax: false,
					auto_update_default_design: null,
					default_accent_color: null,
					default_invoice_design: null,
					estimate_terminology: null,
					invoice_reference_format: null,
					region: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					currency: 'USD',
					currency_symbol: '$',
					show_business_logo: true,
					show_business_name: true,
					show_business_address: true,
					show_business_tax_number: true,
					show_notes_section: true,
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
				const enhancedSettings: BusinessSettingsRow & {
					currency: string;
					currency_symbol: string;
					show_business_logo?: boolean;
					show_business_name?: boolean;
					show_business_address?: boolean;
					show_business_tax_number?: boolean;
					show_notes_section?: boolean;
				} = {
					...settings,
					currency: settings.currency_code || 'USD',
					currency_symbol: currencySymbol,
					show_business_logo: settings.show_business_logo ?? true,
					show_business_name: settings.show_business_name ?? true,
					show_business_address: settings.show_business_address ?? true,
					show_business_tax_number: settings.show_business_tax_number ?? true,
					show_notes_section: settings.show_notes_section ?? true,
				};
				
				// console.log('[AI Screen] Loaded currency:', enhancedSettings.currency, 'symbol:', currencySymbol);
				setBusinessSettings(enhancedSettings);
			}
		} catch (error) {
			console.error('[AI Screen] Error loading business settings:', error);
		}
	};

	// Load business settings and test OpenAI configuration on mount
	useEffect(() => {
		const initialize = async () => {
			// Load user context for first invoice detection and currency
			await loadUserContext();
			
			// Load business settings for currency context
			await loadBusinessSettings();
			
			// Test OpenAI configuration
			// console.log('[AI Screen] Testing OpenAI configuration...');
			const isConfigured = OpenAIService.isConfigured();
			// console.log('[AI Screen] OpenAI configured:', isConfigured);
			
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
		if (aiMessages.length > 0) {
			setTimeout(() => {
				scrollViewRef.current?.scrollToEnd({ animated: true });
			}, 100);
		}
	}, [aiMessages]);

	// Animated listening dots effect
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (isRecording) {
			interval = setInterval(() => {
				setListeningDots(prev => prev >= 3 ? 1 : prev + 1);
			}, 500);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [isRecording]);

	// Animated transcribing dots effect
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (isTranscribing) {
			interval = setInterval(() => {
				setTranscribingDots(prev => prev >= 3 ? 1 : prev + 1);
			}, 500);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [isTranscribing]);

	// Real-time waveform animation based on audio levels
	useEffect(() => {
		// Remove waveform animation logic - keeping it simple
		if (!isRecording) {
			// Reset to default values when not recording
			waveformAnims.forEach(anim => anim.setValue(0.3));
		}
	}, [isRecording]);

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
		
		// Check if this is the user's first invoice
		if (userContext?.isFirstInvoice) {
			const currencySymbol = userContext.currencySymbol || '$';
			const examples = UserContextService.getCurrencyExamples(currencySymbol);
			const example1 = examples[0];
			const example2 = examples[1];
			
			return {
				id: 'welcome-first-invoice',
				conversation_id: '',
				role: 'assistant' as const,
				content: `${greeting}, I'm SuperAI your invoice and estimate assistant! 🎉

I'll help you create your first invoice! Just tell me:
• Who it's for (name/email)
• What you're charging for

Example: '${example1}'
or '${example2}'`,
				message_type: 'text' as const,
				created_at: new Date().toISOString()
			};
		}
		
		// Regular welcome message
		return {
			id: 'welcome',
			conversation_id: '',
			role: 'assistant' as const,
			content: `${greeting}, I'm SuperAI your invoice and estimate assistant. I can create, manage, update, invoices and estimates (and much more). Just type or record a voice note to tell me what to do first.`,
			message_type: 'text' as const,
			created_at: new Date().toISOString()
		};
	};

	const displayMessages = aiMessages.length > 0 ? aiMessages : [getWelcomeMessage()];

	const handleSendMessage = async () => {
		if (!inputText.trim() || aiIsLoading) return;

		// Check if API is configured before sending
		if (showSetupMessage) {
			Alert.alert(
				'Setup Required', 
				'Please configure your OpenAI API key in environment variables first.'
			);
			return;
		}

		const messageToSend = inputText.trim();
		
		// Clear input immediately to prevent the text from staying
		// Store it in case we need to restore on error
		setInputText('');

		try {
			// console.log('[AI Screen] Sending message via useAIChat...');
			
			// Prepare user context if loaded
			const contextForMessage = userContext ? {
				currency: userContext.currency,
				symbol: userContext.currencySymbol,
				isFirstInvoice: userContext.isFirstInvoice,
				hasLogo: userContext.hasLogo
			} : undefined;

			await sendMessage(messageToSend, contextForMessage);
			
			// console.log('[AI Screen] Message sent successfully');
		} catch (error) {
			console.error('[AI Screen] Failed to send message:', error);
			// Restore the text on error so user can retry
			setInputText(messageToSend);
		}
	};

	const handleRefresh = async () => {
		try {
			// console.log('[AI Screen] Clearing conversation and starting fresh...');
			
			// Clear the conversation and start fresh
			await clearConversation();
			
			// console.log('[AI Screen] New conversation ready');
		} catch (error) {
			console.error('[AI Screen] Failed to clear conversation:', error);
			Alert.alert('Error', 'Failed to clear conversation');
		}
	};

	// Handle voice transcription
	const handleTranscript = (transcript: string) => {
		// console.log('[AI Screen] Received transcript:', transcript);
		setInputText(transcript);
		setIsTranscribing(false);
	};

	const handleRecordingStateChange = (recording: boolean) => {
		// console.log('[AI Screen] Recording state changed:', recording);
		// console.log('[AI Screen] Previous isRecording state:', isRecording);
		setIsRecording(recording);
		// console.log('[AI Screen] New isRecording state will be:', recording);
		
		// Reset listening dots when recording stops
		if (!recording) {
			setListeningDots(1);
		}
	};

	const handleProcessing = (processing: boolean) => {
		// console.log('[AI Screen] Processing state changed:', processing);
		setIsTranscribing(processing);
	};

	// Voice modal handlers
	const handleOpenVoiceModal = () => {
		setIsVoiceModalVisible(true);
	};

	const handleCloseVoiceModal = () => {
		setIsVoiceModalVisible(false);
	};

	// Handle voice messages from VoiceChatButton
	const handleVoiceMessage = (transcript: string) => {
		if (transcript.trim()) {
			setInputText(transcript);
			// Optionally auto-send the voice message
			// handleSendMessage();
		}
	};

	// Generate dynamic placeholder text
	const getPlaceholderText = () => {
		if (showSetupMessage) {
			return "Configure API key first...";
		}
		if (isRecording) {
			const dots = '.'.repeat(listeningDots);
			return `Listening${dots}`;
		}
		if (isTranscribing) {
			const dots = '.'.repeat(transcribingDots);
			return `Transcribing${dots}`;
		}
		return "Type or speak your message...";
	};

	// Enhance real AI status messages with emojis and visual flair
	const getEnhancedStatusText = () => {
		if (!statusMessage) return "🤔 SuperAI is thinking...";
		
		const message = statusMessage.toLowerCase();
		
		// Map different status messages to appropriate emojis
		if (message.includes('initializing')) {
			return `🚀 ${statusMessage}`;
		} else if (message.includes('connecting')) {
			return `🔗 ${statusMessage}`;
		} else if (message.includes('thinking') || message.includes('analyzing')) {
			return `🤔 ${statusMessage}`;
		} else if (message.includes('processing') || message.includes('working')) {
			return `⚡ ${statusMessage}`;
		} else if (message.includes('creating') || message.includes('generating')) {
			return `✨ ${statusMessage}`;
		} else if (message.includes('searching') || message.includes('finding')) {
			return `🔍 ${statusMessage}`;
		} else if (message.includes('updating') || message.includes('modifying')) {
			return `🔄 ${statusMessage}`;
		} else if (message.includes('executing') || message.includes('action')) {
			return `⚙️ ${statusMessage}`;
		} else if (message.includes('completing') || message.includes('finishing')) {
			return `🎯 ${statusMessage}`;
		} else if (message.includes('client')) {
			return `👤 ${statusMessage}`;
		} else if (message.includes('invoice')) {
			return `📄 ${statusMessage}`;
		} else if (message.includes('estimate')) {
			return `📋 ${statusMessage}`;
		} else {
			// Default emoji for any other status
			return `🔄 ${statusMessage}`;
		}
	};

	// Function to render text with bold formatting
	const renderFormattedText = (text: string, textColor: string) => {
		const parts = text.split(/(\*\*.*?\*\*)/g);
		
		return (
			<Text
				style={{
					color: textColor,
					fontSize: 16,
					lineHeight: 22,
				}}
			>
				{parts.map((part, index) => {
					if (part.startsWith('**') && part.endsWith('**')) {
						// Remove the ** and make bold
						const boldText = part.slice(2, -2);
						return (
							<Text key={index} style={{ fontWeight: 'bold' }}>
								{boldText}
							</Text>
						);
					}
					return part;
				})}
			</Text>
		);
	};

	const handleAudioLevel = useCallback((level: number) => {
		setCurrentAudioLevel(level);
	}, []);

	const handleCancelRecording = async () => {
		// console.log('[AI Screen] Cancel recording button pressed');
		// console.log('[AI Screen] transcribeButtonRef.current:', !!transcribeButtonRef.current);
		// console.log('[AI Screen] Available methods:', transcribeButtonRef.current ? Object.keys(transcribeButtonRef.current) : 'none');
		
		try {
			if (transcribeButtonRef.current) {
				// console.log('[AI Screen] Calling cancelRecording...');
				await transcribeButtonRef.current.cancelRecording();
				// console.log('[AI Screen] Cancel recording completed');
			} else {
				// console.log('[AI Screen] TranscribeButton ref not available');
			}
		} catch (error) {
			console.error('[AI Screen] Error canceling recording:', error);
		}
	};

	const handleFinishRecording = async () => {
		// console.log('[AI Screen] Finish recording button pressed');
		// console.log('[AI Screen] Current isRecording state:', isRecording);
		// console.log('[AI Screen] transcribeButtonRef.current:', !!transcribeButtonRef.current);
		// console.log('[AI Screen] Available methods:', transcribeButtonRef.current ? Object.keys(transcribeButtonRef.current) : 'none');
		
		try {
			if (transcribeButtonRef.current) {
				// console.log('[AI Screen] Calling stopRecording...');
				await transcribeButtonRef.current.stopRecording();
				// console.log('[AI Screen] Finish recording completed');
				
				// Force UI update in case the callback doesn't fire
				setTimeout(() => {
					// console.log('[AI Screen] Force checking recording state after stop...');
					if (isRecording) {
						// console.log('[AI Screen] Recording state still true, forcing to false');
						setIsRecording(false);
						setListeningDots(1);
					}
				}, 100);
			} else {
				// console.log('[AI Screen] TranscribeButton ref not available');
			}
		} catch (error) {
			console.error('[AI Screen] Error finishing recording:', error);
			// Force reset UI state on error
			setIsRecording(false);
			setListeningDots(1);
		}
	};

	const handleLongPressMessage = async (messageContent: string) => {
		try {
			// Remove markdown formatting for cleaner copy
			const cleanContent = messageContent.replace(/\*\*(.*?)\*\*/g, '$1');
			await Clipboard.setStringAsync(cleanContent);
			Alert.alert('Copied!', 'Message copied to clipboard');
		} catch (error) {
			console.error('Failed to copy message:', error);
			Alert.alert('Error', 'Failed to copy message');
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
						{aiMessages.length > 0 && (
						<TouchableOpacity onPress={handleRefresh} disabled={aiIsLoading}>
							<RefreshCw 
								size={20} 
								color={aiIsLoading ? theme.mutedForeground : theme.foreground} 
							/>
						</TouchableOpacity>
					)}
				</View>

				{/* Error Banner */}
				{aiError && (
					<View 
						style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
						className="mx-4 mb-4 p-3 rounded-lg border"
					>
						<Text style={{ color: '#DC2626', fontSize: 14 }}>
							{aiError}
						</Text>
						<TouchableOpacity onPress={aiClearError} className="mt-2">
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
							<TouchableOpacity
								onLongPress={() => handleLongPressMessage(message.content)}
								activeOpacity={0.8}
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
								{renderFormattedText(
									message.content,
									message.role === 'user' ? '#FFFFFF' : theme.foreground
								)}

									{/* Show invoice, estimate, and client previews if this message has attachment data */}
									{message.role === 'assistant' && (message as any).attachments && (message as any).attachments.length > 0 && (
										(message as any).attachments.map((attachment: any, index: number) => {
										// DEBUG LOGGING
										// console.log('=== ATTACHMENT DEBUG ===');
										// console.log('Message ID:', message.id);
										// console.log('Attachment index:', index);
										// console.log('Attachment keys:', Object.keys(attachment || {}));
										// console.log('Has attachment.invoice:', !!attachment?.invoice);
										// console.log('Has attachment.line_items:', !!attachment?.line_items);
										// console.log('Has attachment.estimate:', !!attachment?.estimate);
										// console.log('Attachment type:', attachment?.type);
										// console.log('Full attachment:', JSON.stringify(attachment, null, 2));
										
										// Check if attachment has invoice data
										if (attachment && attachment.invoice && attachment.line_items) {
											// console.log('✅ Rendering InvoicePreview');
											return (
												<InvoicePreview 
														key={`invoice-${index}`}
													invoiceData={attachment} 
													theme={theme} 
												/>
											);
										}
										
										// Check if attachment has estimate data
										if (attachment && attachment.estimate && attachment.line_items) {
											// console.log('✅ Rendering EstimatePreview');
											return (
												<EstimatePreview 
													key={`estimate-${index}`}
													estimateData={attachment} 
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
														router={router} 
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
							</TouchableOpacity>
						</View>
					))}

					{/* Loading indicator - dynamic thinking stages */}
					{aiIsLoading && (
						<View className="items-start mb-4">
							<View
								style={{
									backgroundColor: theme.card,
									paddingHorizontal: 16,
									paddingVertical: 12,
									borderRadius: 16,
									borderBottomLeftRadius: 4,
									borderWidth: 1,
									borderColor: theme.primary + '20', // Subtle primary color border
								}}
							>
								<Text style={{ 
									color: theme.primary, // Use primary color for thinking text
									fontSize: 16,
									fontWeight: '500'
								}}>
									{getEnhancedStatusText()}
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
					{/* Always render TranscribeButton to maintain ref connection */}
					<View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
						<TranscribeButton
							ref={transcribeButtonRef}
							onTranscript={handleTranscript}
							disabled={aiIsLoading || showSetupMessage}
							onRecordingStateChange={handleRecordingStateChange}
							onProcessing={handleProcessing}
							onAudioLevel={handleAudioLevel}
						/>
					</View>

					{isRecording ? (
						/* Recording Interface with centralized listening text and control buttons */
						<View 
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								backgroundColor: theme.background,
								borderRadius: 24,
								borderWidth: 1,
								borderColor: theme.primary,
								paddingHorizontal: 16,
								paddingVertical: 12,
								minHeight: 44,
								gap: 12,
							}}
						>
							{/* Cancel Button */}
							<TouchableOpacity
								onPress={() => {
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
									handleCancelRecording();
								}}
								style={{
									width: 32,
									height: 32,
									borderRadius: 16,
									backgroundColor: theme.destructive,
									alignItems: 'center',
									justifyContent: 'center',
								}}
								activeOpacity={0.7}
							>
								<X size={18} color="#FFFFFF" />
							</TouchableOpacity>

							{/* Centralized Listening Text with Animated Dots */}
							<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
								<Text style={{
									color: theme.primary,
									fontSize: 16,
									fontWeight: '600',
									textAlign: 'center',
								}}>
									Listening{'.'.repeat(listeningDots)}
								</Text>
							</View>

							{/* Finish/Check Button */}
							<TouchableOpacity
								onPress={() => {
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
									handleFinishRecording();
								}}
								style={{
									width: 32,
									height: 32,
									borderRadius: 16,
									backgroundColor: '#22c55e', // Green color
									alignItems: 'center',
									justifyContent: 'center',
								}}
								activeOpacity={0.7}
							>
								<Check size={18} color="#FFFFFF" />
							</TouchableOpacity>
						</View>
					) : (
						/* Normal Input Interface */
						<View className="flex-row items-center" style={{ gap: 8 }}>
							{/* Text Input - optimized width to fit well next to transcribe button */}
							<TextInput
								value={inputText}
								onChangeText={setInputText}
								placeholder={getPlaceholderText()}
								placeholderTextColor={theme.mutedForeground}
								style={{
									flex: 0.8,
									backgroundColor: theme.background,
									color: theme.foreground,
									paddingHorizontal: 16,
									paddingVertical: 12,
									borderRadius: 24,
									borderWidth: 1,
									borderColor: theme.border,
									fontSize: 16,
									minHeight: 44,
								}}
								multiline
								maxLength={1000}
								returnKeyType="default"
								editable={!aiIsLoading && !showSetupMessage}
							/>

							{/* Right side buttons - 20% width for single button */}
							<View style={{ flex: 0.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
								{/* Show voice buttons when no text, send button when there is text */}
								{!inputText.trim() ? (
									<>
										{/* Visible Voice Transcribe Button - for quick transcription */}
										<TouchableOpacity
											onPress={() => {
												// console.log('[AI Screen] Visible mic button pressed');
												// console.log('[AI Screen] transcribeButtonRef.current:', !!transcribeButtonRef.current);
												// console.log('[AI Screen] Current isRecording state:', isRecording);
												if (!aiIsLoading && !showSetupMessage) {
													Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
												}
												transcribeButtonRef.current?.startRecording();
											}}
											disabled={aiIsLoading || showSetupMessage}
											style={{
												width: 44,
												height: 44,
												borderRadius: 22,
												backgroundColor: theme.primary,
												alignItems: 'center',
												justifyContent: 'center',
												opacity: (aiIsLoading || showSetupMessage) ? 0.5 : 1
											}}
										>
											<Mic size={20} color="#FFFFFF" />
										</TouchableOpacity>
									</>
								) : (
									/* Send Button - shown when there is text, centered */
									<View style={{ flex: 1, alignItems: 'center' }}>
										<TouchableOpacity
											onPress={() => {
												// console.log('[AI Screen] Send button pressed');
												// console.log('[AI Screen] inputText.trim():', !!inputText.trim());
												// console.log('[AI Screen] aiIsLoading:', aiIsLoading);
												// console.log('[AI Screen] showSetupMessage:', showSetupMessage);
												// console.log('[AI Screen] Button disabled:', !inputText.trim() || aiIsLoading || showSetupMessage);
												if (inputText.trim() && !aiIsLoading && !showSetupMessage) {
													Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
												}
												handleSendMessage();
											}}
											disabled={!inputText.trim() || aiIsLoading || showSetupMessage}
											style={{
												width: 44,
												height: 44,
												borderRadius: 22,
												backgroundColor: (inputText.trim() && !aiIsLoading && !showSetupMessage) ? theme.primary : theme.muted,
												alignItems: 'center',
												justifyContent: 'center'
											}}
										>
											<Send 
												size={20} 
												color={(inputText.trim() && !aiIsLoading && !showSetupMessage) ? '#FFFFFF' : theme.mutedForeground} 
											/>
										</TouchableOpacity>
									</View>
								)}
							</View>
						</View>
					)}
					</View>
				</View>
			</KeyboardAvoidingView>
			
			{/* Voice Modal */}
			<VoiceModal
				isVisible={isVoiceModalVisible}
				onClose={handleCloseVoiceModal}
				businessSettings={businessSettings}
			/>
		</SafeAreaView>
		</BottomSheetModalProvider>
	);
}
