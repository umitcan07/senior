OPERATION_COSTS = {"insert": 1, "delete": 1, "substitute": 2}

def edit_operations(actual, target):
    """
    Returns list of edit operations comparing actual (what was said) to target (what should be said).
    
    Operations are from the perspective of the speaker:
    - insert: Something extra in actual that shouldn't be there (position in actual sequence)
    - delete: Something missing from actual that should be there (position in target sequence)
    - substitute: Changed FROM target TO actual (position in actual sequence, includes both values)
    
    Args:
        actual: List of symbols/words from what was actually said
        target: List of symbols/words from what should have been said
    
    Returns:
        List of tuples: (operation_type, position, ...)
        - ("insert", pos): Extra element at actual[pos]
        - ("delete", pos): Missing target element at target position pos
        - ("substitute", pos, expected, actual_val): Changed expected -> actual_val at actual[pos]
    """
    m, n = len(actual), len(target)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    # Base cases: converting actual to target
    for i in range(m + 1):
        dp[i][0] = i * OPERATION_COSTS["insert"]  # Remove extra elements from actual
    for j in range(n + 1):
        dp[0][j] = j * OPERATION_COSTS["delete"]  # Add missing elements from target
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if actual[i - 1] == target[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                insert_cost = dp[i - 1][j] + OPERATION_COSTS["insert"]  # Remove from actual
                delete_cost = dp[i][j - 1] + OPERATION_COSTS["delete"]  # Add from target
                substitute_cost = dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]
                dp[i][j] = min(insert_cost, delete_cost, substitute_cost)
    
    ops = []
    i, j = m, n
    
    while i > 0 or j > 0:
        if i > 0 and j > 0 and actual[i - 1] == target[j - 1]:
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]:
            # Substitute: changed FROM target[j-1] TO actual[i-1]
            ops.append(("substitute", i - 1, target[j - 1], actual[i - 1]))
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + OPERATION_COSTS["insert"]:
            # Insert: extra element in actual at position i-1
            ops.append(("insert", i - 1, actual[i - 1]))
            i -= 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + OPERATION_COSTS["delete"]:
            # Delete: missing element from target at position j-1
            ops.append(("delete", j - 1, target[j - 1]))
            j -= 1
        else:
            if i > 0:
                ops.append(("insert", i - 1, actual[i - 1]))
                i -= 1
            elif j > 0:
                ops.append(("delete", j - 1, target[j - 1]))
                j -= 1
    
    ops.reverse()
    return ops
