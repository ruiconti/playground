# Kata 12: Form With Validation (Sync + Async) — Approach

## What Interviewers Evaluate

- Can you model field state + errors clearly?
- Do you handle async validation without race conditions?
- Do you debounce async checks (don’t validate every keystroke)?
- Do you avoid validating stale values?

---

## iPad Sketch

```
Fields:
  email            (sync validation)
  username         (sync + async availability)
  password         (sync)
  confirmPassword  (sync, depends on password)

Username async state machine:

  [idle]
    | type valid username
    v
  [checking] -- ok --> [available]
      |         \-- taken --> [taken]
      \-- error ---------> [error]

Submit gating:
  disabled if:
    - any sync error
    - usernameStatus is checking/taken
    - isSubmitting
```

Debounce + stale request guard:
```
typing:     a  ad  adm  admi  admin
debounce:   |------300ms------| (only fires after pause)
reqId:      1   2    3    4     5
responses:          (3 returns late)  (ignore if reqId != latest)
```

---

## First 2 Minutes: Break It Down (Before Coding)

Split into sync validation, async validation, and submit gating:

```
onChange -> update values
onBlur   -> set touched
validateSync(values) -> errors
username change -> debounce -> async check (stale-guarded)
submit -> block if errors/checking/taken
```

Concrete chunks:
1. **State**: `values`, `touched`, `isSubmitting`, `usernameStatus/message`.
2. **Sync validate**: pure `validateSync(values)` returning an error map.
3. **Async validate**: debounce + `requestIdRef` stale guard.
4. **Derived booleans**: `hasErrors`, `isAsyncBlocking`, `canSubmit`.
5. **UI**: show errors only after touched; show username availability status.

---

## Field State Shape

For each field:
- `value`
- `touched` (or `dirty`)
- `error` (string | null)

Global:
- `isSubmitting`
- `asyncStatus` for username: `idle | checking | available | taken | error`

---

## Async Validation Pattern

- On username change:
  - if empty → clear async state
  - debounce 300ms
  - increment `requestIdRef`
  - await `checkUsernameAvailable(value)`
  - if `requestId` doesn’t match → ignore (stale)

---

## Edge Cases

- User types quickly (stale requests)
- Network errors
- Submit disabled while async validation is pending

---

## Worked Example: Fast Typing (stale response)

Timeline:
1. User types `adm` → requestId=10 → request starts
2. User types `admin` quickly → requestId=11 → newer request starts
3. `adm` request returns last (slow network)

Correct behavior:
- ignore the `adm` response because `requestId !== latest`
- show status based on the `admin` response only
