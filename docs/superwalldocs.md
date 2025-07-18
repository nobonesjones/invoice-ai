Present Your First Paywall
Learn how to present paywalls in your app.

Placements
With Superwall, you present paywalls by registering a Placement. Placements are the configurable entry points to show (or not show) paywalls based on your Campaigns as setup in your Superwall dashboard.

The placement campaign_trigger is set to show an example paywall by default.

Usage
The usePlacement hook allows you to register placements that you've configured in your Superwall dashboard. The hook returns a registerPlacement function that you can use to register a placement.


import { usePlacement, useUser } from "expo-superwall";
import { Alert, Button, Text, View } from "react-native";

function PaywallScreen() {
  const { registerPlacement, state: placementState } = usePlacement({
    onError: (err) => console.error("Placement Error:", err),
    onPresent: (info) => console.log("Paywall Presented:", info),
    onDismiss: (info, result) =>
      console.log("Paywall Dismissed:", info, "Result:", result),
  });

  const handleTriggerPlacement = async () => {
    await registerPlacement({
      placement: "campaign_trigger"
    });
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Show Paywall" onPress={handleTriggerPlacement} />
      {placementState && (
        <Text>Last Paywall Result: {JSON.stringify(placementState)}</Text>
      )}
    </View>
  );
}
How is this guide?

Good
User Management
Anonymous Users
Superwall automatically generates a random user ID that persists internally until the user deletes/reinstalls your app.

You can call Superwall.shared.reset() to reset this ID and clear any paywall assignments.

Identified Users
If you use your own user management system, call identify(userId:options:) when you have a user's identity. This will alias your userId with the anonymous Superwall ID enabling us to load the user’s assigned paywalls.

Calling Superwall.shared.reset() will reset the on-device userId to a random ID and clear the paywall assignments.

Note that for Android apps, if you want the userId passed to the Play Store when making purchases, you'll also need to set passIdentifiersToPlayStore via SuperwallOptions. Be aware of Google's rules that the userId must not contain any personally identifiable information, otherwise the purchase could be rejected.


// After retrieving a user's ID, e.g. from logging in or creating an account
Superwall.shared.identify({ userId: user.id })

// When the user signs out
Superwall.shared.reset()

Advanced Use Case

You can supply an IdentityOptions object, whose property restorePaywallAssignments you can set to true. This tells the SDK to wait to restore paywall assignments from the server before presenting any paywalls. This should only be used in advanced use cases. If you expect users of your app to switch accounts or delete/reinstall a lot, you'd set this when users log in to an existing account.

Best Practices for a Unique User ID
Do NOT make your User IDs guessable – they are public facing.
Do NOT set emails as User IDs – this isn't GDPR compliant.
Do NOT set IDFA or DeviceIds as User IDs – these are device specific / easily rotated by the operating system.
Do NOT hardcode strings as User IDs – this will cause every user to be treated as the same user by Superwall.
Identifying users from App Store server events
On iOS, Superwall always supplies an appAccountToken with every StoreKit 2 transaction:

Scenario	Value used for appAccountToken
You’ve called Superwall.shared.identify(userId:)	The exact userId you passed
You haven’t called identify yet	The UUID automatically generated for the anonymous user (the alias ID), without the $SuperwallAlias: prefix
Because the SDK falls back to the alias UUID, purchase notifications sent to your server always include a stable, unique identifier—even before the user signs in.
Make sure any userId you pass to identify is a valid UUID string, as Apple requires appAccountToken values to follow the UUID format.Feature Gating
This allows you to register a placement to access a feature that may or may not be paywalled later in time. It also allows you to choose whether the user can access the feature even if they don't make a purchase.

Here's an example.

With Superwall

// remotely decide if a paywall is shown and if
// navigation.startWorkout() is a paid-only feature
Superwall.shared.register({
  placement: 'StartWorkout',
  feature: () => {
    navigation.navigate('LaunchedFeature', {
      value: 'Non-gated feature launched',
    });
  } 
});
Without Superwall

function pressedWorkoutButton() {
  if (user.hasActiveSubscription) {
    navigation.startWorkout()
  } else {
    navigation.presentPaywall().then((result: boolean) => {
      if (result) {
        navigation.startWorkout()
      } else {
        // user didn't pay, developer decides what to do
      }
    })
  }
}
How registering placements presents paywalls
You can configure "StartWorkout" to present a paywall by creating a campaign, adding the placement, and adding a paywall to an audience in the dashboard.

The SDK retrieves your campaign settings from the dashboard on app launch.
When a placement is called that belongs to a campaign, audiences are evaluated on device and the user enters an experiment — this means there's no delay between registering a placement and presenting a paywall.
If it's the first time a user is entering an experiment, a paywall is decided for the user based on the percentages you set in the dashboard
Once a user is assigned a paywall for an audience, they will continue to see that paywall until you remove the paywall from the audience or reset assignments to the paywall.
After the paywall is closed, the Superwall SDK looks at the Feature Gating value associated with your paywall, configurable from the paywall editor under General > Feature Gating (more on this below)
If the paywall is set to Non Gated, the feature: closure on register(placement: ...) gets called when the paywall is dismissed (whether they paid or not)
If the paywall is set to Gated, the feature: closure on register(placement: ...) gets called only if the user is already paying or if they begin paying.
If no paywall is configured, the feature gets executed immediately without any additional network calls.
Given the low cost nature of how register works, we strongly recommend registering all core functionality in order to remotely configure which features you want to gate – without an app update.


// on the welcome screen
function pressedSignUp() {
  Superwall.shared.register({
    placement: 'SignUp',
    feature: () => {
      navigation.beginOnboarding()
    }
  });
}

function pressedWorkoutButton() {
  Superwall.shared.register({
    placement: 'StartWorkout',
    feature: () => {
     navigation.startWorkout()
    }
  })
}
Automatically Registered Placements
The SDK automatically registers some internal placements which can be used to present paywalls:

Register. Everything.
To provide your team with ultimate flexibility, we recommend registering all of your analytics events, even if you don't pass feature blocks through. This way you can retroactively add a paywall almost anywhere – without an app update!

If you're already set up with an analytics provider, you'll typically have an Analytics.swift singleton (or similar) to disperse all your events from. Here's how that file might look:

Getting a presentation result
Use getPresentationResult(forPlacement:params:) when you need to ask the SDK what would happen when registering a placement — without actually showing a paywall. Superwall evaluates the placement and its audience filters then returns a PresentationResult. You can use this to adapt your app's behavior based on the outcome (such as showing a lock icon next to a pro feature if they aren't subscribed).

In short, this lets you peek at the outcome first and decide how your app should respond:Tracking Subscription State
Superwall tracks the subscription state of a user for you. So, you don't need to add in extra logic for this. However, there are times in your app where you simply want to know if a user is on a paid plan or not. In your app's models, you might wish to set a flag representing whether or not a user is on a paid subscription:


@Observable 
class UserData {
    var isPaidUser: Bool = false
}
Using subscription status
You can do this by observing the subscriptionStatus property on Superwall.shared. This property is an enum that represents the user's subscription status:


switch Superwall.shared.subscriptionStatus {
case .active(let entitlements):
    logger.info("User has active entitlements: \(entitlements)")
    userData.isPaidUser = true
case .inactive:
    logger.info("User is free plan.")
    userData.isPaidUser = false 
case .unknown:
    logger.info("User is inactive.")
    userData.isPaidUser = false
}
One natural way to tie the logic of your model together with Superwall's subscription status is by having your own model conform to the Superwall Delegate:


@Observable 
class UserData {
    var isPaidUser: Bool = false
}

extension UserData: SuperwallDelegate {
    // MARK: Superwall Delegate
    
    func subscriptionStatusDidChange(from oldValue: SubscriptionStatus, to newValue: SubscriptionStatus) {
        switch newValue {
        case .active(_):
            // If you're using more than one entitlement, you can check which one is active here.
            // This example just assumes one is being used.
            logger.info("User is pro plan.")
            self.isPaidUser = true
        case .inactive:
            logger.info("User is free plan.")
            self.isPaidUser = false
        case .unknown:
            logger.info("User is free plan.")
            self.isPaidUser = false
        }
    }
}
Another shorthand way to check? The isActive flag, which returns true if any entitlement is active:


if Superwall.shared.subscriptionStatus.isActive {
    userData.isPaidUser = true 
}
Superwall checks subscription status for you
Remember that the Superwall SDK uses its audience filters for a similar purpose. You generally don't need to wrap your calls registering placements around if statements checking if a user is on a paid plan, like this:


// Unnecessary
if !Superwall.shared.subscriptionStatus.isActive {
    Superwall.shared.register(placement: "campaign_trigger")
}
In your audience filters, you can specify whether or not the subscription state should be considered...



...which eliminates the needs for code like the above. This keeps you code base cleaner, and the responsibility of "Should this paywall show" within the Superwall campaign platform as it was designed.

How is this guide?

Good
Bad
Feature Gating

Previous Page

Setting User Attributes

Next PageSetting User Attributes
By setting user attributes, you can display information about the user on the paywall. You can also define audiences in a campaign to determine which paywall to show to a user, based on their user attributes.

You do this by passing a [String: Any?] dictionary of attributes to Superwall.shared.setUserAttributes(_:):


const attributes = {
  name: user.name,
  apnsToken: user.apnsTokenString,
  email: user.email,
  username: user.username,
  profilePic: user.profilePicUrl,
};

Superwall.shared.setUserAttributes(attributes);
Usage
This is a merge operation, such that if the existing user attributes dictionary already has a value for a given property, the old value is overwritten. Other existing properties will not be affected. To unset/delete a value, you can pass nil for the value.

You can reference user attributes in audience filters to help decide when to display your paywall. When you configure your paywall, you can also reference the user attributes in its text variables. For more information on how to that, see Configuring a Paywall.

How is this guide?

Good
Bad
Tracking Subscription State

Previous Page

In-App Paywall Previews

Next PageIn-App Paywall Previews
Previewing paywalls on your device before going live.
Deep linking to specific campaigns.
Web Checkout Post-Checkout Redirecting
Setup
There are two ways to deep link into your app: URL Schemes and Universal Links (iOS only).

Adding a Custom URL Scheme
Adding a Universal Link (iOS only)
Only required for Web Checkout, otherwise you can skip this step.

Before configuring in your app, first create and configure your Stripe app on the Superwall Dashboard.

Add a new capability in Xcode
Select your target in Xcode, then select the Signing & Capabilities tab. Click on the + Capability button and select Associated Domains. This will add a new capability to your app.



Set the domain
Next, enter in the domain using the format applinks:[your-web-checkout-url]. This is the domain that Superwall will use to handle universal links. Your your-web-checkout-url value should match what's under the "Web Paywall Domain" section.



Testing
If your Stripe app's iOS Configuration is incomplete or incorrect, universal links will not work

You can verify that your universal links are working a few different ways. Keep in mind that it usually takes a few minutes for the associated domain file to propagate:

Use Branch's online validator: If you visit branch.io's online validator and enter in your web checkout URL, it'll run a similar check and provide the same output.

Test opening a universal link: If the validation passes from either of the two steps above, make sure visiting a universal link opens your app. Your link should be formatted as https://[your web checkout link]/app-link/ — which is simply your web checkout link with /app-link/ at the end. This is easiest to test on device, since you have to tap an actual link instead of visiting one directly in Safari or another browser. In the iOS simulator, adding the link in the Reminders app works too:



Handling Deep Links
You can use the Superwall SDK to handle the deeplink with Superwall.shared.handleDeepLink(url);. Here, we have code to ensure that the deep link opens a preview when the app is booted from the deep link, and when it's already in the foreground running:


import React, { useEffect } from 'react';
import { Linking, AppState } from 'react-native';
import Superwall from 'expo-superwall/compat';

function handleDeepLink(url: string | null) {
  if (url) {
    Superwall.shared.handleDeepLink(url);
  }
}

function App(): React.JSX.Element {
  useEffect(() => {
    Superwall.configure('YOUR_SUPERWALL_API_KEY');

    const handleIncomingLink = async () => {
      const url = await Linking.getInitialURL();
      handleDeepLink(url);
    };

    // Handle any existing deep link on mount
    handleIncomingLink();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        handleIncomingLink();
      }
    });

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      appStateSubscription.remove();
      linkingSubscription.remove();
    };
  }, []);

  // Returning null since there's no UI for the example...
  return null;
}

export default App;
Previewing Paywalls
Next, build and run your app on your phone.

Then, head to the Superwall Dashboard. Click on Settings from the Dashboard panel on the left, then select General:



With the General tab selected, type your custom URL scheme, without slashes, into the Apple Custom URL Scheme field:



Next, open your paywall from the dashboard and click Preview. You'll see a QR code appear in a pop-up:






On your device, scan this QR code. You can do this via Apple's Camera app. This will take you to a paywall viewer within your app, where you can preview all your paywalls in different configurations.

Using Deep Links to Present Paywalls
Deep links can also be used as a placement in a campaign to present paywalls. Simply add deepLink_open as an placement, and the URL parameters of the deep link can be used as parameters! You can also use custom placements for this purpose. Read this doc for examples of both.