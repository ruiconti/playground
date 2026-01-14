// Example: Binary Search
// Run with: make run FILE=example

#include <stdio.h>

int binary_search(int arr[], int n, int target) {
    int left = 0;
    int right = n - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }

    return -1;
}

int main(void) {
    int arr[] = {1, 3, 5, 7, 9, 11, 13};
    int n = sizeof(arr) / sizeof(arr[0]);

    printf("%d\n", binary_search(arr, n, 7));  // 3
    printf("%d\n", binary_search(arr, n, 4));  // -1

    return 0;
}
