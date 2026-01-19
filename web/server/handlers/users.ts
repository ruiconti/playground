import type { Handler } from '../router'
import { users, getNextId, type User } from '../store'

// JSON response helper - in C you'd use a JSON library or manual serialization
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/users - list all users
export const listUsers: Handler = () => {
  return json(users)
}

// POST /api/users - create user
export const createUser: Handler = async (req) => {
  let body: { name?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  if (!body.name || !body.email) {
    return json({ error: 'name and email required' }, 400)
  }

  const user: User = {
    id: getNextId(),
    name: body.name,
    email: body.email,
  }
  users.push(user)

  return json(user, 201)
}

// GET /api/users/:id - get single user
export const getUser: Handler = (_req, params) => {
  const id = parseInt(params.id, 10)
  const user = users.find((u) => u.id === id)

  if (!user) {
    return json({ error: 'not found' }, 404)
  }

  return json(user)
}

// DELETE /api/users/:id - delete user
export const deleteUser: Handler = (_req, params) => {
  const id = parseInt(params.id, 10)
  const index = users.findIndex((u) => u.id === id)

  if (index === -1) {
    return json({ error: 'not found' }, 404)
  }

  const deleted = users.splice(index, 1)[0]
  return json(deleted)
}
