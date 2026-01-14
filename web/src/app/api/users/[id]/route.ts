import { NextResponse } from 'next/server'

// Shared store - in a real app you'd use a database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const user = users.find((u) => u.id === Number(id))

  if (!user) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const index = users.findIndex((u) => u.id === Number(id))

  if (index === -1) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const deleted = users.splice(index, 1)[0]
  return NextResponse.json(deleted)
}
