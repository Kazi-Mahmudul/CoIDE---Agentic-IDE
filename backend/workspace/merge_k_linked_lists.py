"""
Merge k Sorted Lists

Merge all k sorted linked lists into one sorted linked list.
"""

# Definition for singly-linked list.
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def merge_two_lists(l1: ListNode, l2: ListNode) -> ListNode:
    """Merge two sorted linked lists."""
    dummy = ListNode(0)
    curr = dummy
    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 if l1 else l2
    return dummy.next


def mergeKLists(lists) -> ListNode:
    """
    Merge k sorted linked lists using divide and conquer.

    Time Complexity: O(N log k) where N is total number of nodes, k is number of lists
    Space Complexity: O(1) excluding recursion stack
    """
    if not lists:
        return None

    # Divide and conquer: merge pairs of lists
    def merge_lists_pair(start, end):
        if start == end:
            return lists[start]
        mid = (start + end) // 2
        left = merge_lists_pair(start, mid)
        right = merge_lists_pair(mid + 1, end)
        return merge_two_lists(left, right)

    return merge_lists_pair(0, len(lists) - 1)


def list_to_linked_list(lst):
    """Convert a Python list to a linked list."""
    dummy = ListNode(0)
    curr = dummy
    for val in lst:
        curr.next = ListNode(val)
        curr = curr.next
    return dummy.next


def linked_list_to_list(node):
    """Convert a linked list to a Python list."""
    result = []
    while node:
        result.append(node.val)
        node = node.next
    return result


# Test cases
if __name__ == "__main__":
    # Example 1
    lists = [[1, 4, 5], [1, 3, 4], [2, 6]]
    heads = [list_to_linked_list(lst) for lst in lists]
    merged = mergeKLists(heads)
    print("Example 1:", linked_list_to_list(merged))
    # Expected: [1, 1, 2, 3, 4, 4, 5, 6]

    # Example 2
    lists = []
    heads = []
    merged = mergeKLists(heads)
    print("Example 2:", linked_list_to_list(merged))
    # Expected: []

    # Example 3
    lists = [[]]
    heads = [list_to_linked_list(lst) for lst in lists]
    merged = mergeKLists(heads)
    print("Example 3:", linked_list_to_list(merged))
    # Expected: []

    # Additional test: single list
    lists = [[1, 2, 3]]
    heads = [list_to_linked_list(lst) for lst in lists]
    merged = mergeKLists(heads)
    print("Single list:", linked_list_to_list(merged))
    # Expected: [1, 2, 3]

    # Additional test: empty lists mixed with non-empty
    lists = [[], [1, 2], [], [3, 4, 5]]
    heads = [list_to_linked_list(lst) for lst in lists]
    merged = mergeKLists(heads)
    print("Mixed empty lists:", linked_list_to_list(merged))
    # Expected: [1, 2, 3, 4, 5]
