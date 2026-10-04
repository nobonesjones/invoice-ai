import { Session, User, SupabaseClient } from "@supabase/supabase-js";
import { SplashScreen } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { supabase } from "@/config/supabase";
import CustomSplashScreen from "@/components/CustomSplashScreen";

SplashScreen.preventAutoHideAsync();

type SupabaseContextProps = {
	supabase: SupabaseClient;
	user: User | null;
	session: Session | null;
	initialized?: boolean;
	signUp: (email: string, password: string) => Promise<void>;
	signInWithPassword: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
};

type SupabaseProviderProps = {
	children: React.ReactNode;
};

export const SupabaseContext = createContext<SupabaseContextProps>({
	supabase: supabase,
	user: null,
	session: null,
	initialized: false,
	signUp: async () => {},
	signInWithPassword: async () => {},
	signOut: async () => {},
});

export const useSupabase = () => useContext(SupabaseContext);

export const SupabaseProvider = ({ children }: SupabaseProviderProps) => {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [initialized, setInitialized] = useState<boolean>(false);
	const [loadingProgress, setLoadingProgress] = useState<number>(0);
	const [showCustomSplash, setShowCustomSplash] = useState<boolean>(true);
	const ensuredDefaultsRef = useRef<string | null>(null);

	const signUp = async (email: string, password: string) => {
		// Sign up the user
		const { data, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
		});
		if (signUpError) {
			throw signUpError;
		}

		// Check if email confirmation is required
		if (data?.user && !data.session) {
			// User created but needs email confirmation
			console.log('[SupabaseProvider] User created successfully, email confirmation required');
			// Return a special response that indicates success but needs confirmation
			return { 
				success: true, 
				requiresEmailConfirmation: true,
				message: 'Please check your email to confirm your account'
			};
		}

		// If we have a session, the user is already confirmed (or confirmation is disabled)
		if (data?.session) {
			console.log('[SupabaseProvider] User signed up and logged in successfully');
			setSession(data.session);
			setUser(data.user);
			return { 
				success: true, 
				requiresEmailConfirmation: false 
			};
		}
	};

	const signInWithPassword = async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) {
			throw error;
		}
	};

	const signOut = async () => {
		const { error } = await supabase.auth.signOut();
		if (error) {
			throw error;
		}
	};

	useEffect(() => {
		const initializeApp = async () => {
			console.log('[SupabaseProvider] Starting initialization...');
			// Simulate loading progress
			setLoadingProgress(20);
			
			const { data: { session } } = await supabase.auth.getSession();
			console.log('[SupabaseProvider] Session retrieved:', !!session);
			setLoadingProgress(60);
			
			setSession(session);
			setUser(session ? session.user : null);
			setLoadingProgress(90);
			
			// Small delay to show 100% completion
			setTimeout(() => {
				console.log('[SupabaseProvider] Setting progress to 100% and initialized to true');
				setLoadingProgress(100);
				setInitialized(true);
			}, 200);
		};

		initializeApp();

	supabase.auth.onAuthStateChange((_event, session) => {
		setSession(session);
		setUser(session ? session.user : null);
		if (!session?.user) {
			ensuredDefaultsRef.current = null;
		}
	});
	}, []);

	useEffect(() => {
		if (!initialized) return;
		
		console.log('[SupabaseProvider] App initialized, hiding splash screen...');
		// Hide custom splash screen after a brief delay
		setTimeout(() => {
			console.log('[SupabaseProvider] Hiding custom splash and Expo splash');
			setShowCustomSplash(false);
			SplashScreen.hideAsync();
		}, 800);
	}, [initialized]);

	useEffect(() => {
		const ensureBusinessDefaults = async () => {
			if (!user?.id) return;
			if (ensuredDefaultsRef.current === user.id) return;

			try {
				const { data, error } = await supabase
					.from('business_settings')
					.select('default_invoice_design, default_accent_color')
					.eq('user_id', user.id)
					.maybeSingle();

				if (error) {
					console.warn('[SupabaseProvider] Failed to load business_settings:', error.message);
					return;
				}

				if (!data) {
					const { error: insertError } = await supabase.from('business_settings').insert({
						user_id: user.id,
						business_name: null,
						business_address: null,
						business_email: user.email,
						business_phone: null,
						currency_code: 'USD',
						tax_name: 'Tax',
						default_tax_rate: 0,
						auto_apply_tax: false,
						business_logo_url: null,
						default_invoice_design: 'clean',
						default_accent_color: '#1E40AF',
					});

					if (insertError) {
						console.warn('[SupabaseProvider] Failed to insert business_settings defaults:', insertError.message);
						return;
					}
				} else {
					const updates: Record<string, any> = {};
					if (data.default_invoice_design !== 'clean') {
						updates.default_invoice_design = 'clean';
					}
					if (!data.default_accent_color || data.default_accent_color.toUpperCase() !== '#1E40AF') {
						updates.default_accent_color = '#1E40AF';
					}
					if (Object.keys(updates).length > 0) {
						updates.updated_at = new Date().toISOString();
						const { error: updateError } = await supabase
							.from('business_settings')
							.update(updates)
							.eq('user_id', user.id);
						if (updateError) {
							console.warn('[SupabaseProvider] Failed to update business_settings defaults:', updateError.message);
							return;
						}
					}
				}

				ensuredDefaultsRef.current = user.id;
			} catch (error: any) {
				console.warn('[SupabaseProvider] Error ensuring business defaults:', error?.message || error);
			}
		};

		ensureBusinessDefaults();
	}, [supabase, user?.id, user?.email]);

	return (
		<SupabaseContext.Provider
			value={{
				supabase,
				user,
				session,
				initialized,
				signUp,
				signInWithPassword,
				signOut,
			}}
		>
			{showCustomSplash && (
				<CustomSplashScreen 
					loadingProgress={loadingProgress}
					onLoadingComplete={() => setShowCustomSplash(false)}
				/>
			)}
			{children}
		</SupabaseContext.Provider>
	);
};
