import * as React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native"; 

import * as Slot from "../primitives/slot"; 
import { SlottableTextProps, TextRef } from "../primitives/types"; 

import { cn } from "@/lib/utils"; 

// const TextClassContext = React.createContext<string | undefined>(undefined); 

const Text = React.forwardRef<
	TextRef, 
	SlottableTextProps 
>(
	({ className, asChild = false, ...props }, ref) => { 
		const Component = asChild ? Slot.Text : RNText; 
		return (
			<Component 
				className={cn( 
					"text-foreground web:select-text", 
					className, 
				)} 
				ref={ref}
				{...props} 
			/>
		);
	},
);
Text.displayName = "Text";

export { Text }; 
