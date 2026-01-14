// Example: Binary Search
// Run with: npm run run src/example.ts

export function binarySearch<T>(arr: T[], target: T): number {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }

  return -1;
}

// Quick test
if (import.meta.url === `file://${process.argv[1]}`) {
  const arr = [1, 3, 5, 7, 9, 11, 13];
  console.log(binarySearch(arr, 7)); // 3
  console.log(binarySearch(arr, 4)); // -1
}
