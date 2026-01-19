// In-memory data store
// C equivalent: static array with mutex for thread safety

export type User = {
  id: number
  name: string
  email: string
}

// Mutable store - in C this would be a static array
export const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]

let nextId = 3

export function getNextId(): number {
  return nextId++
}
