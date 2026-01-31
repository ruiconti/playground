#!/usr/bin/env bun
/**
 * Learning System CLI
 *
 * Commands:
 *   bun .claude/learning/cli.ts status          - Show due items and stats
 *   bun .claude/learning/cli.ts due             - List items due for review (JSON)
 *   bun .claude/learning/cli.ts add             - Add new item (interactive via stdin)
 *   bun .claude/learning/cli.ts review <id> <rating>  - Record review result (0-4)
 *   bun .claude/learning/cli.ts get <id>        - Get item details
 *   bun .claude/learning/cli.ts list [tag]      - List all items, optionally filtered
 */

const STATE_FILE = ".claude/learning-state.json";

interface LearningItem {
  id: string;
  concept: string;
  context: string;
  details: string;
  tags: string[];
  created_at: string;
  last_reviewed: string | null;
  next_review: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  success_count: number;
}

interface ReviewRecord {
  item_id: string;
  date: string;
  success: boolean;
  rating: number;
}

interface LearningState {
  version: number;
  items: LearningItem[];
  review_history: ReviewRecord[];
  settings: {
    min_interval_days: number;
    max_interval_days: number;
    default_ease_factor: number;
    ease_bonus: number;
    ease_penalty: number;
    min_ease_factor: number;
  };
}

async function loadState(): Promise<LearningState> {
  try {
    const file = Bun.file(STATE_FILE);
    const exists = await file.exists();
    if (!exists) throw new Error("File not found");
    const text = await file.text();
    if (!text.trim()) throw new Error("Empty file");
    return JSON.parse(text) as LearningState;
  } catch {
    return {
      version: 1,
      items: [],
      review_history: [],
      settings: {
        min_interval_days: 1,
        max_interval_days: 365,
        default_ease_factor: 2.5,
        ease_bonus: 0.1,
        ease_penalty: 0.2,
        min_ease_factor: 1.3,
      },
    };
  }
}

async function saveState(state: LearningState): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function generateId(): string {
  return crypto.randomUUID();
}

function getDueItems(state: LearningState): LearningItem[] {
  const now = today();
  return state.items.filter((item) => item.next_review <= now);
}

function calculateNextReview(
  item: LearningItem,
  rating: number,
  settings: LearningState["settings"]
): { interval_days: number; ease_factor: number; next_review: string } {
  let { interval_days, ease_factor } = item;
  const { review_count } = item;

  if (rating < 2) {
    // Failed - reset interval
    interval_days = settings.min_interval_days;
    ease_factor = Math.max(ease_factor - settings.ease_penalty, settings.min_ease_factor);
  } else {
    // Success - extend interval
    if (review_count === 0) {
      interval_days = 1;
    } else if (review_count === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }

    interval_days = Math.min(interval_days, settings.max_interval_days);

    if (rating === 2) {
      ease_factor = Math.max(ease_factor - settings.ease_penalty / 2, settings.min_ease_factor);
    } else if (rating >= 4) {
      ease_factor = ease_factor + settings.ease_bonus;
    }
  }

  return {
    interval_days,
    ease_factor,
    next_review: addDays(today(), interval_days),
  };
}

async function cmdStatus(): Promise<void> {
  const state = await loadState();
  const due = getDueItems(state);
  const total = state.items.length;

  // Calculate success rate from last 30 reviews
  const recent = state.review_history.slice(-30);
  const successRate = recent.length > 0
    ? Math.round((recent.filter((r) => r.success).length / recent.length) * 100)
    : 0;

  // Upcoming in next 7 days
  const weekFromNow = addDays(today(), 7);
  const upcoming = state.items.filter(
    (item) => item.next_review > today() && item.next_review <= weekFromNow
  ).length;

  console.log(`Learning System Status`);
  console.log(`======================`);
  console.log(`Total concepts: ${total}`);
  console.log(`Due for review: ${due.length}`);
  console.log(`Upcoming (7 days): ${upcoming}`);
  if (recent.length > 0) {
    console.log(`Success rate (last ${recent.length}): ${successRate}%`);
  }

  if (due.length > 0) {
    console.log(`\nDue Today:`);
    for (const item of due) {
      const rate = item.review_count > 0
        ? Math.round((item.success_count / item.review_count) * 100)
        : 0;
      const lastReview = item.last_reviewed
        ? `last reviewed ${item.last_reviewed}`
        : "never reviewed";
      console.log(`  - ${item.concept} (${lastReview}, ${rate}% success)`);
    }
  }
}

async function cmdDue(): Promise<void> {
  const state = await loadState();
  const due = getDueItems(state);
  console.log(JSON.stringify(due, null, 2));
}

async function cmdAdd(): Promise<void> {
  // Read JSON from stdin
  const input = await Bun.stdin.text();
  const data = JSON.parse(input) as {
    concept: string;
    context: string;
    details: string;
    tags: string[];
  };

  const state = await loadState();
  const item: LearningItem = {
    id: generateId(),
    concept: data.concept,
    context: data.context,
    details: data.details,
    tags: data.tags,
    created_at: today(),
    last_reviewed: null,
    next_review: addDays(today(), 1),
    interval_days: 1,
    ease_factor: state.settings.default_ease_factor,
    review_count: 0,
    success_count: 0,
  };

  state.items.push(item);
  await saveState(state);

  console.log(JSON.stringify({ success: true, id: item.id, next_review: item.next_review }));
}

async function cmdReview(id: string, rating: number): Promise<void> {
  const state = await loadState();
  const item = state.items.find((i) => i.id === id);

  if (!item) {
    console.log(JSON.stringify({ success: false, error: "Item not found" }));
    return;
  }

  const success = rating >= 2;
  const update = calculateNextReview(item, rating, state.settings);

  item.interval_days = update.interval_days;
  item.ease_factor = update.ease_factor;
  item.next_review = update.next_review;
  item.last_reviewed = today();
  item.review_count += 1;
  if (success) item.success_count += 1;

  state.review_history.push({
    item_id: id,
    date: today(),
    success,
    rating,
  });

  await saveState(state);

  console.log(
    JSON.stringify({
      success: true,
      recalled: success,
      next_review: item.next_review,
      interval_days: item.interval_days,
    })
  );
}

async function cmdGet(id: string): Promise<void> {
  const state = await loadState();
  const item = state.items.find((i) => i.id === id);
  if (item) {
    console.log(JSON.stringify(item, null, 2));
  } else {
    console.log(JSON.stringify({ error: "Not found" }));
  }
}

async function cmdList(tag?: string): Promise<void> {
  const state = await loadState();
  let items = state.items;
  if (tag) {
    items = items.filter((i) => i.tags.includes(tag));
  }
  console.log(JSON.stringify(items, null, 2));
}

// Main
const [cmd, ...args] = Bun.argv.slice(2);

switch (cmd) {
  case "status":
    await cmdStatus();
    break;
  case "due":
    await cmdDue();
    break;
  case "add":
    await cmdAdd();
    break;
  case "review":
    if (args.length < 2) {
      console.error("Usage: review <id> <rating>");
      process.exit(1);
    }
    await cmdReview(args[0], parseInt(args[1], 10));
    break;
  case "get":
    if (args.length < 1) {
      console.error("Usage: get <id>");
      process.exit(1);
    }
    await cmdGet(args[0]);
    break;
  case "list":
    await cmdList(args[0]);
    break;
  default:
    console.log(`Usage: bun .claude/learning/cli.ts <command>

Commands:
  status              Show due items and stats
  due                 List items due for review (JSON)
  add                 Add new item (reads JSON from stdin)
  review <id> <rating>  Record review result (rating: 0-4)
  get <id>            Get item details
  list [tag]          List all items, optionally filtered by tag`);
}
