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
Docs
Tracking Methods
Autocapture
Autocapture
What is Autocapture?
Autocapture allows you to capture information about your website with minimal setup. Once enabled via SDK, Autocapture automatically captures frontend events like page views, button clicks, and form interactions.

Availability
Autocapture is available on all plans. Autocapture is currently available for web only via Mixpanel’s Javascript SDK. To turn it on, ensure you have the config {autocapture: true} set in the SDK.

Autocapture events
By default, Autocapture will automatically collect the following predefined events with minimal engineering:

Pageviews
Page scrolls
Form interactions (e.g., form submitted)
Element interactions, including clicks and changes on page elements
Attribution
Rage clicks
When you enable Autocapture, you will start collecting these predefined events and property types, and they will appear for your use in analysis in your Mixpanel instance. Within your Mixpanel instance, these events will be displayed using preset labels such as “[Auto] Page View” and “[Auto] Element Click”.

Autocapture events will all be tracked as events that start with $mp_ and will start with [Auto] as a prefix in Mixpanel, so if used in combination with other tracking and ingestion methods, you will be able to tell the difference.

Autocapture rage clicks
A rage click is when a user clicks on the same spot on your webpage in quick succession. It happens because the user expects something to happen, but nothing does — so they click again and again, showing they are frustrated. Rage clicks are tracked as [Auto] Rage Click events.

By default, Mixpanel considers 4 clicks within a second and 30 pixels apart as a rage click. You can configure these qualifying criteria to something that best suits your application by overriding the defaults in the Javascript SDK.

Autocapture vs Precision Tracking
There are two ways to capture events:

Autocapture allows you to automatically collect a predefined set of events and properties. It is the best option for getting started quickly.
Precision tracking allows you to instrument events and properties specific to your business needs and desired analyses. This is the best option when you want to perform deeper and more customized analyses.
Autocapture can coexist with more precise tracking — you can both enable Autocapture and instrument specific events. You don’t have to choose one solution over the other.

Configuring Autocapture
If you subscribe to automatic SDK updates, please note that these updates will not change your Autocapture configuration.

If you are an existing customer, we do not recommend changes to your SDK implementation (including turning on Autocapture) without speaking to a member of the Mixpanel team.

Customers adding the Javascript SDK with a snippet that contains an enabled autocapture config will turn on autocapture. If this config is not present in the snippet, Autocapture will not be enabled. Our documentation on how to configure the Javascript SDK, including changing your Autocapture configuration, can be found here.

Disabling Autocapture
You can disable Autocapture by setting the config in the Javascript SDK. Disabling Autocapture does not disable session recording, which is configured separately in the Javascript SDK. Learn more about detailed configuration here.

Manage your event volume
Mixpanel recommends monitoring your event volume (in Settings > Organization Settings > Plan Details & Billing) as you make changes to ensure it matches your expectations.

At any time, you can change your configuration to only capture clicks on specified elements (or elements with certain classes), track on specific pages, or turn click tracking off while still taking advantage of other Autocapture data (pageviews, submits, etc.). Learn more about detailed configuration here.

Privacy and security
The default configuration of Autocapture is designed to strike a balance between automatically capturing meaningful events while excluding potentially sensitive data. At the same time, the technical design of your website, your industry, the purpose of your website, and compliance requirements across jurisdictions can vary greatly. As a result, your close review of the data derived from Autocapture is always recommended. Because there is no one-size-fits-all approach to event analytics, it’s our customers’ responsibility to ensure the configuration of Mixpanel on their website complies with applicable data privacy laws and regulations and their Mixpanel’s Services Agreement.

In certain contexts, a flexible configuration of Autocapture or turning off Autocapture may be appropriate to enable your company’s privacy and compliance requirements. In particular, if the purpose of your website involves the capture of highly sensitive data like Protected Health Information (PHI), we do not recommend using Autocapture. If you have entered into a BAA (Business Associate Agreement) with Mixpanel, we do not recommend using Autocapture.

As an analytics provider, Mixpanel is committed to designing features to facilitate data privacy for our customers and their end-users. While it’s our customers’ responsibility to ensure use of Mixpanel complies with data privacy law, we offer a privacy-first approach to autocapture, including default omission of input elements, designed to help you complete data minimization and comply with data privacy law. We’ve additionally provided you with the following tools and resources to help you adhere to applicable data privacy legislation.

Default protections
Autocapture’s default settings also include the following privacy and security considerations:

Sensitive elements — such as end user text inputs, selects, and textarea elements, are default-excluded from tracking. You can view our default configurations and options here.
By default, Autocapture will not collect sensitive input fields like passwords or form fields — it will only capture a limited set of HTML attributes like class, name, aria-label, role, title, and type attribute values. No content populated by an end user will be collected.
By default, Autocapture will not capture the text that your website or app displays (textContent and its children).
The exception to these attribute collection rules is when an element has an explicit attribute added with the prefix “mp-track-”. This allows data in these attributes to be intentionally passed back to Mixpanel.
Mixpanel also provides flexibility to define the classes pages of your website for which you configure Autocapture by using and block_selectors and block_url_regexes.
To change these default settings, you can customize what is collected through your SDK configuration.

Additional privacy and security options
For any element on your website / web application you do not want to track, there are built-in selector options to omit it. You can add any element to the .mp-no-track class to omit it. You can also opt an individual element out of being included in any tracking (including the ‘elements’ prop of another target’s event) using .mp-sensitive.

Alternatively, you can update your Autocapture configuration using different blocking options, including blocking tracking of certain classes or certain URLs. You can read more about this here.