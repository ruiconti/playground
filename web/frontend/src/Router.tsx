// What if i wanted to build a simple router? 
// What is a router?
// - is a mapping of the path to a particular component
// - paths can be overlapping, and order of matching is crucial
//  e.g., in `/test/`, `/test/foo`, and we want to fulfill both of them, then `/test/foo` should take precedence over `/test`
//
// Using JSX to define the route hierarchy and structure may not be the best approach, because defining
// precedence order reliably (i.e., conditionals) with a language like JSX is tricky, as templates can be dynamically defined e.g., by using loops, conditionals, etc
//
// For simplicity, let's just define a simple object that maps the path to a particular component.
import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react";

const apis = ['pushState', 'replaceState'] as const
const patchKey = 'router_patched' as const;

const patchAPIs = () => {
  const existing = (globalThis as any)[patchKey]
  if (existing) return;

  for (const api of apis) {
    const original = window.history[api].bind(history)
    window.history[api] = (...args) => {
      const result = original(...args);
      dispatchEvent(new CustomEvent(api));
      return result;
    }
  }
}
patchAPIs();

function subscribe(callback: () => void) {
  for (const api of apis) {
    window.addEventListener(api, callback)
  }

  return () => {
    for (const api of apis) {
      window.removeEventListener(api, callback)
    }
  }
}

const resolveSnapshot = () => window.location.pathname;

const usePath = () => useSyncExternalStore(subscribe, resolveSnapshot, resolveSnapshot)

export type RoutesMap = Record<`/${string}`, React.ComponentType<any>>

const Route404 = (props: { path: string }) => {
  return (
    <div>Sorry, route {props.path} was not found!</div>
  )
}

export const Router = (props: { routes: RoutesMap }) => {
  const { routes } = props;
  const path = usePath();

  const CurrentComponent = useMemo(() => {
    // try longest match first
    const sorted = Object.entries(routes).sort(([pathA], [pathB]) => pathB.length > pathA.length ? 1 : -1);
    const match = sorted.find(([routeA]) => {
      if (path !== '/' && routeA === '/') return false

      return path.startsWith(routeA)
    })
    if (!match) return () => <Route404 path={path} />;
    console.log({ path, match })

    const [_, Component] = match;
    return Component;
  }, [path, routes])


  return <CurrentComponent />;
}
