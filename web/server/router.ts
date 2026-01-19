// Simple router - designed to map directly to C implementation
//
// C equivalent:
// typedef struct {
//   const char* method;
//   const char* pattern;
//   response_t (*handler)(request_t*, params_t*);
// } route_t;

export type Params = Record<string, string>

export type Handler = (req: Request, params: Params) => Response | Promise<Response>

export type Route = {
  method: string
  pattern: string
  handler: Handler
}

export type RouteMatch = {
  handler: Handler
  params: Params
}

// Parse pattern like "/api/users/:id" into segments
// Returns null if path doesn't match, otherwise returns extracted params
function matchPattern(pattern: string, path: string): Params | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) {
    return null
  }

  const params: Params = {}

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]

    if (patternPart.startsWith(':')) {
      // Dynamic segment - extract param
      const paramName = patternPart.slice(1)
      params[paramName] = pathPart
    } else if (patternPart !== pathPart) {
      // Static segment mismatch
      return null
    }
  }

  return params
}

// Find matching route - O(n) linear scan, same as C implementation
export function match(routes: Route[], method: string, path: string): RouteMatch | null {
  for (const route of routes) {
    if (route.method !== method) {
      continue
    }

    const params = matchPattern(route.pattern, path)
    if (params !== null) {
      return { handler: route.handler, params }
    }
  }

  return null
}

// Create router with routes array
export function createRouter(routes: Route[]) {
  return {
    routes,
    match: (method: string, path: string) => match(routes, method, path),
  }
}
