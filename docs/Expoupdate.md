Upgrade Expo SDK
Learn how to incrementally upgrade the Expo SDK version in your project.


We recommend upgrading SDK versions incrementally, one at a time. Doing so will help you pinpoint breakages and issues that arise during the upgrade process.
With a new SDK release, the latest version enters the current release status. This applies to Expo Go as it only supports the latest SDK version and previous versions are no longer supported. We recommend using development builds for production apps as the backwards compatibility for older SDK versions on EAS services tends to be much longer, but not forever.

If you are looking to install a specific version of Expo Go, visit expo.dev/go. It supports downloads for Android devices/emulators and iOS simulators. However, due to iOS platform restrictions, only the latest version of Expo Go is available for installation on physical iOS devices.

How to upgrade to the latest SDK version
1

Upgrade the Expo SDK
Install the new version of the Expo package:


npm


Yarn

Terminal
npx expo install expo@latest
npx expo install expo@^52.0.0
2

Upgrade dependencies
Upgrade all dependencies to match the installed SDK version.

Terminal

Copy

npx expo install --fix
3

Update native projects
If you use Continuous Native Generation: Delete the android and ios directories if you generated them for a previous SDK version in your local project directory. They'll be re-generated next time you run a build, either with npx expo run:ios, npx expo prebuild, or with EAS Build.
If you don't use Continuous Native Generation: Run npx pod-install if you have an ios directory. Apply any relevant changes from the Native project upgrade helper. Alternatively, you could consider adopting prebuild for easier upgrades in the future.
4

Follow the release notes for any other instructions
Read the SDK changelogs for the SDK version you are upgrading to. They contain important information about breaking changes, deprecations, and other changes that may affect your app. Refer to tue "Upgrading your app" section at the bottom of the release notes page for any additional instructions.

SDK Changelogs
Each SDK announcement release notes post contains information deprecations, breaking changes, and anything else that might be unique to that particular SDK version. When upgrading, be sure to check these out to make sure you don't miss anything.

SDK 52: Release notes
React Native 0.77 is available with Expo SDK 52. To upgrade, see these Release notes.
SDK 51: Release notes
SDK 50: Release notes
Deprecated SDK Version Changelogs
The following blog posts may included outdated information, but they are still useful for reference if you happen to fall far behind on SDK upgrades.

See a full list of deprecated SDK release changelogs
Previous (Push notifications - Reference)

Troubleshooting and FAQ

Next (More - Assorted)

Authentication with OAuth or OpenID providers

Was this doc helpful?



Share your feedback

Ask a question on the forums

Edit this page

Last updated on February 13, 2025