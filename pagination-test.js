// Test pagination calculations
const canvasHeight = 560;
const itemRowHeight = 20;
const firstItemY = 210;
const footerStartY = 410;

// Calculate available space and max items
const availableSpaceFirstPage = footerStartY - firstItemY;
const maxItemsFirstPage = Math.floor(availableSpaceFirstPage / itemRowHeight);

const totalItems = 15; // Our test data
const scaleFactor = totalItems >= 9 && totalItems <= 11 ? 0.75 : 1.0;
const scaledRowHeight = Math.floor(itemRowHeight * scaleFactor);
const itemsPerSubsequentPage = Math.floor((canvasHeight - 50) / scaledRowHeight);

const preliminaryTotalPages = totalItems > maxItemsFirstPage ? 
  1 + Math.ceil((totalItems - maxItemsFirstPage) / itemsPerSubsequentPage) : 1;

const isTwoPageInvoice = preliminaryTotalPages === 2;
const isCompactMode = totalItems >= 9 && totalItems <= 11;
const adjustedMaxItemsFirstPage = isTwoPageInvoice ? 12 : (isCompactMode ? 11 : maxItemsFirstPage);

const actualNeedsPagination = totalItems > adjustedMaxItemsFirstPage;
const actualFirstPageItems = totalItems > adjustedMaxItemsFirstPage ? adjustedMaxItemsFirstPage : totalItems;
const actualRemainingItems = totalItems > adjustedMaxItemsFirstPage ? totalItems - adjustedMaxItemsFirstPage : 0;

const totalPages = actualNeedsPagination ? 
  1 + Math.ceil(actualRemainingItems / itemsPerSubsequentPage) : 1;

console.log('PAGINATION TEST RESULTS:');
console.log('========================');
console.log(`Total Items: ${totalItems}`);
console.log(`Available Space First Page: ${availableSpaceFirstPage}px`);
console.log(`Item Row Height: ${itemRowHeight}px -> Scaled: ${scaledRowHeight}px`);
console.log(`Max Items First Page: ${maxItemsFirstPage} -> Adjusted: ${adjustedMaxItemsFirstPage}`);
console.log(`Items Per Subsequent Page: ${itemsPerSubsequentPage}`);
console.log(`Is Compact Mode: ${isCompactMode} (Scale Factor: ${scaleFactor})`);
console.log(`Is Two Page Invoice: ${isTwoPageInvoice}`);
console.log(`Actual Needs Pagination: ${actualNeedsPagination}`);
console.log(`First Page Items: ${actualFirstPageItems}`);
console.log(`Remaining Items: ${actualRemainingItems}`);
console.log(`Total Pages: ${totalPages}`); 