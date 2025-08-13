import { Session, User, SupabaseClient } from "@supabase/supabase-js";
import { SplashScreen } from "expo-router";
import { createContext, useContext, useEffect, useState } from "react";

import { supabase } from "@/config/supabase";
import CustomSplashScreen from "@/components/CustomSplashScreen";

SplashScreen.preventAutoHideAsync();

type SupabaseContextProps = {
	supabase: SupabaseClient;
	user: User | null;
	session: Session | null;
	initialized?: boolean;
	signUp: (email: string, password: string) => Promise<any>;
	signInWithPassword: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
};

type SupabaseProviderProps = {
	children: React.ReactNode;
};

export const SupabaseContext = createContext<SupabaseContextProps>({
	supabase,
	user: null,
	session: null,
	initialized: false,
	signUp: async () => ({}),
	signInWithPassword: async () => {},
	signOut: async () => {},
});

export const useSupabase = () => {
	const context = useContext(SupabaseContext);
	return context;
};

export const SupabaseProvider = ({ children }: SupabaseProviderProps) => {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [initialized, setInitialized] = useState<boolean>(false);
	const [loadingProgress, setLoadingProgress] = useState<number>(0);
	const [showCustomSplash, setShowCustomSplash] = useState<boolean>(true);

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
