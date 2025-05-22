declare module "@env" {
	export interface ProcessEnv {
		EXPO_PUBLIC_OPENAI_API_KEY: string;
		EXPO_PUBLIC_GEMINI_API_KEY: string;
	}
}

// If using process.env
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			EXPO_PUBLIC_OPENAI_API_KEY: string;
			EXPO_PUBLIC_GEMINI_API_KEY: string;
		}
	}
}
