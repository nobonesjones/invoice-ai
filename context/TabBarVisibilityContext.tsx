import React, { createContext, useState, useContext, useCallback, ReactNode } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";

interface TabBarVisibilityContextType {
	isTabBarVisible: boolean;
	setIsTabBarVisible: (visible: boolean) => void;
}

const TabBarVisibilityContext = createContext<
	TabBarVisibilityContextType | undefined
>(undefined);

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const TabBarVisibilityProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [isTabBarVisible, setIsTabBarVisibleRaw] = useState(true);

	// Hiding the tab bar removes 86pt from the layout. Without this the content
	// underneath snaps to the new size on the next frame, which reads as a jump
	// every time a screen is opened or left. LayoutAnimation eases that reflow.
	const setIsTabBarVisible = useCallback((visible: boolean) => {
		setIsTabBarVisibleRaw((current) => {
			if (current !== visible) {
				LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
			}
			return visible;
		});
	}, []);

	return (
		<TabBarVisibilityContext.Provider
			value={{ isTabBarVisible, setIsTabBarVisible }}
		>
			{children}
		</TabBarVisibilityContext.Provider>
	);
};

export const useTabBarVisibility = () => {
	const context = useContext(TabBarVisibilityContext);
	if (context === undefined) {
		throw new Error(
			"useTabBarVisibility must be used within a TabBarVisibilityProvider",
		);
	}
	return context;
};
