Onboarding Flow: SupaInvoice App (Revised)
Screen 1: Welcome / Splash Screen
Layout: Split screen. Left side features a branded visual element. Right side is a clean content area.
AI Coder Note: Left side: Use a dark blue/purple textured background or a primary brand visual. Right side: Use a white or light neutral background.
Content (Right Side):
App Logo & Name: Your app's logo and name "SupaInvoice".
AI Coder Note: Use your app's logo and primary brand font.
Tagline: "Create fast and professional invoices directly from your phone." (Smaller, standard text below the app name).
Primary Call to Action (CTA): Button labeled "Get started". Tapping this proceeds to the next screen.
AI Coder Note: Use your app's primary button styling.
Secondary Link: Text link "Already have an account?". Tapping this should lead to the login flow.
AI Coder Note: Use your app's standard text link styling.
Screen 2: Value Proposition 1
Layout: Full-screen background image with text overlay and a button at the bottom.
Background Image: A lifestyle or use-case image relevant to your app, suggesting mobile productivity.
Headline: "Invoice in seconds" (Large, bold text).
Sub-headline/Description: "Create professional invoices and send them from your phone" (Smaller text below the headline).
Primary CTA: Button labeled "Continue". Tapping this proceeds to the next screen.
AI Coder Note: Use your app's primary button styling.
Screen 3: Business Information Input
Layout: Full-screen background image with a content area overlay.
Background Image: A professional background image.
Headline: "Business Info" (Large, bold text).
Input Fields:
Name:
Label/Placeholder: "Name" (with a small building/office icon to the left of the placeholder text).
Helper text: "Required, can be edited any time" (small text below the input field).
The system keyboard appears automatically, focused on this field.
Region:
Label/Placeholder: "Region" (consider an appropriate icon, e.g., a globe or map pin).
Functionality: This should be a dropdown selector. Tapping it reveals a scrollable list of pre-defined regions/countries for the user to select from.
Helper text: "Required, helps us tailor your experience" (or similar).
AI Coder Note: Populate the region list based on your target markets. Use your app's standard dropdown/picker styling.
Primary CTA: Button labeled "Continue". This becomes active once all required fields are filled and proceeds to the next screen when tapped.
AI Coder Note: Use your app's primary button styling.
Screen 4: Industry Selection
Layout: Full-screen background image with a content area overlay for selection.
Background Image: A professional background image, possibly related to tools or work environments.
Headline: "Industry" (Large, bold text).
Instruction Text: "Please select the industry you work in to personalize your app experience."
Search Bar: "Search industry" with a magnifying glass icon, allowing users to filter the list.
Industry List: A vertically scrollable list of industries. Each industry is presented with a radio button for selection. Selecting an industry marks it.
Examples: Carpentry, Cleaning, Digital Freelancer, General Contracting, etc.
AI Coder Note: Populate this list with industries relevant to your target users. Ensure radio buttons follow your app's selection control styling.
Primary CTA: Button labeled "Continue". This becomes active once an industry is selected and proceeds to the next screen when tapped.
AI Coder Note: Use your app's primary button styling.
Screen 5: Upload Logo
Layout: Full-screen background image with a content area overlay.
Background Image: A professional background image, possibly showing a person in a work context.
Headline: "Upload logo" (Large, bold text).
Instruction Text: "Optional, can be edited any time."
Logo Placeholder: A designated area where the uploaded logo will appear.
Logo Selection CTA: Button labeled "Choose image" with a pencil/edit icon.
Tapping this presents an action sheet with options: "Take from camera" and "Choose from gallery".
"Take from camera": If selected, the app requests camera permission. If granted, the camera interface opens for the user to take a photo. After taking a photo, an image cropping interface is presented. Upon confirmation, the cropped image appears in the logo placeholder.
"Choose from gallery": If selected, the app requests photo library permission. If granted (either full or limited access), the photo picker interface opens for the user to select an image. If an image is selected, an image cropping interface is presented. Upon confirmation, the cropped image appears in the logo placeholder.
AI Coder Note: Implement standard iOS permission requests for camera and photo library. Include a basic image cropping tool. Use your app's secondary or specific action button styling for "Choose image".
Primary CTA (for screen): Button labeled "Continue". This is active regardless of logo upload and proceeds to the next screen when tapped.
AI Coder Note: Use your app's primary button styling.
Screen 6: Social Proof / Rating Teaser
Layout: Full-screen white background (or light brand color) with text, user avatars, star ratings, and testimonial snippets.
Headline: "Give us a rating" (Large, bold text).
Sub-headline: "SupaInvoice was made for people like you."
Visuals:
A cluster of circular user profile photos with accompanying text (e.g., "+1M SupaInvoice people").
Five yellow stars (or your app's star rating style).
Scrolling/cycling testimonial snippets.
AI Coder Note: Use placeholder avatars and generic positive testimonials. Ensure the star rating graphic matches your app's style.
Main Text Block: "Join Millions of Happy SupaInvoice users" (Large, prominent text).
Primary CTA: Button labeled "Continue".
When tapped, the app first attempts to display the standard iOS in-app rating prompt ("Enjoying SupaInvoice? Tap a star to rate it..."). The user can interact with this prompt (rate or dismiss with "Not Now").
Regardless of the rating prompt interaction, after the prompt is dismissed (or if it doesn't show), tapping "Continue" again (if the user didn't proceed immediately after the prompt) advances to the next screen.
AI Coder Note: Use your app's primary button styling. Trigger the standard SKStoreReviewController.requestReview() API for the rating prompt.
Screen 7: Loading / Account Creation
Layout: Full-screen white background (or light brand color).
Primary Text: "Loading..." (Large, bold).
Animation: A circular loading spinner.
AI Coder Note: Use your app's branded loading spinner.
Secondary Text: "We are creating your account with all the business details. This should take only seconds..." (Smaller text below the spinner).
Button State: The "Continue" button area from the previous screen might transform into a "Loading..." button with an internal progress bar filling up. This indicates the account creation process.
AI Coder Note: This animated button is a nice visual feedback element.
This screen transitions automatically upon completion of the account creation process.
Screen 8: Account Created Confirmation
Layout: Full-screen white background (or light brand color).
Visual: A small, stylized preview of a document or a relevant success graphic.
Icon: A large success checkmark in a circle.
AI Coder Note: Use your app's branded success icon.
Headline: "Account created!" (Large, bold text).
Sub-headline/Description: "Your account has been created. Start making your first invoices and grow your business!"
Primary CTA: Button labeled "Start Invoice Tutorial" (or "Get Started," "Explore App," etc.).
When tapped, the app first requests permission to send notifications ("'SupaInvoice' Would Like to Send You Notifications"). The user can "Allow" or "Don't Allow".
After the notification permission prompt is handled, the app proceeds to the next step (e.g., paywall or main app interface).
AI Coder Note: Use your app's primary button styling. Implement standard iOS notifications permission request.
Screen 9: Paywall / Subscription Offer
Layout: Full-screen, presented modally or as a full-screen takeover.
Headline: "GET PRO ACCESS" (Large text).
Sub-headline: "GO UNLIMITED" (Slightly smaller, bold text).
App Logo: Prominently displayed near the top (SupaInvoice logo).
Feature List (Benefits of Pro): A list of premium features/benefits, each with an icon.
Examples: "PROFESSIONAL INVOICES", "RECEIVE ONLINE PAYMENTS", etc.
AI Coder Note: List your app's premium features. Use icons from your design system. Consider pagination/carousel indicators if the list is long.
Trial Option: "Enable Free Trial" (Toggle switch, state depends on your strategy).
Subscription Tiers: Clearly display available subscription options (e.g., Annually, Weekly) with pricing. Highlight a "BEST OFFER" if applicable.
AI Coder Note: Configure your actual subscription products and pricing.
Primary CTA: Button labeled "Continue" (or "Start Trial," "Unlock All Features") with an appropriate icon (e.g., upward arrow, lock). Tapping this initiates the purchase flow.
AI Coder Note: Use your app's primary button styling, potentially a distinct color for paywall CTAs.
Dismiss/Secondary Option: A clear way to close or skip the paywall (e.g., an "X" icon in a corner, a "Not now" text link, or "CANCEL ANYTIME" if linked to a trial). Tapping this dismisses the paywall and proceeds to the main app interface.
AI Coder Note: Ensure a clear dismissal path.
Required Image Assets List:
Screen 1 (Welcome / Splash Screen):
welcome_background_visual.png (For the left-side branded visual element)
Screen 2 (Value Proposition 1):
value_prop_background.png (Full-screen lifestyle/use-case image suggesting mobile productivity)
Screen 3 (Business Information Input):
business_info_background.png (Full-screen professional background image)
Screen 4 (Industry Selection):
industry_selection_background.png (Full-screen professional background, possibly tools/work-themed)
Screen 5 (Upload Logo):
logo_upload_background.png (Full-screen professional background, possibly person-in-work-context themed)
logo_placeholder_icon.png (Optional, if you want a default icon in the logo upload area before an image is chosen)
Screen 6 (Social Proof / Rating Teaser):
avatar_placeholder_1.png, avatar_placeholder_2.png, avatar_placeholder_3.png (For the cluster of user profile photos)
Screen 8 (Account Created Confirmation):
account_created_preview.png (Small, stylized preview of an invoice or relevant success graphic)
AI Coder Note for all background images: Ensure images are optimized for mobile and consider providing different resolutions if necessary. They should be subtle enough not to overpower the UI text and elements. Use images that align with your app's brand and target audience. Your design document should specify exact styling for overlays and text on these images.