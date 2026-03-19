import { useState } from "react";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

export function LoginPage() {
  const { login, register, error, loading, clearError } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      await register(email, password);
    } else {
      await login(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegister((v) => !v);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggle}
          className="text-sm text-myc-muted dark:text-myc-muted-dark hover:text-myc-teal dark:hover:text-myc-accent"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow-md dark:shadow-myc-teal-deep/20 w-full max-w-sm p-6 border border-transparent dark:border-myc-teal-deep/30">
        <h1 className="text-2xl font-bold text-myc-brown dark:text-myc-accent mb-6 text-center">
          Mycarium
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1 text-myc-text dark:text-myc-text-dark">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-myc-cream dark:border-myc-teal-deep/40 rounded px-3 py-2 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark focus:outline-none focus:ring-2 focus:ring-myc-teal dark:focus:ring-myc-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1 text-myc-text dark:text-myc-text-dark"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-myc-cream dark:border-myc-teal-deep/40 rounded px-3 py-2 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark focus:outline-none focus:ring-2 focus:ring-myc-teal dark:focus:ring-myc-accent"
            />
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-myc-teal dark:bg-myc-teal-deep text-white py-2 rounded font-medium hover:bg-myc-teal-mid dark:hover:bg-myc-teal disabled:opacity-50"
          >
            {loading ? "..." : isRegister ? "Register" : "Log In"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-myc-muted dark:text-myc-muted-dark">
          {isRegister ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            className="text-myc-teal dark:text-myc-accent font-medium hover:underline"
          >
            {isRegister ? "Log in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
