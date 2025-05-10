Usage
Here is a simple usage of the Bottom Sheet Modal, with non-scrollable content. For more scrollable usage please read Scrollables.

import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';

const App = () => {
  // ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // callbacks
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  // renders
  return (
      <GestureHandlerRootView style={styles.container}>
        <BottomSheetModalProvider>
          <Button
            onPress={handlePresentModalPress}
            title="Present Modal"
            color="black"
          />
          <BottomSheetModal
            ref={bottomSheetModalRef}
            onChange={handleSheetChanges}
          >
            <BottomSheetView style={styles.contentContainer}>
              <Text>Awesome 🎉</Text>
            </BottomSheetView>
        </BottomSheetModal>
        </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
});

export default App;

Props
Bottom Sheet Modal inherits all Bottom Sheet props except for animateOnMount & containerHeight and also it introduces its own props:

Configuration
name
Modal name to help identify the modal for later on.

type	default	required
string	generated unique key	NO
stackBehavior
Available only on v3, for now.

Defines the stack behavior when modal mounts.

push it will mount the modal on top of the current one.
switch it will minimize the current modal then mount the new one.
replace it will dismiss the current modal then mount the new one.
type	default	required
'push' | 'switch' | 'replace'	'switch'	NO
enableDismissOnClose
Dismiss the modal when it is closed, this will unmount the modal.

type	default	required
boolean	true	NO
Callbacks
onDismiss
Callback when the modal dismissed (unmounted).

type onDismiss = () => void;

type	default	required
function	null	NO
Components
containerComponent
Component to be placed as a bottom sheet container, this is to place the bottom sheet at the very top layer of your application when using FullWindowOverlay from React Native Screens. read more

type	default	required
React.ReactNode	undefined	NO
Methods
Bottom Sheet Modal inherits all Bottom Sheet methods and also it introduces its own methods.

These methods are accessible using the bottom sheet modal reference:

import React, { useRef } from 'react';
import {BottomSheetModal} from '@gorhom/bottom-sheet';

const App = () => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const handlePresentPress = () => bottomSheetModalRef.current.present()
  return (
    <>
      <Button title="Present Sheet" onPress={handlePresentPress} />
      <BottomSheetModal ref={bottomSheetModalRef}>
    </>
  )
}


present
Mount and present the bottom sheet modal to the initial snap point.

type present = (
  // Data to be passed to the modal.
  data?: any
) => void;

dismiss
Close and unmount the bottom sheet modal.

type dismiss = (
  // AnimationConfigs snap animation configs.
  animationConfigs?: WithSpringConfig | WithTimingConfig
) => void;

Hooks
useBottomSheetModal
This hook provides modal functionalities only, for sheet functionalities please look at Bottom Sheet Hooks.

This hook works at any component in BottomSheetModalProvider.

import React from 'react';
import { View, Button } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';

const SheetContent = () => {
  const { dismiss, dismissAll } = useBottomSheetModal();

  return (
    <View>
      <Button onPress={dismiss}>
    </View>
  )
}

dismiss
type dismiss = (key?: string) => void;

Dismiss a modal by its name/key, if key is not provided, then it will dismiss the last presented modal.

dismissAll
type dismissAll = () => void;

Dismiss all mounted/presented modals.

Keyboard Handling
Keyboard handling is one of the main feature of BottomSheet v4, thanks to the effort of the community to spot issues, test and help to debug the implementation on both platform iOS & Android.

To handle the keyboard appearance, I have simplified the approach by creating a pre-integrated TextInput called BottomSheetTextInput, which communicate internally to react to the keyboard appearance.

Also I have introduce two props to allow users to customize the handling, keyboardBehavior, keyboardBlurBehavior, enableBlurKeyboardOnGesture and android_keyboardInputMode that is only for Android.

Here is an example of a simple keyboard handling:

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetTextInput } from "@gorhom/bottom-sheet";

const App = () => {
  // variables
  const snapPoints = useMemo(() => ["25%"], []);

  // renders
  return (
    <View style={styles.container}>
      <BottomSheet snapPoints={snapPoints}>
        <View style={styles.contentContainer}>
          <BottomSheetTextInput value="Awesome 🎉" style={styles.textInput} />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "grey",
  },
  textInput: {
    alignSelf: "stretch",
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "grey",
    color: "white",
    textAlign: "center",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
  },
});

export default App;

Pull To Refresh
Pull to refresh feature is enabled by default, and it will be activated on the top snap point provided. All you need to do is to provide refreshing & onRefresh to any of the Scrollables.

note
Currently refreshControl is not supported, feel free to contribute to enable it ❤️

Example
Here is an example of a simple pull to refresh:

import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";

const App = () => {
  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%"], []);

  // callbacks
  const handleRefresh = useCallback(() => {
    console.log("handleRefresh");
  }, []);

  // render
  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <View style={styles.container}>
      <BottomSheet snapPoints={snapPoints}>
        <BottomSheetFlatList
          data={data}
          keyExtractor={(i) => i}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
          refreshing={false}
          onRefresh={handleRefresh}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

Adding Shadow
React Native Bottom Sheet Shadow

To add shadow to the bottom sheet, you will need to pass the style prop with shadow styling config, I recommend checking out React Native Shadow Generator by @ethercreative.

React Navigation Integration
One of the main goal of this library, is to allow user to fully integrate a stack navigator in the bottom sheet. This integration allows lots of opportunities for a native-like experience in your app 😇

However, there are some tricks has to be follow to enable both libraries to work together seamlessly.

You need to override safeAreaInsets, by default React Navigation add the safe area insets to all its navigators, but since your navigator will properly won't cover full screen, you will need to override it and set it to 0.
For more details regarding the implementation, please have a look at the Navigator Example ).

Edit this page
Pull To Refresh
Pull to refresh feature is enabled by default, and it will be activated on the top snap point provided. All you need to do is to provide refreshing & onRefresh to any of the Scrollables.

note
Currently refreshControl is not supported, feel free to contribute to enable it ❤️

Example
Here is an example of a simple pull to refresh:

import React, { useCallback, useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";

const App = () => {
  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%"], []);

  // callbacks
  const handleRefresh = useCallback(() => {
    console.log("handleRefresh");
  }, []);

  // render
  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <View style={styles.container}>
      <BottomSheet snapPoints={snapPoints}>
        <BottomSheetFlatList
          data={data}
          keyExtractor={(i) => i}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
          refreshing={false}
          onRefresh={handleRefresh}
        />
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;


BottomSheetView
A pre-integrated React Native View with BottomSheet gestures.

Props
Inherits ViewProps from react-native.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const snapPoints = useMemo(() => ["25%", "50%", "90%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    console.log("handleSheetChange", index);
  }, []);
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 90%" onPress={() => handleSnapPress(2)} />
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetView style={styles.contentContainer}>
          <Text>Awesome 🔥</Text>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    flex: 1,
    padding: 36,
    alignItems: 'center',
  },
});

export default App;

Edit this page
Previous
Scrollables
BottomSheetScrollView
A pre-integrated React Native ScrollView with BottomSheet gestures.

Props
Inherits ScrollViewProps from react-native.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Ignored Props
These props will be ignored if they were passed, because of the internal integration that uses them.

scrollEventThrottle
decelerationRate
onScrollBeginDrag
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%", "90%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    console.log("handleSheetChange", index);
  }, []);
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  const renderItem = useCallback(
    (item) => (
      <View key={item} style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 90%" onPress={() => handleSnapPress(2)} />
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          {data.map(renderItem)}
        </BottomSheetScrollView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

BottomSheetFlatList
A pre-integrated React Native FlatList with BottomSheet gestures.

Props
Inherits FlatListProps from react-native.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Ignored Props
These props will be ignored if they were passed, because of the internal integration that uses them.

scrollEventThrottle
decelerationRate
onScrollBeginDrag
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%", "90%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    console.log("handleSheetChange", index);
  }, []);
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 90%" onPress={() => handleSnapPress(2)} />
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetFlatList
          data={data}
          keyExtractor={(i) => i}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
        />
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

BottomSheetFlashList
A pre-integrated FlashList component with BottomSheet gestures.

Props
Inherits FlashListProps from FlashList.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetFlashList } from "@gorhom/bottom-sheet";


const keyExtractor = (item) => item;

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%"], []);

  // callbacks
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  const renderItem = useCallback(({ item }) => {
    return (
      <View key={item} style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    );
  }, []);
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
      >
        <BottomSheetFlashList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={43.3}
        />
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

BottomSheetSectionList
A pre-integrated React Native SectionList with BottomSheet gestures.

Props
Inherits SectionListProps from react-native.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Ignored Props
These props will be ignored if they were passed, because of the internal integration that uses them.

scrollEventThrottle
decelerationRate
onScrollBeginDrag
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetSectionList } from "@gorhom/bottom-sheet";

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const sections = useMemo(
    () =>
      Array(10)
        .fill(0)
        .map((_, index) => ({
          title: `Section ${index}`,
          data: Array(10)
            .fill(0)
            .map((_, index) => `Item ${index}`),
        })),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%", "90%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    console.log("handleSheetChange", index);
  }, []);
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  const renderSectionHeader = useCallback(
    ({ section }) => (
      <View style={styles.sectionHeaderContainer}>
        <Text>{section.title}</Text>
      </View>
    ),
    []
  );
  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 90%" onPress={() => handleSnapPress(2)} />
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetSectionList
          sections={sections}
          keyExtractor={(i) => i}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
        />
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  sectionHeaderContainer: {
    backgroundColor: "white",
    padding: 6,
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

BottomSheetVirtualizedList
A pre-integrated React Native VirtualizedList with BottomSheet gestures.

Props
Inherits VirtualizedListProps from react-native.

focusHook
This needed when bottom sheet used with multiple scrollables to allow bottom sheet detect the current scrollable ref, especially when used with React Navigation. You will need to provide useFocusEffect from @react-navigation/native.

type	default	required
function	React.useEffect	NO
Ignored Props
These props will be ignored if they were passed, because of the internal integration that uses them.

scrollEventThrottle
decelerationRate
onScrollBeginDrag
Example
import React, { useCallback, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetVirtualizedList } from "@gorhom/bottom-sheet";

const App = () => {
  // hooks
  const sheetRef = useRef<BottomSheet>(null);

  // variables
  const data = useMemo(
    () =>
      Array(50)
        .fill(0)
        .map((_, index) => `index-${index}`),
    []
  );
  const snapPoints = useMemo(() => ["25%", "50%", "90%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    console.log("handleSheetChange", index);
  }, []);
  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);
  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  // render
  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemContainer}>
        <Text>{item}</Text>
      </View>
    ),
    []
  );
  return (
    <GestureHandlerRootView style={styles.container}>
      <Button title="Snap To 90%" onPress={() => handleSnapPress(2)} />
      <Button title="Snap To 50%" onPress={() => handleSnapPress(1)} />
      <Button title="Snap To 25%" onPress={() => handleSnapPress(0)} />
      <Button title="Close" onPress={() => handleClosePress()} />
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetVirtualizedList
          data={data}
          keyExtractor={(i) => i}
          getItemCount={(data) => data.length}
          getItem={(data, index) => data[index]}
          renderItem={renderItem}
          contentContainerStyle={styles.contentContainer}
        />
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 200,
  },
  contentContainer: {
    backgroundColor: "white",
  },
  itemContainer: {
    padding: 6,
    margin: 6,
    backgroundColor: "#eee",
  },
});

export default App;

BottomSheetBackdrop
A pre-built BottomSheet backdrop implementation with configurable props.

Props
Inherits ViewProps from react-native.

animatedIndex
Current sheet position index.

type	default	required
Animated.SharedValue<number>	0	YES
animatedPosition
Current sheet position.

type	default	required
Animated.SharedValue	0	YES
opacity
Backdrop opacity.

type	default	required
number	0.5	NO
appearsOnIndex
Snap point index when backdrop will appears on.

type	default	required
number	1	NO
disappearsOnIndex
Snap point index when backdrop will disappears on.

type	default	required
number	0	NO
enableTouchThrough
Enable touch through backdrop component.

type	default	required
boolean	false	NO
pressBehavior
What should happen when user press backdrop?

none: do nothing, and onPress prop will be ignored.
close: close the sheet.
collapse: collapse the sheet.
N: snap point index.
type	default	required
BackdropPressBehavior | number	'close'	NO
onPress
Pressing the backdrop will call the onPress function, it will be called before the action defined by pressBehavior is executed

type	default	required
function	undefined	NO
Example
import React, { useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";

const App = () => {
	// ref
	const bottomSheetRef = useRef<BottomSheet>(null);

	// variables
	const snapPoints = useMemo(() => ["25%", "50%", "75%"], []);

	// callbacks
	const handleSheetChanges = useCallback((index: number) => {
		console.log("handleSheetChanges", index);
	}, []);

	// renders
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={1}
				appearsOnIndex={2}
			/>
		),
		[]
	);
	return (
		<GestureHandlerRootView style={styles.container}>
			<BottomSheet
				ref={bottomSheetRef}
				index={1}
				snapPoints={snapPoints}
				backdropComponent={renderBackdrop}
        enableDynamicSizing={false}
				onChange={handleSheetChanges}
			>
				<BottomSheetView style={styles.contentContainer}>
					<Text>Awesome 🎉</Text>
				</BottomSheetView>
			</BottomSheet>
		</GestureHandlerRootView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 24,
		backgroundColor: "grey",
	},
	contentContainer: {
		flex: 1,
		alignItems: "center",
	},
});

export default App;

BottomSheetFooter
A pre-built component that sticks to the bottom of the BottomSheet and can be modify to fit your own custom interaction.

Props
animatedFooterPosition
Calculated footer animated position.

type	default	required
Animated.SharedValue<number>	0	NO
bottomInset
Bottom inset to be added below the footer.

type	default	required
number	0	NO
children
Component to be placed in the footer.

type	default	required
ReactNode | ReactNode[]	undefined	NO
Example
import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetFooter } from '@gorhom/bottom-sheet';

const App = () => {
  // ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // variables
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  // renders
  const renderFooter = useCallback(
    props => (
      <BottomSheetFooter {...props} bottomInset={24}>
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Footer</Text>
        </View>
      </BottomSheetFooter>
    ),
    []
  );
  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        footerComponent={renderFooter}
      >
        <View style={styles.contentContainer}>
          <Text>Awesome 🎉</Text>
        </View>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  footerContainer: {
    padding: 12,
    margin: 12,
    borderRadius: 12,
    backgroundColor: '#80f',
  },
  footerText: {
    textAlign: 'center',
    color: 'white',
    fontWeight: '800',
  },
});

export default App;

BottomSheetTextInput
A pre-integrated TextInput that communicate with internal functionalities to allow Keyboard handling to work.

Props
Inherits TextInputProps from react-native.

Example
import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';

const App = () => {
  // ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // variables
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  // renders
  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        keyboardBehavior="fillParent"
        enableDynamicSizing={false}
        onChange={handleSheetChanges}
      >
        <BottomSheetTextInput style={styles.input} />
        <BottomSheetView style={styles.contentContainer}>
          <Text>Awesome 🎉</Text>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  input: {
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 10,
    fontSize: 16,
    lineHeight: 20,
    padding: 8,
    backgroundColor: 'rgba(151, 151, 151, 0.25)',
  },
});

export default App;


