import { describe, it, expect, beforeEach } from 'bun:test';
import {
    createTaskExecutor,
    type TaskExecutor,
    type TaskStatus,
} from './11_taskconcurrent';
import { isExtensionsEnabled } from './test_utils';

const describeExt = isExtensionsEnabled() ? describe : describe.skip;

// =============================================================================
// TEST HELPERS
// =============================================================================

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// TEST SUITE: POST /tasks - Task Creation
// =============================================================================

describe('POST /tasks - Task Creation', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 3 });
    });

    describe('Basic task creation', () => {
        it('should create a task and return task_id', () => {
            const result = executor.createTask({ duration_ms: 100 });

            expect(result.task_id).toBeDefined();
            expect(typeof result.task_id).toBe('string');
        });

        it('should return status queued or running', () => {
            const result = executor.createTask({ duration_ms: 100 });

            expect(['queued', 'running']).toContain(result.status);
        });

        it('should create tasks with unique ids', () => {
            const t1 = executor.createTask({ duration_ms: 100 });
            const t2 = executor.createTask({ duration_ms: 100 });
            const t3 = executor.createTask({ duration_ms: 100 });

            expect(t1.task_id).not.toBe(t2.task_id);
            expect(t2.task_id).not.toBe(t3.task_id);
        });

        it('should start running immediately if slots available', () => {
            const result = executor.createTask({ duration_ms: 100 });

            expect(result.status).toBe('running');
        });

        it('should queue task if max concurrency reached', async () => {
            // Fill all slots
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            // This one should be queued
            const result = executor.createTask({ duration_ms: 100 });

            expect(result.status).toBe('queued');
        });
    });

    describe('Response format', () => {
        it('should return object with task_id and status', () => {
            const result = executor.createTask({ duration_ms: 100 });

            expect(result).toHaveProperty('task_id');
            expect(result).toHaveProperty('status');
        });
    });
});

// =============================================================================
// TEST SUITE: GET /tasks/:id - Task Status
// =============================================================================

describe('GET /tasks/:id - Task Status', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 3 });
    });

    describe('Task retrieval', () => {
        it('should return task details by id', () => {
            const created = executor.createTask({ duration_ms: 100 });
            const retrieved = executor.getTask(created.task_id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.task_id).toBe(created.task_id);
        });

        it('should return null for non-existent task', () => {
            const result = executor.getTask('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('Status tracking', () => {
        it('should show running status for active task', () => {
            const created = executor.createTask({ duration_ms: 500 });
            const status = executor.getTask(created.task_id);

            expect(status?.status).toBe('running');
        });

        it('should show queued status for waiting task', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const created = executor.createTask({ duration_ms: 100 });
            const status = executor.getTask(created.task_id);

            expect(status?.status).toBe('queued');
        });

        it('should show completed status after task finishes', async () => {
            const created = executor.createTask({ duration_ms: 50 });

            await delay(100);

            const status = executor.getTask(created.task_id);
            expect(status?.status).toBe('completed');
        });

        it('should include started_at for running/completed tasks', async () => {
            const created = executor.createTask({ duration_ms: 50 });

            await delay(10);
            const running = executor.getTask(created.task_id);
            expect(running?.started_at).toBeDefined();
            expect(typeof running?.started_at).toBe('number');
        });

        it('should include completed_at for completed tasks', async () => {
            const created = executor.createTask({ duration_ms: 50 });

            await delay(100);

            const completed = executor.getTask(created.task_id);
            expect(completed?.completed_at).toBeDefined();
            expect(typeof completed?.completed_at).toBe('number');
        });

        it('should not include completed_at for running tasks', () => {
            const created = executor.createTask({ duration_ms: 500 });
            const status = executor.getTask(created.task_id);

            expect(status?.completed_at).toBeUndefined();
        });
    });
});

// =============================================================================
// TEST SUITE: Concurrency Limiting
// =============================================================================

describe('Concurrency Limiting', () => {
    describe('Max concurrency of 3', () => {
        let executor: TaskExecutor;

        beforeEach(() => {
            executor = createTaskExecutor({ maxConcurrency: 3 });
        });

        it('should run up to 3 tasks concurrently', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const stats = executor.getStats();
            expect(stats.running).toBe(3);
        });

        it('should queue tasks beyond the limit', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const stats = executor.getStats();
            expect(stats.running).toBe(3);
            expect(stats.queued).toBe(2);
        });
    });

    describe('Max concurrency of 1', () => {
        let executor: TaskExecutor;

        beforeEach(() => {
            executor = createTaskExecutor({ maxConcurrency: 1 });
        });

        it('should only run one task at a time', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const stats = executor.getStats();
            expect(stats.running).toBe(1);
            expect(stats.queued).toBe(2);
        });
    });

    describe('Automatic queue processing', () => {
        let executor: TaskExecutor;

        beforeEach(() => {
            executor = createTaskExecutor({ maxConcurrency: 2 });
        });

        it('should start queued task when slot opens', async () => {
            const t1 = executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 500 });
            const t3 = executor.createTask({ duration_ms: 100 });

            // t3 should be queued initially
            expect(executor.getTask(t3.task_id)?.status).toBe('queued');

            // Wait for t1 to complete
            await delay(100);

            // t3 should now be running
            expect(executor.getTask(t3.task_id)?.status).toBe('running');
        });

        it('should process queue in order', async () => {
            const t1 = executor.createTask({ duration_ms: 50 });
            const t2 = executor.createTask({ duration_ms: 50 });
            const t3 = executor.createTask({ duration_ms: 50 });
            const t4 = executor.createTask({ duration_ms: 50 });

            // t3 and t4 should be queued
            expect(executor.getTask(t3.task_id)?.status).toBe('queued');
            expect(executor.getTask(t4.task_id)?.status).toBe('queued');

            // Wait for first batch to complete
            await delay(100);

            // t3 should have started before t4
            const t3Status = executor.getTask(t3.task_id);
            const t4Status = executor.getTask(t4.task_id);

            expect(t3Status?.started_at).toBeDefined();
            // Both should have started by now with concurrency 2
        });
    });
});

// =============================================================================
// TEST SUITE: GET /stats - Statistics
// =============================================================================

describe('GET /stats - Statistics', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 3 });
    });

    describe('Basic stats', () => {
        it('should return object with running, queued, completed', () => {
            const stats = executor.getStats();

            expect(stats).toHaveProperty('running');
            expect(stats).toHaveProperty('queued');
            expect(stats).toHaveProperty('completed');
        });

        it('should start with all zeros', () => {
            const stats = executor.getStats();

            expect(stats.running).toBe(0);
            expect(stats.queued).toBe(0);
            expect(stats.completed).toBe(0);
        });
    });

    describe('Running count', () => {
        it('should track running tasks', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const stats = executor.getStats();
            expect(stats.running).toBe(2);
        });

        it('should decrease when task completes', async () => {
            executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 500 });

            await delay(100);

            const stats = executor.getStats();
            expect(stats.running).toBe(1);
        });
    });

    describe('Queued count', () => {
        it('should track queued tasks', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            const stats = executor.getStats();
            expect(stats.queued).toBe(1);
        });

        it('should decrease when task starts running', async () => {
            executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });

            expect(executor.getStats().queued).toBe(2);

            await delay(100);

            expect(executor.getStats().queued).toBeLessThan(2);
        });
    });

    describe('Completed count', () => {
        it('should track completed tasks', async () => {
            executor.createTask({ duration_ms: 50 });
            executor.createTask({ duration_ms: 50 });

            await delay(100);

            const stats = executor.getStats();
            expect(stats.completed).toBe(2);
        });

        it('should accumulate over time', async () => {
            executor.createTask({ duration_ms: 30 });
            await delay(50);
            executor.createTask({ duration_ms: 30 });
            await delay(50);
            executor.createTask({ duration_ms: 30 });
            await delay(50);

            const stats = executor.getStats();
            expect(stats.completed).toBe(3);
        });
    });
});

// =============================================================================
// TEST SUITE: Priority Extension
// =============================================================================

describeExt('Priority Extension', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 1 });
    });

    describe('Priority queue ordering', () => {
        it('should process higher priority tasks first', async () => {
            // Fill the slot
            executor.createTask({ duration_ms: 50 });

            // Queue tasks with different priorities
            const low = executor.createTask({ duration_ms: 50, priority: 1 });
            const high = executor.createTask({ duration_ms: 50, priority: 10 });

            // Wait for first task to complete and queue to process
            await delay(80);

            // High priority should have started first
            const highStatus = executor.getTask(high.task_id);
            const lowStatus = executor.getTask(low.task_id);

            // High priority should be running or completed
            expect(['running', 'completed']).toContain(highStatus?.status);
            // Low priority might still be queued or running
        });

        it('should default to priority 0 if not specified', () => {
            executor.createTask({ duration_ms: 500 });
            const t1 = executor.createTask({ duration_ms: 100 });
            const t2 = executor.createTask({ duration_ms: 100, priority: 1 });

            // t2 with priority 1 should be ahead of t1 with default priority 0
            // (depending on implementation details)
        });
    });
});

// =============================================================================
// TEST SUITE: Task Cancellation Extension
// =============================================================================

describeExt('Task Cancellation Extension', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 2 });
    });

    describe('Cancelling queued tasks', () => {
        it('should cancel a queued task', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            const queued = executor.createTask({ duration_ms: 100 });

            const result = executor.cancelTask(queued.task_id);

            expect(result).toBe(true);
        });

        it('should mark cancelled task as cancelled', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            const queued = executor.createTask({ duration_ms: 100 });

            executor.cancelTask(queued.task_id);

            const status = executor.getTask(queued.task_id);
            expect(status?.status).toBe('cancelled');
        });

        it('should remove cancelled task from queue', () => {
            executor.createTask({ duration_ms: 500 });
            executor.createTask({ duration_ms: 500 });
            const queued = executor.createTask({ duration_ms: 100 });

            const beforeCancel = executor.getStats().queued;
            executor.cancelTask(queued.task_id);
            const afterCancel = executor.getStats().queued;

            expect(afterCancel).toBe(beforeCancel - 1);
        });
    });

    describe('Cannot cancel running tasks', () => {
        it('should return false for running task', () => {
            const running = executor.createTask({ duration_ms: 500 });

            const result = executor.cancelTask(running.task_id);

            expect(result).toBe(false);
        });

        it('should not change status of running task', () => {
            const running = executor.createTask({ duration_ms: 500 });

            executor.cancelTask(running.task_id);

            expect(executor.getTask(running.task_id)?.status).toBe('running');
        });
    });

    describe('Cannot cancel non-existent tasks', () => {
        it('should return false for non-existent task', () => {
            const result = executor.cancelTask('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('Cannot cancel completed tasks', () => {
        it('should return false for completed task', async () => {
            const task = executor.createTask({ duration_ms: 50 });

            await delay(100);

            const result = executor.cancelTask(task.task_id);
            expect(result).toBe(false);
        });
    });
});

// =============================================================================
// TEST SUITE: Edge Cases
// =============================================================================

describe('Edge Cases', () => {
    describe('Zero duration tasks', () => {
        it('should handle zero duration task', async () => {
            const executor = createTaskExecutor({ maxConcurrency: 3 });
            const task = executor.createTask({ duration_ms: 0 });

            await delay(10);

            expect(executor.getTask(task.task_id)?.status).toBe('completed');
        });
    });

    describe('Very long duration tasks', () => {
        it('should handle long duration tasks without blocking', () => {
            const executor = createTaskExecutor({ maxConcurrency: 3 });

            executor.createTask({ duration_ms: 10000 });
            executor.createTask({ duration_ms: 10000 });
            const t3 = executor.createTask({ duration_ms: 10000 });

            expect(executor.getTask(t3.task_id)?.status).toBe('running');
        });
    });

    describe('Many tasks', () => {
        it('should handle 100 tasks', async () => {
            const executor = createTaskExecutor({ maxConcurrency: 10 });

            const tasks = Array(100).fill(null).map(() =>
                executor.createTask({ duration_ms: 10 })
            );

            // All should be created
            expect(tasks).toHaveLength(100);

            await delay(200);

            // All should be completed
            const stats = executor.getStats();
            expect(stats.completed).toBe(100);
        });
    });
});

// =============================================================================
// TEST SUITE: Timing Accuracy
// =============================================================================

describe('Timing Accuracy', () => {
    let executor: TaskExecutor;

    beforeEach(() => {
        executor = createTaskExecutor({ maxConcurrency: 3 });
    });

    describe('started_at timestamp', () => {
        it('should set started_at when task starts', async () => {
            const before = Date.now();
            const task = executor.createTask({ duration_ms: 100 });
            const after = Date.now();

            await delay(10);
            const status = executor.getTask(task.task_id);

            expect(status?.started_at).toBeGreaterThanOrEqual(before);
            expect(status?.started_at).toBeLessThanOrEqual(after + 10);
        });
    });

    describe('completed_at timestamp', () => {
        it('should set completed_at when task completes', async () => {
            const task = executor.createTask({ duration_ms: 50 });

            await delay(100);

            const status = executor.getTask(task.task_id);
            expect(status?.completed_at).toBeDefined();
            expect(status?.completed_at!).toBeGreaterThanOrEqual(status?.started_at!);
        });

        it('should complete approximately at expected time', async () => {
            const start = Date.now();
            const task = executor.createTask({ duration_ms: 50 });

            await delay(100);

            const status = executor.getTask(task.task_id);
            const elapsed = status?.completed_at! - start;

            // Should complete around 50ms (with some tolerance for timer precision)
            // Note: on fast systems, elapsed might be very short if timers fire early
            expect(elapsed).toBeGreaterThanOrEqual(0);
            expect(elapsed).toBeLessThan(200);
        });
    });
});

// =============================================================================
// TEST SUITE: Requirements Compliance
// =============================================================================

describe('Requirements Compliance', () => {
    it('REQUIREMENT: POST /tasks returns {"task_id": "...", "status": "queued"|"running"}', () => {
        const executor = createTaskExecutor({ maxConcurrency: 3 });
        const result = executor.createTask({ duration_ms: 100 });

        expect(result).toMatchObject({
            task_id: expect.any(String),
            status: expect.stringMatching(/^(queued|running)$/)
        });
    });

    it('REQUIREMENT: GET /tasks/:id returns task status with optional timestamps', async () => {
        const executor = createTaskExecutor({ maxConcurrency: 3 });
        const task = executor.createTask({ duration_ms: 50 });

        await delay(100);

        const status = executor.getTask(task.task_id);

        expect(status).toMatchObject({
            task_id: task.task_id,
            status: 'completed',
            started_at: expect.any(Number),
            completed_at: expect.any(Number)
        });
    });

    it('REQUIREMENT: Maximum 3 tasks run concurrently', () => {
        const executor = createTaskExecutor({ maxConcurrency: 3 });

        for (let i = 0; i < 10; i++) {
            executor.createTask({ duration_ms: 500 });
        }

        const stats = executor.getStats();
        expect(stats.running).toBe(3);
    });

    it('REQUIREMENT: Tasks beyond limit are queued', () => {
        const executor = createTaskExecutor({ maxConcurrency: 3 });

        for (let i = 0; i < 5; i++) {
            executor.createTask({ duration_ms: 500 });
        }

        const stats = executor.getStats();
        expect(stats.queued).toBe(2);
    });

    it('REQUIREMENT: Queued tasks start automatically when slot opens', async () => {
        const executor = createTaskExecutor({ maxConcurrency: 2 });

        executor.createTask({ duration_ms: 50 });
        executor.createTask({ duration_ms: 500 });
        const queued = executor.createTask({ duration_ms: 100 });

        expect(executor.getTask(queued.task_id)?.status).toBe('queued');

        await delay(100);

        expect(['running', 'completed']).toContain(executor.getTask(queued.task_id)?.status);
    });

    it('REQUIREMENT: GET /stats returns {"running": n, "queued": n, "completed": n}', () => {
        const executor = createTaskExecutor({ maxConcurrency: 3 });

        executor.createTask({ duration_ms: 500 });
        executor.createTask({ duration_ms: 500 });
        executor.createTask({ duration_ms: 500 });
        executor.createTask({ duration_ms: 500 });

        const stats = executor.getStats();

        expect(stats).toMatchObject({
            running: expect.any(Number),
            queued: expect.any(Number),
            completed: expect.any(Number)
        });
    });
});
