import React, { useState, useRef, useCallback, useEffect } from "react";

type AutocompleteProps = {
  /** Async function that returns suggestions for a query string. */
  fetchSuggestions: (query: string) => Promise<string[]>;
  /** Called when the user selects a suggestion. */
  onSelect: (value: string) => void;
  /** Debounce delay in ms. Default: 300 */
  debounceMs?: number;
  /** Placeholder text for the input. */
  placeholder?: string;
};

type Status = "idle" | "loading" | "success" | "error";

export function Autocomplete({
  fetchSuggestions,
  onSelect,
  debounceMs = 300,
  placeholder,
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const doFetch = useCallback(
    async (query: string) => {
      const thisRequestId = ++requestIdRef.current;
      setStatus("loading");

      try {
        const results = await fetchSuggestions(query);

        // Guard against stale responses
        if (thisRequestId !== requestIdRef.current) return;

        setSuggestions(results);
        setStatus("success");
        setIsOpen(true);
        setHighlightIndex(-1);
      } catch {
        if (thisRequestId !== requestIdRef.current) return;
        setStatus("error");
        setSuggestions([]);
        setIsOpen(true);
      }
    },
    [fetchSuggestions]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim() === "") {
      // Clear immediately on empty input
      setSuggestions([]);
      setStatus("idle");
      setIsOpen(false);
      setHighlightIndex(-1);
      requestIdRef.current++; // Invalidate pending requests
      return;
    }

    // Debounce the fetch
    debounceTimerRef.current = setTimeout(() => {
      doFetch(value);
    }, debounceMs);
  };

  const selectSuggestion = (value: string) => {
    setInputValue(value);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightIndex(-1);
    onSelect(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => {
          if (suggestions.length === 0) return -1;
          return prev < suggestions.length - 1 ? prev + 1 : 0;
        });
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => {
          if (suggestions.length === 0) return -1;
          return prev > 0 ? prev - 1 : suggestions.length - 1;
        });
        break;

      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          selectSuggestion(suggestions[highlightIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on a suggestion
    if (listRef.current?.contains(e.relatedTarget as Node)) return;
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const highlightedId =
    highlightIndex >= 0 ? `suggestion-${highlightIndex}` : undefined;

  return (
    <div style={{ position: "relative", width: "300px" }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="suggestions-listbox"
        aria-haspopup="listbox"
        aria-activedescendant={highlightedId}
        aria-autocomplete="list"
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "16px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />

      {status === "loading" && (
        <div
          data-testid="loading"
          style={{ padding: "8px 12px", color: "#666" }}
        >
          Loading...
        </div>
      )}

      {status === "error" && isOpen && (
        <div
          data-testid="error"
          style={{ padding: "8px 12px", color: "#c00" }}
        >
          Error fetching results
        </div>
      )}

      {status === "success" && isOpen && suggestions.length === 0 && (
        <div
          data-testid="no-results"
          style={{ padding: "8px 12px", color: "#666" }}
        >
          No results
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          id="suggestions-listbox"
          ref={listRef}
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: "none",
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightIndex;
            return (
              <li
                key={`${index}-${suggestion}`}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click
                  selectSuggestion(suggestion);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: isHighlighted ? "#e6f3ff" : "#fff",
                }}
              >
                {suggestion}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
