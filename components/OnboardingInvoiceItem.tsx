import React from 'react';
import { Image, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';

interface InvoiceItemProps {
  item: {
    id: string;
    clientName: string;
    amount: string;
    dueDate: string;
    status: 'paid' | 'pending' | 'overdue';
    items: Array<{ name: string; quantity: number; price: string }>;
    backgroundColor: string;
    accentColor: string;
    imageSource: any;
  };
  index: number;
  offset: SharedValue<number>;
  totalImages: number;
  itemWidth: number;
  itemHeight: number;
  totalSize: number;
  screenWidth: number;
}

export const OnboardingInvoiceItem: React.FC<InvoiceItemProps> = ({
  item,
  index,
  offset,
  totalImages,
  itemWidth,
  itemHeight,
  totalSize,
  screenWidth,
}) => {
  
  // Exact Apple invites animation logic
  const animatedRotate = useAnimatedStyle(() => {
    const itemPosition = index * totalSize - screenWidth - totalSize / 2;
    const totalSizeAll = totalImages * totalSize;

    const range =
      ((itemPosition - offset.value) % totalSizeAll) + screenWidth + totalSize / 2;
    
    // Subtle rotation effect (-5° to +5°)
    const rotate = interpolate(
      range,
      [-totalSize, (screenWidth - totalSize) / 2, screenWidth],
      [-5, 0, 5]
    );

    // Subtle Y translation for the "floating" effect
    const translateY = interpolate(
      range,
      [-totalSize, (screenWidth - totalSize) / 2, screenWidth],
      [10, -5, 10]
    );

    return {
      transform: [{ rotate: `${rotate}deg` }, { translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        animatedRotate,
        {
          width: itemWidth,
          height: itemHeight,
          overflow: 'hidden',
          // Beautiful drop shadow
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.25,
              shadowRadius: 20,
            },
            android: {
              elevation: 12,
            },
          }),
        },
      ]}
    >
      <Image
        source={item.imageSource}
        style={styles.image}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
}); 