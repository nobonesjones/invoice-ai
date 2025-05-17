Prompt for Implementing "Recently Added" Items in AddItemSheet.tsx:

"Modify the file /Users/harrisonjones/AAA Harrys Projects/supainvoice/app/(app)/(protected)/invoices/AddItemSheet.tsx to include a 'Recently Added' section. This section should display the last 3 items saved by the user.

Here are the detailed requirements:

State Management:
Introduce a new state variable, recentItems, of type DisplayableSavedItem[].
Data Fetching (fetchSavedItems function):
Update the Supabase query to select the created_at column from the user_saved_items table (assume this column exists and is a timestamp).
Perform an initial query to fetch the 3 most recent items by ordering by created_at descending and using limit(3). Populate the recentItems state with this data.
Perform a separate query (or use the full data from an initial broader fetch if more efficient and then sort/slice) to fetch all saved items for the current user, ordered alphabetically by item_name. This will continue to populate the savedItems state for the main searchable list. Ensure filteredSavedItems is correctly updated based on this main list and the searchQuery.
User Interface (UI) Changes:
Above the existing search bar, add a new section titled 'RECENTLY ADDED'. This title should be styled distinctively (e.g., uppercase, slightly smaller, muted color).
This section should only be visible if there are items in the recentItems state.
Display the recentItems in this section. Each item should be tappable and, when tapped, should trigger the existing handleSavedItemSelect(item) function to add it to the invoice.
The display format for each recent item should be consistent with how items are displayed in the main list (item name, description if available, and price).
Styling:
Add appropriate styles for the 'RECENTLY ADDED' section title (e.g., sectionTitleContainer, sectionTitle) and the container for the recent items list (e.g., recentItemsContainer).
Ensure there's adequate spacing above and below this new section.
Existing Functionality:
The "Add New" button, search bar, and the main list of all saved items (alphabetically sorted and searchable) should remain fully functional.
The overall modal size and behavior should be preserved."