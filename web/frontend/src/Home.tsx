import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'

export function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 sm:items-start">
        <img
          className="dark:invert"
          src="/bun.svg"
          alt="Bun logo"
          width={100}
          height={100}
        />
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl">Pure Bun Server</CardTitle>
            <CardDescription className="text-lg">
              No Next.js. Just Bun serving a React frontend and a simple API.
              The server design maps directly to C.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <Button asChild>
              <a href="https://bun.sh/docs" target="_blank" rel="noopener noreferrer">
                Bun Docs
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/users" target="_blank">
                API Demo
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
