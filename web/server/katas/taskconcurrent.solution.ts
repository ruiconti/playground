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

// =============================================================================
// STUB IMPLEMENTATION
// =============================================================================

export function createTaskExecutor(options: TaskExecutorOptions): TaskExecutor {
    const tasks = new Map<string, Task>();
    const queue: string[] = [];
    let running = 0;
    let nextId = 1;

    const tryRunNext = () => {
        while (running < options.maxConcurrency && queue.length > 0) {
            // Sort queue by priority if applicable
            queue.sort((a, b) => {
                const taskA = tasks.get(a)!;
                const taskB = tasks.get(b)!;
                return (taskB.priority ?? 0) - (taskA.priority ?? 0);
            });

            const taskId = queue.shift()!;
            const task = tasks.get(taskId)!;

            if (task.status === 'cancelled') continue;

            task.status = 'running';
            task.started_at = Date.now();
            running++;

            const timeoutId = task.timeout_ms
                ? setTimeout(() => {
                    if (task.status === 'running') {
                        task.status = 'failed';
                        task.completed_at = Date.now();
                        running--;
                        tryRunNext();
                    }
                }, task.timeout_ms)
                : null;

            setTimeout(() => {
                if (task.status === 'running') {
                    if (timeoutId) clearTimeout(timeoutId);
                    task.status = 'completed';
                    task.completed_at = Date.now();
                    running--;
                    tryRunNext();
                }
            }, task.duration_ms);
        }
    };

    return {
        createTask(request: CreateTaskRequest): CreateTaskResponse {
            const taskId = String(nextId++);
            const task: Task = {
                task_id: taskId,
                status: 'queued',
                duration_ms: request.duration_ms,
                priority: request.priority,
                timeout_ms: request.timeout_ms
            };

            tasks.set(taskId, task);
            queue.push(taskId);

            const willRunImmediately = running < options.maxConcurrency;
            tryRunNext();

            return {
                task_id: taskId,
                status: willRunImmediately ? 'running' : 'queued'
            };
        },

        getTask(taskId: string): TaskStatusResponse | null {
            const task = tasks.get(taskId);
            if (!task) return null;

            return {
                task_id: task.task_id,
                status: task.status,
                started_at: task.started_at,
                completed_at: task.completed_at
            };
        },

        getStats(): StatsResponse {
            let queued = 0;
            let completed = 0;

            for (const task of tasks.values()) {
                if (task.status === 'queued') queued++;
                else if (task.status === 'completed') completed++;
            }

            return { running, queued, completed };
        },

        cancelTask(taskId: string): boolean {
            const task = tasks.get(taskId);
            if (!task) return false;

            if (task.status === 'running') {
                return false; // Cannot cancel running task
            }

            if (task.status === 'queued') {
                task.status = 'cancelled';
                const idx = queue.indexOf(taskId);
                if (idx > -1) queue.splice(idx, 1);
                return true;
            }

            return false;
        }
    };
}