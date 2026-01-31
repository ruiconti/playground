# Learning Status

View the state of the spaced repetition system.

## Invocation

User-invocable: true

## Instructions

Run: `bun .claude/learning/cli.ts status`

The CLI outputs a formatted summary. Present it to the user.

For more detail:
- `bun .claude/learning/cli.ts list` - all items as JSON
- `bun .claude/learning/cli.ts list <tag>` - filter by tag
- `bun .claude/learning/cli.ts due` - items due today as JSON
