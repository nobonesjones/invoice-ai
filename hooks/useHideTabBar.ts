// Hide the tab bar while a full-screen route (viewer, create, customer detail)
// is on top of a tab, and bring it back the moment that route starts to close.
//
// focus/blur alone are not enough: the native stack only updates navigation
// state when a swipe-back gesture finishes, so the bar came back after the
// list was already on screen. transitionStart fires when a closing transition
// begins, gesture included; gestureCancel undoes it if the swipe is abandoned.
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

export function useHideTabBar() {
  const navigation = useNavigation<any>();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useEffect(() => {
    const subs = [
      navigation.addListener('focus', () => setIsTabBarVisible(false)),
      navigation.addListener('blur', () => setIsTabBarVisible(true)),
      navigation.addListener('transitionStart', (e: any) => {
        if (e?.data?.closing) setIsTabBarVisible(true);
      }),
      navigation.addListener('gestureCancel', () => setIsTabBarVisible(false)),
    ];
    if (navigation.isFocused()) setIsTabBarVisible(false);
    return () => {
      subs.forEach((unsubscribe) => unsubscribe());
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);
}
