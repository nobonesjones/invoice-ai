#!/usr/bin/env node

/**
 * App Store Log Cleanup Script
 * Removes debug/development logs while preserving essential error handling
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define log patterns to remove
const LOG_PATTERNS_TO_REMOVE = [
  // Analytics and testing logs
  /console\.log\([^)]*\[Analytics[^\]]*\][^)]*\);?/g,
  /console\.log\([^)]*🧪[^)]*\);?/g,
  /console\.log\([^)]*TEST[^)]*\);?/g,
  
  // AI and Chat debugging
  /console\.log\([^)]*\[AI[^)]*\][^)]*\);?/g,
  /console\.log\([^)]*\[Chat[^)]*\][^)]*\);?/g,
  /console\.log\([^)]*\[useAIChat\][^)]*\);?/g,
  /console\.log\([^)]*\[Assistant[^)]*\][^)]*\);?/g,
  
  // Debug logs
  /console\.log\([^)]*🐛[^)]*\);?/g,
  /console\.log\([^)]*DEBUG[^)]*\);?/g,
  /console\.log\([^)]*debug[^)]*\);?/g,
  
  // Onboarding tracking
  /console\.log\([^)]*\[Onboarding[^)]*\][^)]*\);?/g,
  
  // Voice and transcription logs
  /console\.log\([^)]*\[Voice[^)]*\][^)]*\);?/g,
  /console\.log\([^)]*\[Transcrib[^)]*\][^)]*\);?/g,
  
  // Success/status logs (keeping errors)
  /console\.log\([^)]*✅[^)]*\);?/g,
  /console\.log\([^)]*🚀[^)]*\);?/g,
  /console\.log\([^)]*Loading[^)]*\);?/g,
  /console\.log\([^)]*loaded[^)]*\);?/g,
  
  // Simple debug statements
  /console\.log\(['"`][^'"`]*['"`]\);?/g,
  
  // Parameter logging
  /console\.log\([^)]*'[^']*:', [^)]*\);?/g,
];

// Critical logs to preserve (error handling, auth, payments)
const PRESERVE_PATTERNS = [
  /console\.error/,
  /console\.warn.*error/i,
  /console\.log.*error/i,
  /console\.log.*failed/i,
  /console\.log.*auth/i,
  /console\.log.*payment/i,
  /console\.log.*subscription/i,
];

// Directories to process
const TARGET_DIRS = [
  'app/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}', 
  'services/**/*.{ts,tsx}',
  'hooks/**/*.{ts,tsx}',
  'context/**/*.{ts,tsx}',
  'utils/**/*.{ts,tsx}'
];

let totalRemoved = 0;
let filesModified = 0;

function shouldPreserveLog(logStatement) {
  return PRESERVE_PATTERNS.some(pattern => pattern.test(logStatement));
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let removedCount = 0;
  
  // Apply each removal pattern
  LOG_PATTERNS_TO_REMOVE.forEach(pattern => {
    const matches = modified.match(pattern) || [];
    
    matches.forEach(match => {
      // Check if this log should be preserved
      if (!shouldPreserveLog(match)) {
        modified = modified.replace(match, '');
        removedCount++;
      }
    });
  });
  
  // Clean up empty lines and extra whitespace
  modified = modified
    .replace(/^\s*\n/gm, '') // Remove empty lines
    .replace(/\n\s*\n\s*\n/g, '\n\n'); // Collapse multiple empty lines
  
  if (removedCount > 0) {
    fs.writeFileSync(filePath, modified);
    console.log(`✅ ${path.relative(process.cwd(), filePath)}: Removed ${removedCount} logs`);
    filesModified++;
    totalRemoved += removedCount;
  }
}

function main() {
  console.log('🧹 Starting App Store log cleanup...\n');
  
  TARGET_DIRS.forEach(pattern => {
    const files = glob.sync(pattern);
    files.forEach(processFile);
  });
  
  console.log(`\n🎉 Cleanup complete!`);
  console.log(`📊 Files modified: ${filesModified}`);
  console.log(`🗑️  Total logs removed: ${totalRemoved}`);
  console.log(`\n⚠️  Remember to test the app thoroughly after cleanup!`);
}

if (require.main === module) {
  main();
}

module.exports = { processFile, LOG_PATTERNS_TO_REMOVE, PRESERVE_PATTERNS };