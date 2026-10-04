import React, { createContext, useState, useContext, useCallback, ReactNode } from "react";

interface TabBarVisibilityContextType {
	isTabBarVisible: boolean;
	setIsTabBarVisible: (visible: boolean) => void;
}

const TabBarVisibilityContext = createContext<
	TabBarVisibilityContextType | undefined
>(undefined);

export const TabBarVisibilityProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [isTabBarVisible, setIsTabBarVisibleRaw] = useState(true);

	// No animation on purpose: an eased fade made the bar arrive after the pop
	// transition. Screens toggle it right as a transition starts (see
	// hooks/useHideTabBar.ts), so an instant change is what looks right.
	const setIsTabBarVisible = useCallback((visible: boolean) => {
		setIsTabBarVisibleRaw(visible);
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
