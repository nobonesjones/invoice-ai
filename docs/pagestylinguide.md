# UI Styling Guide

This guide outlines the standard styling conventions to be used across the application to ensure visual consistency. It is derived from existing well-styled screens like 'Create New Item', 'Tax & Currency Settings', and 'Business Information'.

## I. Overall Page & Screen Structure

### A. Full Page Screens (e.g., Settings Sub-Pages like Business Information)

*   **Container (`SafeAreaView`):**
    *   The main screen container should use `SafeAreaView` to respect device notches and safe areas.
    *   Apply `edges={['bottom', 'left', 'right']}` if using a custom header, or appropriate edges.
    *   Background: `theme.background`.
    *   `flex: 1`.
*   **Header (Custom - derived from `BusinessInformationScreen`):**
    *   Implemented using the `header` option within `Stack.Screen`.
    *   **Structure:**
        ```jsx
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 /* or specific touch target size */ }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Screen Title Here</Text>
        </View>
        ```
    *   **Styles (`getStyles(theme)`):**
        *   `headerContainer`:
            *   `flexDirection: 'row'`
            *   `alignItems: 'center'`
            *   `paddingHorizontal: 10`
            *   `paddingTop: Platform.OS === 'ios' ? 50 : 40` (Key for vertical positioning)
            *   `paddingBottom: 10`
            *   `backgroundColor: theme.card` (or `theme.background` if preferred)
            *   `borderBottomWidth: StyleSheet.hairlineWidth`
            *   `borderBottomColor: theme.border`
        *   `headerTitle`:
            *   `fontSize: 20`
            *   `fontWeight: 'bold'`
            *   `marginLeft: 10` (Spacing between back icon and title)
            *   `color: theme.foreground`
        *   **Back Icon (`ChevronLeft` from `lucide-react-native`):**
            *   `size: 26`
            *   `color: theme.foreground`
            *   Wrapper `TouchableOpacity` padding: `6` (or adjust for a good touch target).
*   **Content Area:**
    *   Use a `ScrollView` for content that might exceed screen height.
    *   `flex: 1` for the `ScrollView`'s parent `View` if nested.
    *   General Padding for `ScrollView`'s `contentContainerStyle`: `padding: 16`, and `paddingBottom` sufficient for any sticky bottom elements (e.g., `paddingBottom: 100`).
    *   `keyboardShouldPersistTaps="handled"` on `ScrollView` for better UX with inputs.

### B. Modals (Especially Bottom Sheet Style like 'Create New Item')

*   **Modal Container (e.g., `@gorhom/bottom-sheet` `BottomSheetModal`):**
    *   Modal content area background: `theme.card`.
    *   Handle Indicator: `handleIndicatorStyle={{ backgroundColor: theme.mutedForeground }}`.
    *   Background Style: `backgroundStyle={{ backgroundColor: theme.card }}`.
*   **Modal Header:**
    *   Layout: Centered title with a close 'X' icon on the right, or Search bar.
    *   Container Style (`modalHeaderContainer`):
        *   `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`.
        *   `padding: 16`.
        *   `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: theme.border`.
    *   Title Text (`modalTitle`): `fontSize: 18, fontWeight: 'bold', color: theme.foreground`.
    *   Close Icon (`XIcon` from `lucide-react-native`): `size: 24, color: theme.mutedForeground`.
*   **Modal Content List (`BottomSheetFlatList`):**
    *   `contentContainerStyle`: e.g., `paddingBottom: 30`.
    *   `ItemSeparatorComponent`: `<View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />`
        *   `modalSeparator`: `height: StyleSheet.hairlineWidth`.

## II. Input & Section Cards (for grouping inputs)

*   **Card Styling (`sectionContainer`):**
    *   Group related items into visual cards using `<View />`.
    *   `backgroundColor: theme.card`.
    *   `borderRadius: 10`.
    *   Shadows (iOS): `shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2`.
    *   Elevation (Android): `elevation: 3`.
    *   Spacing: `marginBottom: 16` or `20`.
*   **Internal Item Separators:**
    *   For multiple rows within a single card, separate them with a thin horizontal line. Achieved by applying `borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border` to each row container except the last.
    *   The last item in a card should have `borderBottomWidth: 0` or a specific class like `lastInputRow`.

## III. Input Field Rows

*   **Row Container Style (`inputRow`):**
    *   `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`.
    *   `paddingVertical: 14`, `paddingHorizontal: 16`.
    *   `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: theme.border`.
*   **Labels (`label`):
    *   Use custom `<Text />` component.
    *   Style: `fontSize: 16, color: theme.foreground, fontWeight: 'bold', marginRight: 8, flexShrink: 1`. (Derived from `account-details.tsx`)
*   **Input/Value Area (`input` for `TextInput`):
    *   Use `<TextInput />` for editable fields.
    *   Style: `fontSize: 16, color: theme.foreground, textAlign: 'right', flex: 1`.
    *   Placeholder Style: `placeholderTextColor: theme.mutedForeground`.
*   **Multi-line Text Input (e.g., Business Address):**
    *   Container Style (`multilineInputContainer`):
        *   `paddingVertical: 14`, `paddingHorizontal: 16`.
        *   `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: theme.border`.
    *   Label: Displayed above the input field, e.g., `<Text style={[styles.label, { marginBottom: 8 }]}>Label</Text>`.
    *   `TextInput` Style (`multilineInput`):
        *   `fontSize: 16, color: theme.foreground, textAlignVertical: 'top', minHeight: 80`.
        *   `multiline={true}`, `numberOfLines={3}` (or as appropriate).

## IV. Action Rows & Interactive Elements

### A. Settings List Item (e.g., rows that navigate or show a selected value)

*   Typically a custom component like `SettingsListItem`.
*   Structure: Icon (optional), Label, Value (optional/current selection), ChevronRight icon.
*   Tappable area to open modals or navigate.
*   Internal padding and styling should match `inputRow` for consistency.

### B. Image Picker Row (e.g., Business Logo)

*   Row Container Style (`logoPickerRow`):
    *   `flexDirection: 'row'`, `alignItems: 'center'`, `padding: 16`.
    *   `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: theme.border`.
*   **Image Preview/Placeholder:**
    *   `logoImagePreview` (for selected image): `width: 60, height: 60, borderRadius: 8, marginRight: 16, backgroundColor: theme.muted`.
    *   `logoPlaceholder` (if no image): Same dimensions, `justifyContent: 'center', alignItems: 'center'`, containing an icon like `UploadCloud`.
*   **Text Container (`logoPickerTextContainer`):** `flex: 1`.
    *   Main Label (`logoPickerLabel`): `fontSize: 16, fontWeight: '500', color: theme.foreground`.
    *   Subtext (`logoPickerSubtext`): `fontSize: 12, color: theme.mutedForeground`.

### C. Switch / Toggle

*   Use React Native `<Switch />`.
*   Position: Typically aligned to the right of an `inputRow`.
*   Styling:
    *   `trackColor={{ false: theme.muted, true: theme.primaryTransparent /* or theme.primary */ }}`.
    *   `thumbColor={isEnabled ? theme.primary : theme.card}`.
    *   `ios_backgroundColor={theme.muted}`.

## V. Sticky Bottom Button (e.g., "Save Changes")

*   **Button Container (`stickyButtonContainer`):**
    *   `position: 'absolute', bottom: 0, left: 0, right: 0`.
    *   `padding: 16`, `paddingBottom: Platform.OS === 'ios' ? 32 : 16` (for home indicator).
    *   `backgroundColor: theme.background` (or `theme.card`).
    *   `borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor: theme.border`.
*   **Button (`saveButton` - `TouchableOpacity`):**
    *   `backgroundColor: theme.primary`.
    *   `borderRadius: 10`.
    *   `paddingVertical: 16`.
    *   `alignItems: 'center'`, `justifyContent: 'center'`.
    *   `flexDirection: 'row'` (if icon was present).
*   **Button Text (`saveButtonText` - `Text`):**
    *   `color: theme.primaryForeground`.
    *   `fontSize: 16`, `fontWeight: 'bold'`.
    *   `marginLeft: 8` (if icon was present, otherwise `0` or center text).

## VI. General Notes

*   **Dynamic Styling:** Use a `getStyles(theme)` function that returns `StyleSheet.create({...})` to make components theme-aware.
*   **Theme Colors:** Strictly adhere to `theme` object properties (e.g., `theme.foreground`, `theme.background`, `theme.primary`, `theme.muted`, `theme.border`, `theme.card`, `theme.primaryForeground`, `theme.mutedForeground`).
*   **Icons:** Prefer `lucide-react-native` for consistency. Standard sizes `20-26`.
*   **Custom Text Component:** Use the app's custom `<Text />` component for all text to ensure consistent font application and theming.
*   **Spacing:** Default padding/margin unit is often `16px` or related values (`8, 10, 12, 14`). Maintain consistency.
*   **Font:** System default or specified project font (e.g., 'Roboto'). Ensure `fontWeight` is used appropriately ('bold', '500' for semi-bold, default for regular).