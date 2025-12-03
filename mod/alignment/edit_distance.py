OPERATION_COSTS = {"insert": 1, "delete": 1, "substitute": 2}

def edit_operations(actual, reference):
    """
    Returns list of edit operations to convert actual to reference.
    Operations use indices from the original actual list.
    """
    m, n = len(actual), len(reference)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    for i in range(m + 1):
        dp[i][0] = i * OPERATION_COSTS["delete"]
    for j in range(n + 1):
        dp[0][j] = j * OPERATION_COSTS["insert"]
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if actual[i - 1] == reference[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                delete_cost = dp[i - 1][j] + OPERATION_COSTS["delete"]
                insert_cost = dp[i][j - 1] + OPERATION_COSTS["insert"]
                substitute_cost = dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]
                dp[i][j] = min(delete_cost, insert_cost, substitute_cost)
    
    ops = []
    i, j = m, n
    
    while i > 0 or j > 0:
        if i > 0 and j > 0 and actual[i - 1] == reference[j - 1]:
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]:
            ops.append(("substitute", i - 1, reference[j - 1]))
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + OPERATION_COSTS["delete"]:
            ops.append(("delete", i - 1))
            i -= 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + OPERATION_COSTS["insert"]:
            ops.append(("insert", i, reference[j - 1]))
            j -= 1
        else:
            if i > 0:
                ops.append(("delete", i - 1))
                i -= 1
            elif j > 0:
                ops.append(("insert", i, reference[j - 1]))
                j -= 1
    
    ops.reverse()
    return ops
