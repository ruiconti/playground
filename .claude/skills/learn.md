# Record Learning

Record a technical concept for spaced repetition review.

## Invocation

User-invocable: true

## Instructions

### When to Record

Learning happens from many sources:
- Explanations received (how something works)
- Discussions (architecture, tradeoffs, mental models)
- Code reviews / reading code
- Debugging sessions
- Questions answered about fundamentals

Good candidates:
- Mental model clarifications
- Connections between concepts
- Counterintuitive behaviors
- Patterns and their rationale
- Gotchas and common mistakes

Skip: trivial facts, project-specific details, things already ingrained.

### Recording Flow

**1. Identify what to record**

If user runs `/learn` without context:
```
What concept do you want to remember?
```

If there's conversation context, suggest:
```
From our conversation, worth remembering:
1. [Concept] - [why it's valuable]
2. [Concept] - [why it's valuable]

Which should we add?
```

**2. Gather the details**

- **Concept** (3-7 words): "How TCP congestion control works"
- **Context** (retrieval cue): "Discussing why the network call was slow"
- **Details** (the actual content to recall - be precise, include the 'why')
- **Tags**: rust, networking, mental-model, gotcha, etc.

**3. Confirm and save**

Show the structured item:
```
Recording:
  Concept: [concept]
  Context: [context]
  Tags: [tags]

  Details:
  [details]

Save this? (yes/edit/skip)
```

**4. Save via CLI**

```bash
echo '{"concept": "...", "context": "...", "details": "...", "tags": ["..."]}' | bun .claude/learning/cli.ts add
```

The CLI returns `{"success": true, "id": "...", "next_review": "..."}`.

Tell them:
```
Recorded. First review: [next_review]
```

### Quality Guidelines

- **Details should be quiz-able** - write as the answer to an implicit question
- **Be precise** - not "async is tricky" but "async functions return Futures that must be .awaited"
- **Include the 'why'** - reasoning transfers to new situations
- **Capture mental models** - how things work internally helps predict behavior
