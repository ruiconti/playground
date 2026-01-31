import React, { useEffect, useMemo, useRef, useState } from "react";

type SignupValues = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

type SignupErrors = Partial<Record<keyof SignupValues, string>>;

type UsernameCheck = (username: string) => Promise<boolean>;

type SignupFormProps = {
  checkUsernameAvailable: UsernameCheck;
  onSubmit: (values: SignupValues) => Promise<void> | void;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateSync(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {};
  if (!values.email.trim()) errors.email = "Email is required";
  else if (!isEmail(values.email)) errors.email = "Email is invalid";

  if (!values.username.trim()) errors.username = "Username is required";
  else if (values.username.length < 3) errors.username = "Min 3 characters";

  if (!values.password) errors.password = "Password is required";
  else if (values.password.length < 8) errors.password = "Min 8 characters";

  if (!values.confirmPassword) errors.confirmPassword = "Confirm your password";
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = "Passwords do not match";

  return errors;
}

type AsyncUsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export function SignupForm({
  checkUsernameAvailable,
  onSubmit,
}: SignupFormProps): React.ReactElement {
  const [values, setValues] = useState<SignupValues>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Record<keyof SignupValues, boolean>>({
    email: false,
    username: false,
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<AsyncUsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  const syncErrors = useMemo(() => validateSync(values), [values]);

  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const username = values.username.trim();

    if (!username) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      requestIdRef.current += 1;
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      return;
    }

    // Don't async-validate if sync-invalid (keeps UI calmer)
    if (syncErrors.username) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      requestIdRef.current += 1;
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);

    const reqId = (requestIdRef.current += 1);
    setUsernameStatus("checking");
    setUsernameMessage("Checking availability…");

    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const ok = await checkUsernameAvailable(username);
          if (requestIdRef.current !== reqId) return;

          if (ok) {
            setUsernameStatus("available");
            setUsernameMessage("Username is available");
          } else {
            setUsernameStatus("taken");
            setUsernameMessage("Username is taken");
          }
        } catch {
          if (requestIdRef.current !== reqId) return;
          setUsernameStatus("error");
          setUsernameMessage("Could not validate username");
        }
      })();
    }, 300);

    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [checkUsernameAvailable, syncErrors.username, values.username]);

  const showError = (key: keyof SignupValues) => touched[key] && syncErrors[key];
  const hasSyncErrors = Object.keys(syncErrors).length > 0;
  const isAsyncBlocking = usernameStatus === "checking" || usernameStatus === "taken";

  const canSubmit = !isSubmitting && !hasSyncErrors && !isAsyncBlocking;

  const onChangeField = (key: keyof SignupValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onBlurField = (key: keyof SignupValues) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      email: true,
      username: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(validateSync(values)).length > 0) return;
    if (usernameStatus === "checking" || usernameStatus === "taken") return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: "system-ui", maxWidth: 420 }}>
      <h3 style={{ margin: "0 0 12px" }}>Signup</h3>

      <label style={{ display: "block", marginBottom: 10 }}>
        <div>Email</div>
        <input
          value={values.email}
          onChange={(e) => onChangeField("email", e.target.value)}
          onBlur={() => onBlurField("email")}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
        />
        {showError("email") && <div style={{ color: "#c00", fontSize: 12 }}>{syncErrors.email}</div>}
      </label>

      <label style={{ display: "block", marginBottom: 10 }}>
        <div>Username</div>
        <input
          value={values.username}
          onChange={(e) => onChangeField("username", e.target.value)}
          onBlur={() => onBlurField("username")}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
        />
        {showError("username") && (
          <div style={{ color: "#c00", fontSize: 12 }}>{syncErrors.username}</div>
        )}
        {!syncErrors.username && values.username.trim() && (
          <div
            style={{
              fontSize: 12,
              color:
                usernameStatus === "available"
                  ? "#0a7a2f"
                  : usernameStatus === "taken" || usernameStatus === "error"
                    ? "#c00"
                    : "#555",
            }}
          >
            {usernameMessage}
          </div>
        )}
      </label>

      <label style={{ display: "block", marginBottom: 10 }}>
        <div>Password</div>
        <input
          type="password"
          value={values.password}
          onChange={(e) => onChangeField("password", e.target.value)}
          onBlur={() => onBlurField("password")}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
        />
        {showError("password") && (
          <div style={{ color: "#c00", fontSize: 12 }}>{syncErrors.password}</div>
        )}
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        <div>Confirm password</div>
        <input
          type="password"
          value={values.confirmPassword}
          onChange={(e) => onChangeField("confirmPassword", e.target.value)}
          onBlur={() => onBlurField("confirmPassword")}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
        />
        {showError("confirmPassword") && (
          <div style={{ color: "#c00", fontSize: 12 }}>{syncErrors.confirmPassword}</div>
        )}
      </label>

      <button type="submit" disabled={!canSubmit} style={{ padding: "8px 12px" }}>
        {isSubmitting ? "Submitting…" : "Create account"}
      </button>
    </form>
  );
}

export function SignupFormDemo(): React.ReactElement {
  const [submitted, setSubmitted] = useState<SignupValues | null>(null);

  const checkUsernameAvailable: UsernameCheck = async (username) => {
    // Fake API: disallow some usernames
    await new Promise((r) => setTimeout(r, 250));
    return !["admin", "root", "test", "cursor"].includes(username.toLowerCase());
  };

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "start" }}>
      <SignupForm
        checkUsernameAvailable={checkUsernameAvailable}
        onSubmit={(vals) => setSubmitted(vals)}
      />
      <div style={{ fontFamily: "system-ui", maxWidth: 360 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Submitted</div>
        <pre
          style={{
            margin: 0,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fafafa",
            whiteSpace: "pre-wrap",
          }}
        >
          {submitted ? JSON.stringify(submitted, null, 2) : "—"}
        </pre>
      </div>
    </div>
  );
}

