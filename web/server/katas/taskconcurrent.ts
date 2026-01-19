// ## Problem 5: Bounded Concurrent Task Executor
//
// You're building a task execution service that limits concurrent work.
//
// **Requirements**:
//
// - `POST /tasks` with body `{"duration_ms": number}` queues a task, returns `{"task_id": "...", "status": "queued"|"running"}`
// - `GET /tasks/:id` returns `{"task_id": "...", "status": "queued"|"running"|"completed", "started_at"?: number, "completed_at"?: number}`
// - Maximum 3 tasks can run concurrently
// - Tasks beyond the limit are queued and start automatically when a slot opens
// - `GET /stats` returns `{"running": number, "queued": number, "completed": number}`
//
// **What this tests:**

// - Concurrency limiting (semaphore pattern)
// - Queue management
// - Async state transitions
// - Knowing how to simulate work without blocking the server
//
// **Extensions:**
//
// - Add priority: POST /tasks accepts optional priority (1-10), higher priority tasks jump the queue
// - Add DELETE /tasks/:id that cancels a queued task (error if already running)
// - Add task timeout: if a task runs longer than timeout_ms, mark it failed and free the slot