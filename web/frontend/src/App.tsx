import { RoutesMap, Router } from "./Router"
import { Home } from "./Home"
import { Calculator } from "./Calculator";

const About = () => <div>About</div>;
const Post = (post: string) => <div>Post {post}</div>;

const $routes = {
  "/": Home,
  "/about": About,
  "/post/:id": Post,
  "/aboutism": About,
  "/calculator": Calculator,
} satisfies RoutesMap;

export default function App() {
  return <Router routes={$routes} />
}

