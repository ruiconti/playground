import React from "react";

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

export function Autocomplete(props: AutocompleteProps): React.ReactElement {
  throw new Error("TODO");
}
