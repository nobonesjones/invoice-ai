Ok so we ar epopulationg the settings pages. 

we fixed the smooth slide transition to the account info, and i asked it to add blank pages to the rest of the items, but it fucked them up and they are going to the home page...need to ask it to remember why 

reason so we need to fix this below...

"The redirection logic in your main app layout (app/_layout.tsx) likely needs to be updated. It might be incorrectly sending you to the home screen if it doesn't recognize these new settings pages as valid destinations when you're logged in.

We fixed a similar issue for "Account Details" by making that layout aware of it. We'll need to do the same for these new pages."

the next steps are. 

fix the settings pages, get them openign nicely, but focus on the VAT pages and once sorted, we can have global settings to use in the invoice creation.. and proceed with that to finish the entire flow! 