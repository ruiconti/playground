import { RoutesMap, Router } from "./Router"
import { Home } from "./Home"
import { Calculator } from "./Calculator";
import { Autocomplete } from "../katas/01_autocomplete";
import { StreamingText, StreamingTextHandle } from "../katas/02_streaming_text";
import { Chat } from "../katas/03_websocket_chat";
import {
  useRef,
  useState } from "react";
import { Button } from "./components/ui/button";
import { DatePickerDemo } from "./DatePicker";

const About = () => <div>About</div>;
const Post = (post: string) => <div>Post {post}</div>;

// Demo wrapper for Autocomplete kata
const AutocompleteDemo = () => {
  const mockFetchSuggestions = async (query: string) => {
    await new Promise((r) => setTimeout(r, 200));
    const items = ["apple", "apricot", "banana", "blueberry", "cherry", "cranberry", "date", "fig", "grape"];
    return items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  };

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-xl font-bold mb-4">Autocomplete Kata</h1>
      <Autocomplete
        fetchSuggestions={mockFetchSuggestions}
        onSelect={(value) => console.log("Selected:", value)}
        placeholder="Search fruits..."
      />
    </div>
  );
};

const StreamingTextDemo = () => {
  const delayMs = 50;
  const paddingMs = 140;
  const [result, setResult] = useState<boolean>(false);
  const [inferredState, setInferredState] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');

  const mockCreateStream = () => {
    const text = "In the realm of software development, streaming text has become an essential pattern for creating responsive and engaging user interfaces. When dealing with large language models or any system that generates content progressively, the ability to stream text token by token provides immediate feedback to users, creating a more interactive experience. This approach is particularly valuable in applications like chatbots, code editors, and content generation tools where waiting for the entire response would create an unacceptable delay. The streaming pattern allows us to display partial results as they become available, giving users confidence that the system is working and allowing them to start reading or processing the output before the generation is complete. By implementing a ReadableStream, we can control the flow of data, handle backpressure, and provide a clean interface for consuming the streamed content. This demonstration showcases how to build a robust streaming text component that handles edge cases like cancellation, errors, and proper cleanup while maintaining a smooth user experience throughout the entire lifecycle of the stream."
    const chunks = text.split(' ');
    return new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk + ' ');
          const waitMs = (delayMs + (Math.random() * paddingMs)) * (Math.random() > 0.5 ? 1 : -1);
          await new Promise((r) => setTimeout(r, waitMs));
        }
        controller.close();
      }
    })
  }

  const handleStart = () => {
    setInferredState('streaming');
    startRef.current?.start();
  }
  const handleStop = () => {
    setInferredState('idle');
    startRef.current?.stop();
  }
  const handleDone = (result: { text: string; cancelled: boolean }) => {
    setInferredState('done');
    setResult(true);
  }
  const handleError = (error: Error) => {
    setInferredState('error');
    console.error(error);
  }

  const renderAction = () => {
    const StartButton = () => <Button onClick={handleStart} type="submit" variant="default" className="text-sm" size="sm">Start</Button>
    switch (inferredState) {
      case 'idle': {
        return <StartButton />;
      }
      case 'streaming': {
        return <Button onClick={handleStop} type="submit" variant="default" className="text-sm" size="sm">Stop</Button>
      }
      case 'done': {
        return (<div className="flex flex-row gap-4"><StartButton /><div className="text-sm">Result signal sent? <span className="font-bold font-mono">{result ? "Yes" : "No"}</span></div></div>);
      }
      case 'error': {
        return (<div className="flex flex-row gap-4"><StartButton /><div className="text-sm">Error</div></div>);
      }
    }

  }

  const startRef = useRef<StreamingTextHandle | null>(null);

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-xl font-bold mb-4">Streaming Text Demo</h1>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          {renderAction()}
        </div>
        <div className="p-4 text-sm font-mono">
          <StreamingText ref={startRef} createStream={mockCreateStream} onDone={handleDone} onStart={handleStart} onStop={handleStop} onError={handleError} />
        </div>
      </div>
    </div>
  )
}

const WebSocketChatDemo = () => {
  const [username] = useState(() => `guest-${Math.random().toString(36).slice(2, 6)}`);
  const [serverMsg, setServerMsg] = useState('Hello from server');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleServerBroadcast = async () => {
    addLog(`Triggering server broadcast: "${serverMsg}"`);
    const res = await fetch('/api/ws/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: serverMsg }),
    });
    const data = await res.json();
    addLog(`Server sent to ${data.sent} clients`);
  };

  const handleServerDisconnect = async () => {
    addLog(`Triggering server disconnect for: ${username}`);
    const res = await fetch(`/api/ws/disconnect/${username}`, { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      addLog(`Error: ${data.error}`);
    } else {
      addLog(`Server disconnected: ${data.disconnected}`);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">WebSocket Chat Kata</h1>
      <p className="text-sm text-gray-600 mb-4">Username: <code className="bg-gray-100 px-1">{username}</code></p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Test Controls */}
        <div className="border rounded p-4 space-y-3">
          <h2 className="font-semibold text-sm">Test Controls</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Server-initiated message</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverMsg}
                onChange={(e) => setServerMsg(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
              <Button onClick={handleServerBroadcast} size="sm" variant="outline">
                Broadcast
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Server-initiated disconnect</label>
            <Button onClick={handleServerDisconnect} size="sm" variant="destructive">
              Force Disconnect
            </Button>
          </div>
        </div>

        {/* Event Log */}
        <div className="border rounded p-4">
          <h2 className="font-semibold text-sm mb-2">Event Log</h2>
          <div className="h-32 overflow-y-auto text-xs font-mono bg-gray-50 p-2 rounded">
            {log.length === 0 ? (
              <span className="text-gray-400">No events yet</span>
            ) : (
              log.map((entry, i) => <div key={i}>{entry}</div>)
            )}
          </div>
        </div>
      </div>

      {/* Chat Component */}
      <div className="border rounded p-4">
        <h2 className="font-semibold text-sm mb-2">Chat Component (your implementation)</h2>
        <Chat url={`ws://localhost:3000/ws/chat?username=${username}`} username={username} />
      </div>
    </div>
  );
};

const $routes = {
  "/": Home,
  "/about": About,
  "/post/:id": Post,
  "/aboutism": About,
  "/calculator": Calculator,
  "/katas/autocomplete": AutocompleteDemo,
  "/katas/streaming-text": StreamingTextDemo,
  "/katas/ws-chat": WebSocketChatDemo,
  '/katas/date-picker': DatePickerDemo,
} satisfies RoutesMap;

export default function App() {
  return <Router routes={$routes} />
}

