import * as React from 'react';
import { Pressable, Text, ActivityIndicator, useColorScheme } from 'react-native';
import { cn } from '@/lib/utils';
import { colors } from '@/constants/colors';

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
        'flex-row items-center justify-center rounded-xl py-3.5 px-4',
        'bg-primary dark:bg-primary',
        'h-14',
        (isLoading || disabled) && 'opacity-50',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={isDarkMode ? colors.dark.primaryForeground : colors.light.primaryForeground} />
      ) : (
        <Text
          className={cn(
            'text-center font-semibold',
            'text-primaryForeground dark:text-primaryForeground'
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
