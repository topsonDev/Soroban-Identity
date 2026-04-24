import { useState, useEffect } from "react";
import IdentityPanel from "./components/IdentityPanel";
import CredentialsPanel from "./components/CredentialsPanel";
import WalletButton from "./components/WalletButton";
import { useWallet } from "./hooks/useWallet";

type Tab = "identity" | "credentials";

function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", isDark);
    html.classList.toggle("light", !isDark);
    localStorage.setItem("dark-mode", String(isDark));
  }, [isDark]);

  return [isDark, () => setIsDark((d) => !d)];
}

export default function App() {
  const [tab, setTab] = useState<Tab>("identity");
  const wallet = useWallet();
  const [isDark, toggleDark] = useDarkMode();

  return (
    <div className="container">
      <header style={{ position: "relative" }}>
        <h1>Soroban Identity</h1>
        <p>Decentralized Identity for a Trustless World</p>
        <div style={{ position: "absolute", top: "1rem", right: 0, display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="theme-toggle"
            onClick={toggleDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? "☀ Light" : "☾ Dark"}
          </button>
          <WalletButton wallet={wallet} />
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${tab === "identity" ? "active" : ""}`}
          onClick={() => setTab("identity")}
        >
          Identity (DID)
        </button>
        <button
          className={`tab ${tab === "credentials" ? "active" : ""}`}
          onClick={() => setTab("credentials")}
        >
          Credentials
        </button>
      </div>

      {tab === "identity" && <IdentityPanel wallet={wallet} />}
      {tab === "credentials" && <CredentialsPanel wallet={wallet} />}
    </div>
  );
}
