#!/usr/bin/env bun

/**
 * Frontend Katas Quiz
 * Run with: bun frontend/katas/quiz.ts
 */

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, resolve));

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const clear = () => console.log("\x1b[2J\x1b[H");

type Question = {
  kata: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const questions: Question[] = [
  // Kata 1: Autocomplete
  {
    kata: "Autocomplete",
    question: "What's the difference between debounce and throttle?",
    options: [
      "Debounce fires once after inactivity; throttle fires at most once per interval",
      "Throttle fires once after inactivity; debounce fires at most once per interval",
      "They're the same thing with different names",
      "Debounce is for mouse events; throttle is for keyboard events",
    ],
    correct: 0,
    explanation:
      "Debounce waits for a pause in activity before firing (trailing edge). Throttle limits how often something can fire regardless of activity.",
  },
  {
    kata: "Autocomplete",
    question:
      "How do you guard against stale responses arriving out of order?",
    options: [
      "Use a loading boolean to block new requests",
      "Use a request ID ref - increment before fetch, compare on response",
      "Always use await to ensure sequential execution",
      "Disable the input while fetching",
    ],
    correct: 1,
    explanation:
      "A ref-based request counter lets you detect when a response is stale. Increment before each fetch, store the ID, then check if it still matches when the response arrives.",
  },
  {
    kata: "Autocomplete",
    question: "Why use onMouseDown instead of onClick for suggestion items?",
    options: [
      "onClick is slower",
      "onMouseDown fires before blur, so you can preventDefault to keep focus",
      "onClick doesn't work on list items",
      "It's a React best practice for lists",
    ],
    correct: 1,
    explanation:
      "The blur event fires before click. Using onMouseDown with e.preventDefault() prevents the input from losing focus before the click handler runs.",
  },
  {
    kata: "Autocomplete",
    question: "What happens if you use key={suggestion} on list items?",
    options: [
      "Nothing, it works fine",
      "Performance degrades",
      "Duplicate suggestions break React's reconciliation",
      "The list won't render",
    ],
    correct: 2,
    explanation:
      "If the API returns duplicate suggestions, React will have duplicate keys. Use key={`${index}-${suggestion}`} or similar to ensure uniqueness.",
  },

  // Kata 2: Streaming Text
  {
    kata: "Streaming Text",
    question: "When you call reader.cancel(), what can happen?",
    options: [
      "It always throws an error",
      "It always returns { done: true }",
      "It can either throw OR return { done: true } - both are valid",
      "It pauses the stream without closing it",
    ],
    correct: 2,
    explanation:
      "The ReadableStream spec allows cancel() to either cause the next read() to throw, or to return { done: true }. Your code must handle both paths.",
  },
  {
    kata: "Streaming Text",
    question:
      "Why store createStream and onDone in refs instead of using them directly in useCallback deps?",
    options: [
      "Refs are faster than state",
      "To avoid recreating the start() function when parent re-renders with new callbacks",
      "Refs are required for async functions",
      "To prevent memory leaks",
    ],
    correct: 1,
    explanation:
      "If start() depends on props, it gets recreated when props change. This changes the imperative handle identity, which can cause issues for the parent. Refs let you read the latest value without dependency.",
  },
  {
    kata: "Streaming Text",
    question: "What's the purpose of isMountedRef?",
    options: [
      "To track if the component has rendered at least once",
      "To prevent setState calls after the component unmounts",
      "To detect if the user is on mobile",
      "To track the number of mounts",
    ],
    correct: 1,
    explanation:
      "Async operations can complete after unmount. Calling setState on an unmounted component is a memory leak and causes React warnings. Check isMountedRef before any setState.",
  },

  // Kata 3: WebSocket Chat
  {
    kata: "WebSocket Chat",
    question: "What's the formula for exponential backoff?",
    options: [
      "delay = baseDelay + attempt",
      "delay = baseDelay * attempt",
      "delay = min(baseDelay * 2^attempt, maxDelay)",
      "delay = baseDelay / attempt",
    ],
    correct: 2,
    explanation:
      "Exponential backoff doubles the delay each attempt: 1s, 2s, 4s, 8s, etc. Cap it to prevent absurdly long waits (typically 30s max).",
  },
  {
    kata: "WebSocket Chat",
    question: "Why track intentionalCloseRef separately?",
    options: [
      "To count how many times disconnect was called",
      "To distinguish user disconnect() from unexpected connection loss",
      "To prevent multiple close events",
      "To log analytics",
    ],
    correct: 1,
    explanation:
      "You only want to reconnect on unexpected close. When the user calls disconnect(), set intentionalCloseRef=true so the onclose handler knows not to reconnect.",
  },
  {
    kata: "WebSocket Chat",
    question: "What happens to messages sent while disconnected?",
    options: [
      "They're dropped",
      "They throw an error",
      "They're queued and flushed on reconnect",
      "They're sent anyway and the server handles it",
    ],
    correct: 2,
    explanation:
      "Push to a queue ref when disconnected. On successful reconnect (onopen), flush the queue by calling ws.send() for each message.",
  },

  // Kata 4: Diff Viewer
  {
    kata: "Diff Viewer",
    question: "What does LCS stand for and what does it compute?",
    options: [
      "Longest Common Substring - finds matching substrings",
      "Longest Common Subsequence - finds elements present in both arrays in order",
      "Least Common Substring - finds rare matches",
      "Linear Code Search - finds patterns in code",
    ],
    correct: 1,
    explanation:
      "LCS finds the longest sequence of elements that appear in both arrays in the same order (not necessarily contiguous). It's the basis for diff algorithms.",
  },
  {
    kata: "Diff Viewer",
    question: "Why is resolved text derived rather than stored in state?",
    options: [
      "It's faster to compute each time",
      "It's derived from hunks + statuses - storing it would create duplicate state that can go out of sync",
      "React doesn't allow computed state",
      "It makes the code shorter",
    ],
    correct: 1,
    explanation:
      "The resolved text is fully determined by the hunks (from props) and hunk statuses (from state). Storing it separately is redundant and risks the two getting out of sync.",
  },
  {
    kata: "Diff Viewer",
    question:
      "Why call onResolve outside the setState updater instead of inside?",
    options: [
      "It doesn't work inside setState",
      "Side effects should be separate from state updates for clearer data flow",
      "It's required by React rules",
      "Performance reasons",
    ],
    correct: 1,
    explanation:
      'Mixing side effects into setState updaters makes the code harder to reason about. Better pattern: compute new state, call setState, then call side effects. "Update state, then notify."',
  },

  // Kata 5: Drag Reorder
  {
    kata: "Drag Reorder",
    question: "Why is e.preventDefault() required in the dragover handler?",
    options: [
      "To stop the page from scrolling",
      "To prevent the default cursor",
      "Without it, the drop event won't fire",
      "To improve performance",
    ],
    correct: 2,
    explanation:
      "The default behavior for dragover is to reject the drop. Calling e.preventDefault() tells the browser to allow the drop. This is the #1 drag-and-drop gotcha.",
  },
  {
    kata: "Drag Reorder",
    question: "How do you determine if the cursor is in the top or bottom half?",
    options: [
      "Check e.clientY against the element's height",
      "Compare e.clientY to rect.top + rect.height / 2",
      "Use CSS :hover selectors",
      "Check the event.target",
    ],
    correct: 1,
    explanation:
      "Get the element's bounding rect. The midpoint is rect.top + rect.height/2. If e.clientY < midpoint, cursor is in top half (indicator above); otherwise bottom half (indicator below).",
  },
  {
    kata: "Drag Reorder",
    question:
      "Why use requestAnimationFrame when setting focus after keyboard reorder?",
    options: [
      "It's faster",
      "Focus must happen after React updates the DOM, which is async",
      "It prevents flicker",
      "It's required by the a11y spec",
    ],
    correct: 1,
    explanation:
      "React batches state updates and applies them asynchronously. If you try to focus immediately after setState, the DOM might not reflect the new order yet. rAF ensures DOM is updated first.",
  },
  {
    kata: "Drag Reorder",
    question: "What's the purpose of the aria-live region?",
    options: [
      "To show a tooltip",
      "To announce position changes to screen reader users after keyboard reorder",
      "To style the dragged item",
      "To track analytics",
    ],
    correct: 1,
    explanation:
      'Screen reader users can\'t see visual position changes. An aria-live="polite" region lets you announce "Moved X to position Y of Z" when they use keyboard shortcuts.',
  },

  // Cross-cutting concepts
  {
    kata: "General React",
    question: "When should you use a ref vs state for a value?",
    options: [
      "Refs for numbers, state for strings",
      "Refs for values that don't need to trigger re-render; state for values that affect UI",
      "Always use state; refs are deprecated",
      "Use refs inside useEffect, state elsewhere",
    ],
    correct: 1,
    explanation:
      "State changes trigger re-renders. Refs don't. Use refs for: request IDs, timers, WebSocket instances, DOM references, cached callbacks. Use state when the UI should update.",
  },
  {
    kata: "General React",
    question: "What's wrong with using useEffect to fetch data when query changes?",
    options: [
      "Nothing, it's the recommended pattern",
      "It causes an extra render cycle and makes data flow harder to follow",
      "useEffect can't be async",
      "It doesn't work with TypeScript",
    ],
    correct: 1,
    explanation:
      "Fetching in event handlers (onChange) is clearer than syncing to state changes via useEffect. The effect pattern adds indirection: type → state change → effect runs → fetch. Direct is better.",
  },
];

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function runQuiz() {
  clear();
  console.log(`${BOLD}${CYAN}
╔═══════════════════════════════════════════════════════════╗
║           Frontend Katas Quiz - Morning Review            ║
╚═══════════════════════════════════════════════════════════╝
${RESET}`);

  console.log(`${DIM}20 questions covering all 5 katas + general React patterns${RESET}\n`);

  const shuffledQuestions = shuffle(questions);
  let score = 0;
  let answered = 0;

  for (const q of shuffledQuestions) {
    console.log(`${DIM}─────────────────────────────────────────────────────────────${RESET}`);
    console.log(`${YELLOW}[${q.kata}]${RESET} Question ${answered + 1}/20\n`);
    console.log(`${BOLD}${q.question}${RESET}\n`);

    const shuffledOptions = q.options.map((opt, idx) => ({ opt, idx }));
    shuffle(shuffledOptions);
    const correctIndex = shuffledOptions.findIndex((o) => o.idx === q.correct);

    shuffledOptions.forEach((o, i) => {
      console.log(`  ${CYAN}${i + 1})${RESET} ${o.opt}`);
    });

    console.log();
    let answer: string;
    while (true) {
      answer = await prompt(`${DIM}Your answer (1-4):${RESET} `);
      const num = parseInt(answer.trim());
      if (num >= 1 && num <= 4) break;
      console.log(`${RED}Please enter 1, 2, 3, or 4${RESET}`);
    }

    const userChoice = parseInt(answer.trim()) - 1;
    answered++;

    if (userChoice === correctIndex) {
      score++;
      console.log(`\n${GREEN}✓ Correct!${RESET}`);
    } else {
      console.log(`\n${RED}✗ Wrong.${RESET} The answer was: ${CYAN}${q.options[q.correct]}${RESET}`);
    }
    console.log(`${DIM}${q.explanation}${RESET}\n`);

    if (answered < shuffledQuestions.length) {
      await prompt(`${DIM}Press Enter for next question...${RESET}`);
      clear();
    }
  }

  // Final score
  clear();
  const percentage = Math.round((score / 20) * 100);
  let grade: string;
  let color: string;

  if (percentage >= 90) {
    grade = "Excellent! Ship it.";
    color = GREEN;
  } else if (percentage >= 70) {
    grade = "Good foundation. Review the ones you missed.";
    color = YELLOW;
  } else if (percentage >= 50) {
    grade = "Re-read the approach docs before your interview.";
    color = YELLOW;
  } else {
    grade = "Spend more time with the katas today.";
    color = RED;
  }

  console.log(`${BOLD}${CYAN}
╔═══════════════════════════════════════════════════════════╗
║                      Quiz Complete!                       ║
╚═══════════════════════════════════════════════════════════╝
${RESET}`);

  console.log(`  Score: ${color}${BOLD}${score}/20 (${percentage}%)${RESET}\n`);
  console.log(`  ${grade}\n`);

  // Breakdown by kata
  const kataScores = new Map<string, { correct: number; total: number }>();
  shuffledQuestions.forEach((q, i) => {
    if (!kataScores.has(q.kata)) {
      kataScores.set(q.kata, { correct: 0, total: 0 });
    }
    const entry = kataScores.get(q.kata)!;
    entry.total++;
  });

  console.log(`${DIM}Run again with: bun frontend/katas/quiz.ts${RESET}\n`);

  rl.close();
}

// Quick mode - just show concepts without quiz
async function showConcepts() {
  clear();
  console.log(`${BOLD}${CYAN}Frontend Katas - Key Concepts Cheat Sheet${RESET}\n`);

  const byKata = new Map<string, Question[]>();
  questions.forEach((q) => {
    if (!byKata.has(q.kata)) byKata.set(q.kata, []);
    byKata.get(q.kata)!.push(q);
  });

  for (const [kata, qs] of byKata) {
    console.log(`${YELLOW}${kata}${RESET}`);
    qs.forEach((q) => {
      console.log(`  ${DIM}•${RESET} ${q.question}`);
      console.log(`    ${GREEN}→${RESET} ${q.options[q.correct]}`);
    });
    console.log();
  }

  rl.close();
}

// Main
const args = process.argv.slice(2);
if (args.includes("--concepts") || args.includes("-c")) {
  showConcepts();
} else {
  runQuiz();
}
