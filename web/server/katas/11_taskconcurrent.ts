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
//
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
//
// NOTE: Implementations live in ./11_taskconcurrent.solution.ts.

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type Task = {
    task_id: string;
    status: TaskStatus;
    duration_ms: number;
    priority?: number;
    started_at?: number;
    completed_at?: number;
    timeout_ms?: number;
};

export type CreateTaskRequest = {
    duration_ms: number;
    priority?: number;
    timeout_ms?: number;
};

export type CreateTaskResponse = { task_id: string; status: 'queued' | 'running' };
export type TaskStatusResponse = { task_id: string; status: TaskStatus; started_at?: number; completed_at?: number };
export type StatsResponse = { running: number; queued: number; completed: number };

export interface TaskExecutor {
    createTask(request: CreateTaskRequest): CreateTaskResponse;
    getTask(taskId: string): TaskStatusResponse | null;
    getStats(): StatsResponse;
    cancelTask(taskId: string): boolean;
}

export interface TaskExecutorOptions {
    maxConcurrency: number;
}

function createSemaphore(maxConcurrency: number) {

    return {
        schedule(task)


    }
}

export function createTaskExecutor(options: TaskExecutorOptions): TaskExecutor {
    const tasks = new Map<string, Task>();
    let idseq = 0;

    return {
        createTask(request) {
            const taskId = String(idseq++);
            const task: Task = {
                task_id: taskId,
                duration_ms: 0,
                status: 'queued',
                priority: request.priority,
                timeout_ms: request.timeout_ms,
                started_at: undefined,
                completed_at: undefined,
            }
            tasks.set(taskId, task);
            return { task_id: taskId, status: 'queued' };
        },
        getTask(taskId) {
            return tasks.get(taskId) || null;
        },
        getStats() {
            return {
                running: tasks.size,
                queued: tasks.size,
                completed: tasks.size,
            }
        }
    }
}
