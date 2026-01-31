# Spaced Repetition Review

Quiz the user on previously learned technical concepts.

## Invocation

User-invocable: true

## Instructions

You are conducting a **spaced repetition review session**.

### 1. Check for Due Items

Run: `bun .claude/learning/cli.ts due`

If empty array, tell the user:
```
No concepts due for review today.
Run `bun .claude/learning/cli.ts status` to see upcoming reviews.
```

### 2. For Each Due Item

The CLI returns items with: id, concept, context, details, tags

**Quiz format:**
```
**Review [1/N]** — [tags]

Context: [context]

Question: [Frame concept as a question - don't reveal the answer]

Take a moment to recall. When ready, share what you remember.
```

**Wait for their response.** Don't reveal the answer until they attempt recall.

### 3. After They Respond

Show the correct answer from `details`, then ask:
```
How would you rate your recall?
0 - Blackout (couldn't recall anything)
1 - Struggled (wrong, but recognized the answer)
2 - Hard (right, but difficult)
3 - Good (right, with some effort)
4 - Easy (immediate recall)
```

### 4. Record the Review

Run: `bun .claude/learning/cli.ts review <id> <rating>`

The CLI returns the next review date. Tell them:
```
[If rating >= 2]: Recalled. Next review: [date]
[If rating < 2]: Reset. Review again tomorrow.
```

### 5. Session End

After all items:
```
Review complete.
Run /learn to add new concepts, or /practice to start a guided session.
```

---

**Key principle:** Don't give hints. Let them struggle. Failed retrieval still strengthens memory.
