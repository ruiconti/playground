export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <img
          className="dark:invert"
          src="/bun.svg"
          alt="Bun logo"
          width={100}
          height={100}
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Pure Bun Server
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            No Next.js. Just Bun serving a React frontend and a simple API.
            The server design maps directly to C.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-white px-5 transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 md:w-[158px]"
            href="https://bun.sh/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bun Docs
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.1] md:w-[158px]"
            href="/api/users"
            target="_blank"
          >
            API Demo
          </a>
        </div>
      </main>
    </div>
  )
}
