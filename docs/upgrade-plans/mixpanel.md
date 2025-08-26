Install Mixpanel
Overview
Installing Mixpanel is easy. This guide will show you how to do it with our SDKs.

Already collect product data? Connect your Data Warehouse or via 3rd Party Integrations.

Code
Choose from the methods below. Not sure how to choose? Read our guide.

Install the SDK
Under your app’s root directory, run:

npm install mixpanel-react-native

Under your application’s iOS folder, run:

pod install

Note: For XCode 12.5+, there is a known compile issue, please refer to this workaround.

Configure the SDK
Replace YOUR_TOKEN with your project token. You can find your token here.

//Import Mixpanel API
import { Mixpanel } from "mixpanel-react-native";
 
// Set up an instance of Mixpanel
const trackAutomaticEvents = false;
const mixpanel = new Mixpanel("YOUR_TOKEN", trackAutomaticEvents);
mixpanel.init();




Integration / Framework Guides
Segment
Google Tag Manager
Ad Spend
Amazon S3
Amazon Kafka
CMS & E-Commerce
Customer.io
Freshpaint
Google Cloud Storage
Google Pubsub
Google Sheets
LaunchDarkly
mParticle
Next.js
Mobile Attribution Tracking
Rudderstack
Shopify
Vendo for Shopify ↗
Snowplow
Stripe
Tealium




Next: Identify Your Users

With Mixpanel installed, you’re now ready to identify the users who use your product.



Identify Your Users


FAQ
