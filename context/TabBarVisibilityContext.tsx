import React, { createContext, useState, useContext, ReactNode } from "react";

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
	const [isTabBarVisible, setIsTabBarVisible] = useState(true);

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
