Review Environment

Submission ID: 44fe9391-12da-4e1d-864a-9e6badea6232
Review date: September 02, 2025
Version reviewed: 1.0


Guideline 2.3.3 - Performance - Accurate Metadata
Issue Description

The 6.7-inch iPhone screenshots do not show the actual app in use in the majority of the screenshots and the 13-inch iPad screenshots show an iPhone image that has been modified or stretched to appear to be an iPad image. Screenshots should highlight the app's core concept to help users understand the app’s functionality and value. 

Next Steps

Upload new screenshots that resolve the issues identified above and accurately reflect the app in use on each of the supported devices.

Note some screenshots may only be viewed and updated by selecting "View All Sizes in Media Manager" in the Previews and Screenshots section of App Store Connect.

Resources

Follow these general requirements when adding or updating screenshots:

- Marketing or promotional materials that do not reflect the UI of the app are not appropriate for screenshots.
- The majority of the screenshots should highlight the app's main features and functionality. Note that splash and login screens are generally not considered to show your app in use.
- Confirm that the screenshots appear identical to the app in all languages and on all supported devices. For example, screenshots can include the controls, interface or menus present in the app. 
- Make sure that the screenshots show the app in use on the correct device. For example, iPhone screenshots should show the app as it appears on iPhone, not on iPad. Screenshots of the app on multiple Apple platforms can be included to demonstrate compatibility. 

Learn more about creating great screenshots for your product page on the App Store or how to upload screenshots in App Store Connect.


Guideline 5.1.1(v) - Data Collection and Storage
Issue Description

The app supports account creation but does not include an option to initiate account deletion. Apps that support account creation must also offer account deletion to give users more control of the data they've shared while using an app.

Follow these requirements when updating an app to support account deletion:

- Only offering to temporarily deactivate or disable an account is insufficient.
- If users need to visit a website to finish deleting their account, include a link directly to the website page where they can complete the process.
- Apps may include confirmation steps to prevent users from accidentally deleting their account. However, only apps in highly-regulated industries may require users to use customer service resources, such as making a phone call or sending an email, to complete account deletion.

Next Steps

Update the app to support account deletion. If the app already supports account deletion, reply to App Review in App Store Connect and identify where to locate this feature.

If the app is unable to offer account deletion or needs to provide additional customer service flows to facilitate and confirm account deletion, either because the app operates in a highly-regulated industry or for some other reason, reply to App Review in App Store Connect and provide additional information or documentation. For questions regarding legal obligations, check with legal counsel.

Resources

Review frequently asked questions and learn more about the account deletion requirements.


Guideline 2.1 - Performance - App Completeness

We found that your in-app purchase products exhibited one or more bugs which create a poor user experience. Specifically, no action took place further when tapping on the Continue button to attempt purchasing a subscription plan. Please review the details and resources below and complete the next steps.

Review device details: 

- Device type: iPad Air 11-inch (M2) 
- OS version: iPadOS 18.6

Next Steps

When validating receipts on your server, your server needs to be able to handle a production-signed app getting its receipts from Apple’s test environment. The recommended approach is for your production server to always validate receipts against the production App Store first. If validation fails with the error code "Sandbox receipt used in production," you should validate against the test environment instead.

Additionally, note that the Account Holder must accept the Paid Apps Agreement in the Business section of App Store Connect before paid in-app purchases will function.

Resources

- Learn how to set up and test in-app purchase products in the sandbox environment.
- Learn more about validating receipts with the App Store.

ine 3.1.2 - Business - Payments - Subscriptions
Issue Description

The submission did not include all the required information for apps offering auto-renewable subscriptions.

The app's binary is missing the following required information:

- Price of subscription, and price per unit if appropriate
Guidel

The app's metadata is missing the following required information:

- A functional link to the Terms of Use (EULA). If you are using the standard Apple Terms of Use (EULA), include a link to the Terms of Use in the App Description. If you are using a custom EULA, add it in App Store Connect.

Next Steps

Update the app binary and metadata to include the information specified above.

Resources

Apps offering auto-renewable subscriptions must include all of the following required information in the binary:

- Title of auto-renewing subscription (this may be the same as the in-app purchase product name)
- Length of subscription
- Price of subscription, and price per unit if appropriate
- Functional links to the privacy policy and Terms of Use (EULA)

The app metadata must also include functional links to the privacy policy in the Privacy Policy field in App Store Connect and the Terms of Use (EULA) in the App Description or EULA field in App Store Connect.

Review Schedule 2 of the Apple Developer Program License Agreement to learn more.


Guideline 2.5.4 - Performance - Software Requirements

The app declares support for audio in the UIBackgroundModes key in your Info.plist but we are unable to locate any features that require persistent audio.

Background audio is intended for use by apps that provide audible content to the user while in the background, such as music player, music creation, or streaming audio apps. 

Next Steps

If the app has a feature that requires persistent audio, reply to this message and let us know how to locate this feature. If the app does not have a feature that requires persistent audio, it would be appropriate to remove the "audio" setting from the UIBackgroundModes key.

Resources 

- Learn more about software requirements in guideline 2.5.4.
- Review documentation for the UIBackgroundModes key.


Guideline 1.5 - Safety
Issue Description

The Support URL provided in App Store Connect, https://www.getsuperinvoice.com/contact, is currently not functional and/or displays an error. 

Next Steps

Update the specified Support URL to direct users to a functional webpage with support information.

Resources

Learn about Support URLs and other platform version information on App Store Connect Help.


Support

- Reply to this message in your preferred language if you need assistance. If you need additional support, use the Contact Us module.
- Consult with fellow developers and Apple engineers on the Apple Developer Forums.
- Provide feedback on this message and your review experience by completing a short survey.