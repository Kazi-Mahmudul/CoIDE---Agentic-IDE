"""
3Sum Problem
Given an integer array nums, return all unique triplets [a, b, c] in the array
such that a + b + c == 0.

Solution: Sort the array, then use two-pointer technique for each element.
Time Complexity: O(n^2)
Space Complexity: O(1) excluding output
"""

from typing import List


def three_sum(nums: List[int]) -> List[List[int]]:
    """Return all unique triplets that sum to zero."""
    nums.sort()
    n = len(nums)
    result = []

    for i in range(n - 2):
        # Skip duplicates for the first element
        if i > 0 and nums[i] == nums[i - 1]:
            continue

        # Early termination: if smallest number is positive, no sum can be zero
        if nums[i] > 0:
            break

        left, right = i + 1, n - 1
        target = -nums[i]

        while left < right:
            current_sum = nums[left] + nums[right]

            if current_sum == target:
                result.append([nums[i], nums[left], nums[right]])

                # Skip duplicates for the second element
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                # Skip duplicates for the third element
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1

                left += 1
                right -= 1

            elif current_sum < target:
                left += 1
            else:
                right -= 1

    return result


# ---- Test cases ----
if __name__ == "__main__":
    test_cases = [
        ([-1, 0, 1, 2, -1, -4], [[-1, -1, 2], [-1, 0, 1]]),
        ([], []),
        ([0, 0, 0, 0], [[0, 0, 0]]),
        ([0, 1, 1], []),
        ([-2, 0, 1, 1, 2], [[-2, 0, 2], [-2, 1, 1]]),
    ]

    for i, (nums, expected) in enumerate(test_cases):
        output = three_sum(nums)
        print(f"Test {i + 1}: nums = {nums}")
        print(f"  Output:   {output}")
        print(f"  Expected: {expected}")
        print(f"  {'PASS' if output == expected else 'FAIL'}\n")
