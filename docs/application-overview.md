PROJECT BRIEF

App Name: (TBD — referred to as "VoiceInvoice")
Goal: Build an AI-first, voice-enabled invoicing app designed specifically for older, non-technical users. The interface should be intuitive, mobile-native, and feel familiar — inspired by WhatsApp’s UI/UX conventions.

STYLE GUIDE

Typography:

Font: San Francisco (iOS default) or similar clean sans-serif (e.g., Inter)

Font Sizes:

Titles: 22–24pt

Body: 18pt minimum

Labels: 16pt

Colors:

Background: White (#FFFFFF)

Primary Button: WhatsApp Green (#25D366)

Accent/Icons: Dark Gray (#4A4A4A)

Statuses:

Paid: Green (#2ECC71)

Due: Red (#E74C3C)

Draft: Orange (#F39C12)

Buttons:

Rounded corners (12–16px radius)

Min height: 56px

Tap targets: 48px+

Icons:

WhatsApp-style line icons (rounded edges, simple shapes)

Sourced from Heroicons, Lucide, or Feather (check profile page icons first for consistency)

STEP-BY-STEP IMPLEMENTATION

1. NAVIGATION BAR

Task: Build the fixed bottom navigation bar using familiar iconography and large labels.

Tabs:

Invoices 📄

Estimates 📈

AI 🤖

Customers 👥

Reports 📊

Profile / Settings page (not in nav bar, remain sin the top right of the screen ans is already implemented fully)

Design Specs:

Icons: 24px, centered above label

Active tab: WhatsApp green underline, bold label

Background: White with light shadow

Tab height: 72px

Touchable area: Entire tab space

2. CUSTOMERS PAGE

**Status: Finished (Initial Implementation)**

**To Do / Next Steps:**
- User can add a client from their device contacts.
- User can add more details when adding a client (e.g., address, notes - beyond current basic fields).
- Users should be able to search/filter the client list effectively.

Overview: Mimic the feel of WhatsApp conversations and contacts.

Screen: Customer List

Title: “Customers” (bold, 24pt)

Search bar at top (rounded field with magnifying glass icon)

List layout:

Left: Circular avatar with first letter or image

Center:

Name (bold, 18pt)

Last invoice summary ("$350 · Paid · 3 May")

Right: Arrow icon to open detail view

Tap opens detail view

Floating green “+ Add Customer” button bottom-right

Screen: Customer Detail View

Header: Customer name + avatar

Timeline view (chat-style):

Messages from system: "Invoice #004 · Sent · 5 May"

Status changes: “Paid · 7 May 2025”

Actions: “Created from AI assistant,” “Edited,” etc.

Style:

Each message in bubble (light grey for system, green for user actions)

Date separators (e.g., “Monday, May 6”)

Bottom section:

Floating green “+ New Invoice” button


UPDATE; 
Each customer in the list will be displayed in a card-style row modeled after a WhatsApp chat preview. Design is optimized for clarity and tap-ability, especially for older users.

List Item Components:

Left Side:

Circular avatar (40px):

Initials or profile photo if available

Placeholder color if no image uploaded

Center Column:

Customer Name:

Bold, 18pt

Truncated with ellipsis if over 1 line

Last Activity Line (smaller text, 14–16pt, muted gray):

Shows summary of most recent invoice

Format: $450 · Paid · 3 May

If no invoices yet: “No activity yet”

Right Side:

Chevron icon (> or arrow) indicating tap-to-view

Optional: Time indicator (e.g., “2d ago”) in smaller gray text

Interactive Behavior:

Whole row is tappable (48px+ height)

Swiping left could reveal quick action (optional for later): e.g., “New Invoice,” “Call”

Spacing + Aesthetic:

Padding: 16px horizontal, 12px vertical

Divider between rows (subtle light gray)

Entire layout aligns vertically with other screen elements (grid consistency)

More Details; 

Add Client Modal:

Title: “Add New Client”

Fields:

Full Name (required)

Email (optional)

Phone Number (optional)

Save button (green, full-width): “Save Client”

Success message: “Client added successfully”

Screen: Customer Detail View

Header: Customer name + avatar

Timeline view (chat-style):

Messages from system: "Invoice #004 · Sent · 5 May"

Status changes: “Paid · 7 May 2025”

Actions: “Created from AI assistant,” “Edited,” etc.

Style:

Each message in bubble (light grey for system, green for user actions)

Date separators (e.g., “Monday, May 6”)

Bottom section:

Floating green “+ New Invoice” button



3. INVOICE PAGE & MANUAL INVOICE FLOW

Screen: Invoice Dashboard

Title: “Invoices” (bold, 24pt)

Top summary card:

“This Month” → total billed → status bar (Paid vs Unpaid)

List of invoices styled to match the clients list UI:

Left: Document icon (circular badge)

Center:

Client name (bold)

Summary line: “$450 · Paid · 5 May” or “Draft · 7 May”

Right:

Time since last action (e.g., “3h ago”)

Arrow icon

Floating green “+ Create Invoice” button at bottom-right

Screen: Invoice Creation Flow (5 Steps)
Styled like a structured conversation — one panel per action.

Step 1: Select Template

Horizontal scroll view with card previews

Tap card to select (highlighted border)

Continue button (green): “Next: Add Client”

Step 2: Add Client

Search bar + recent clients (styled like Clients screen)

Circular avatar, name, recent activity shown

Tap to select

Button: “+ Add Client” (opens modal)

Continue button: “Next: Add Items”

Step 3: Add Items

Repeating input cards styled like chat bubbles:

Name (e.g., “Service”) [text field]

Description (optional) [text field]

Price [numeric]

Quantity [default 1]

Button: “+ Add Another Item”

Bottom: “Next: Add Notes”

Step 4: Notes / Terms

Large multi-line input box

Option toggle: “Save as default notes”

Bottom button: “Next: Preview”

Step 5: Preview & Send

Full-screen render of invoice (HTML template preview)

Template selector dropdown at top

Action buttons:

“Send via WhatsApp” (green)

“Send via Email”

“Copy Link”

“Save Draft”

cd ios
pod install
cd ..

4. AI INVOICE FLOW

Overview: WhatsApp-style chat with AI assistant using mic and text.

Screen: AI Assistant

Title: “AI Invoicing”

Center: Large circular mic button

Below: Text input bar with send icon

Above: Chat thread-style list:

User messages (right aligned)

Assistant messages (left aligned, green bubble)

Output like:

“Invoice created for Steve – $300, Plumbing – Due 8 May”

Button: “Preview”

Send/Preview actions per message

DATABASE STRUCTURE

Base Tables:

users

id (uuid)

name

email

created_at

clients

id (uuid)

user_id (FK to users)

name

email

phone

created_at

invoices

id (uuid)

user_id (FK)

client_id (FK)

status (enum: draft/paid/unpaid)

issue_date

due_date

total

notes

created_at

invoice_items

id (uuid)

invoice_id (FK)

name

description

price

quantity

templates

id (uuid)

name

preview_url

layout_config (JSON)

ai_interactions

id (uuid)

user_id

raw_input

parsed_json

generated_invoice_id (FK)

created_at
