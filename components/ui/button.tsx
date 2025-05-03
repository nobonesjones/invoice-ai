import * as React from 'react';
import { Pressable, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof Pressable> {
  isLoading?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ children, className, isLoading, disabled, ...props }, ref) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <Pressable
      ref={ref}
      disabled={isLoading || disabled}
      className={cn(
        'flex-row items-center justify-center rounded-md py-2 px-4',
        'bg-black dark:bg-white',
        'h-12',
        (isLoading || disabled) && 'opacity-50',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={isDarkMode ? 'black' : 'white'} />
      ) : (
        <Text
          className={cn(
            'text-center font-semibold',
            'text-white dark:text-black'
          )}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
});
Button.displayName = 'Button';

export { Button };
