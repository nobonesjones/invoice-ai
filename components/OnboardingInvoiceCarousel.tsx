import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { OnboardingInvoiceItem } from './OnboardingInvoiceItem';
import { sampleInvoices } from './sampleInvoiceData';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Apple invites layout calculations
const ITEM_WIDTH = screenWidth * 0.5;
const ITEM_HEIGHT = ITEM_WIDTH * 1.6;
const SPACING = 16;
const TOTAL_SIZE = ITEM_WIDTH + SPACING;

// Auto-scroll settings
const AUTO_SCROLL_INTERVAL = 50; // Much faster interval for smooth motion
const SCROLL_SPEED = 1; // Pixels to move per interval
const AUTO_SCROLL_PAUSE_DURATION = 3000; // Pause for 3 seconds after user interaction

export const OnboardingInvoiceCarousel = () => {
  const offset = useSharedValue(0);
  const [activeImage, setActiveImage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
  const pauseTimer = useRef<NodeJS.Timeout | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Create infinite data by quintupling the array for more buffer
  const infiniteData = [
    ...sampleInvoices.map((item, index) => ({ ...item, key: `set1-${index}` })),
    ...sampleInvoices.map((item, index) => ({ ...item, key: `set2-${index}` })),
    ...sampleInvoices.map((item, index) => ({ ...item, key: `set3-${index}` })),
    ...sampleInvoices.map((item, index) => ({ ...item, key: `set4-${index}` })),
    ...sampleInvoices.map((item, index) => ({ ...item, key: `set5-${index}` })),
  ];

  // Start position (middle of the quintupled array)
  const startPosition = sampleInvoices.length * TOTAL_SIZE * 2; // Start at 3rd set
  const singleSetWidth = sampleInvoices.length * TOTAL_SIZE;

  // Auto-scroll function
  const autoScroll = () => {
    if (!isUserScrolling && scrollViewRef.current && singleSetWidth > 0) {
      const currentX = offset.value;
      const nextX = currentX + SCROLL_SPEED;
      
      // Simple boundary check - only reset if we're getting close to the actual end
      const totalContentWidth = singleSetWidth * 5;
      
      try {
        // Only reset if we're very close to the actual boundaries
        if (nextX >= totalContentWidth - 100) {
          // Near the end, jump back to middle
          const resetPosition = singleSetWidth * 2;
          scrollViewRef.current.scrollTo({
            x: resetPosition,
            animated: false,
          });
          offset.value = resetPosition;
        } else if (nextX <= 100) {
          // Near the beginning, jump to middle
          const resetPosition = singleSetWidth * 2;
          scrollViewRef.current.scrollTo({
            x: resetPosition,
            animated: false,
          });
          offset.value = resetPosition;
        } else {
          // Normal scroll
          scrollViewRef.current.scrollTo({
            x: nextX,
            animated: false,
          });
        }
      } catch (error) {
        console.log('Auto-scroll error:', error);
        // Simple reset to middle
        const safePosition = singleSetWidth * 2;
        scrollViewRef.current.scrollTo({
          x: safePosition,
          animated: false,
        });
        offset.value = safePosition;
      }
    }
  };

  // Start auto-scroll timer
  const startAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
    autoScrollTimer.current = setInterval(autoScroll, AUTO_SCROLL_INTERVAL);
  };

  // Stop auto-scroll timer
  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };

  // Handle user interaction pause
  const handleUserInteraction = () => {
    setIsUserScrolling(true);
    stopAutoScroll();
    
    // Clear existing pause timer
    if (pauseTimer.current) {
      clearTimeout(pauseTimer.current);
    }
    
    // Resume auto-scroll after pause duration
    pauseTimer.current = setTimeout(() => {
      setIsUserScrolling(false);
      startAutoScroll();
    }, AUTO_SCROLL_PAUSE_DURATION);
  };

  // Initialize scroll position and start auto-scroll
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: startPosition,
        animated: false,
      });
      offset.value = startPosition;
      
      // Start auto-scroll after initial setup
      setTimeout(() => {
        startAutoScroll();
      }, 1000);
    }, 100);

    // Cleanup timers on unmount
    return () => {
      stopAutoScroll();
      if (pauseTimer.current) {
        clearTimeout(pauseTimer.current);
      }
    };
  }, []);

  // Scroll handler to update offset
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      // User started scrolling
      runOnJS(handleUserInteraction)();
    },
    onMomentumEnd: (event) => {
      // Handle infinite loop reset with simple logic
      const scrollX = event.contentOffset.x;
      const totalContentWidth = singleSetWidth * 5;
      
      try {
        // Only reset if very close to actual boundaries
        if (scrollX >= totalContentWidth - 200) {
          // Near the end, reset to middle
          runOnJS(() => {
            scrollViewRef.current?.scrollTo({
              x: singleSetWidth * 2,
              animated: false,
            });
          })();
        } else if (scrollX <= 200) {
          // Near the beginning, reset to middle
          runOnJS(() => {
            scrollViewRef.current?.scrollTo({
              x: singleSetWidth * 2,
              animated: false,
            });
          })();
        }
      } catch (error) {
        console.log('Manual scroll error:', error);
      }
    },
  });

  // Track active image based on scroll position
  useAnimatedReaction(
    () => {
      const itemCenter = screenWidth / 2;
      // Calculate which actual invoice we're looking at (regardless of which set)
      const adjustedOffset = (offset.value + itemCenter) % singleSetWidth;
      const value = Math.floor(adjustedOffset / TOTAL_SIZE) % sampleInvoices.length;
      return Math.max(0, Math.min(sampleInvoices.length - 1, value));
    },
    (value) => {
      if (value !== activeImage && value >= 0 && value < sampleInvoices.length) {
        runOnJS(setActiveImage)(value);
      }
    }
  );

  return (
    <View style={styles.container}>
      {/* Clean light cream background */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fefdfb' }]} />

      {/* Very subtle background blur effect */}
      <View style={[StyleSheet.absoluteFillObject, { opacity: 0.08 }]}>
        <Animated.Image
          entering={FadeIn.duration(1000)}
          exiting={FadeOut.duration(1000)}
          key={`bg-${sampleInvoices[activeImage].id}`}
          source={sampleInvoices[activeImage].imageSource}
          style={{
            width: screenWidth,
            height: screenHeight,
          }}
          blurRadius={40}
          resizeMode="cover"
        />
      </View>

      {/* Marquee carousel */}
      <View style={styles.marqueeContainer}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={TOTAL_SIZE}
          snapToAlignment="center"
          decelerationRate="fast"
        >
          <View style={styles.itemsContainer}>
            {infiniteData.map((item, index) => (
              <OnboardingInvoiceItem
                key={item.key}
                item={item}
                index={index}
                offset={offset}
                totalImages={infiniteData.length}
                itemWidth={ITEM_WIDTH}
                itemHeight={ITEM_HEIGHT}
                totalSize={TOTAL_SIZE}
                screenWidth={screenWidth}
              />
            ))}
          </View>
        </Animated.ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marqueeContainer: {
    height: ITEM_HEIGHT + 100, // Extra space for rotation
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: 60 }], // Move carousel down by 60 pixels
  },
  scrollContent: {
    paddingHorizontal: (screenWidth - ITEM_WIDTH) / 2,
  },
  itemsContainer: {
    flexDirection: 'row',
    gap: SPACING,
  },
}); 