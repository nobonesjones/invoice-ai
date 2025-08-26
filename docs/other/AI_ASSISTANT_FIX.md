# AI Assistant Duplication Fix

## Problem Summary

The app has two separate systems managing OpenAI assistants:

1. **Edge Function** (`ai-chat-assistants-poc`) - Correctly uses the assistant ID from the database
2. **App's AssistantService** - Creates NEW assistants whenever `initialize()` is called

This causes multiple assistants to be created unnecessarily.

## Root Cause

In `services/assistantService.ts`:
- The `initialize()` method calls `getOrCreateAssistant()`
- This ALWAYS creates a new assistant via `openai.beta.assistants.create()`
- This happens even though the app uses the edge function for actual AI interactions

## Solution

Since the app already uses the edge function for all AI requests, the assistant creation code in `assistantService.ts` is redundant and should be removed or disabled.

### Option 1: Remove Assistant Creation (Recommended)
Remove the assistant creation logic from `assistantService.ts` since all AI requests go through the edge function anyway.

### Option 2: Fetch from Database
Modify `assistantService.ts` to fetch the assistant ID from the database (like the edge function does) instead of creating new ones.

### Option 3: Disable Initialize
Skip the `initialize()` call since the app uses the edge function which has its own assistant management.

## Immediate Actions

1. **Stop Creating New Assistants**: Comment out or remove the `createAssistant()` method
2. **Use Database ID**: If the app needs an assistant ID, fetch it from `system_config` table
3. **Clean Up Old Assistants**: Use the OpenAI dashboard or API to delete unused assistants

## Prevention

1. **Single Source of Truth**: Only the `update-assistant.js` script should create/update assistants
2. **Database Storage**: Always use the `system_config` table as the source of truth
3. **Edge Function Only**: Since the app uses the edge function, it shouldn't need direct OpenAI assistant management