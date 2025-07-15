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

	const signUp = async (email: string, password: string) => {
		// Sign up the user
		const { error: signUpError } = await supabase.auth.signUp({
			email,
			password,
		});
		if (signUpError) {
			throw signUpError;
		}

		// After successful sign-up, sign in the user
		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (signInError) {
			throw signInError;
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
			// Simulate loading progress
			setLoadingProgress(20);
			
			const { data: { session } } = await supabase.auth.getSession();
			setLoadingProgress(60);
			
			setSession(session);
			setUser(session ? session.user : null);
			setLoadingProgress(90);
			
			// Small delay to show 100% completion
			setTimeout(() => {
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
		
		// Hide custom splash screen after a brief delay
		setTimeout(() => {
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
