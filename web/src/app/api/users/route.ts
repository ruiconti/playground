import { NextResponse } from 'next/server'

type User = { id: number; name: string; email: string }

// In-memory store (resets on server restart)
const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]

export async function GET() {
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.name || !body.email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  }

  const user: User = {
    id: users.length + 1,
    name: body.name,
    email: body.email,
  }
  users.push(user)

  return NextResponse.json(user, { status: 201 })
}
