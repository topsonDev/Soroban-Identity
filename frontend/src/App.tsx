import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import IdentityPanel from "./components/IdentityPanel";
import CredentialsPanel from "./components/CredentialsPanel";
import WalletButton from "./components/WalletButton";
import { useWallet } from "./hooks/useWallet";
import { useCredentialExpiryCheck } from "./hooks/useCredentialExpiryCheck";
import type { Credential } from "../../sdk/src/types";

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
  const { t, i18n } = useTranslation();

  // Mock fetch — replace with CredentialClient.getCredentialsBySubject() when wired
  const fetchCredentials = useCallback(async (_address: string): Promise<Credential[]> => {
    await new Promise((r) => setTimeout(r, 200));
    const now = Math.floor(Date.now() / 1000);
    return [
      { id: "abc003", credentialType: "Reputation", subject: _address, issuer: "GISSUER", claims: {}, signature: "", issuedAt: now - 100, expiresAt: now + 3 * 24 * 60 * 60, revoked: false },
    ];
  }, []);

  const { notification, dismiss } = useCredentialExpiryCheck(wallet.publicKey, fetchCredentials);

  const toggleLang = () => {
    const next = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };

  return (
    <div className="container">
      <header style={{ position: "relative" }}>
        <h1>{t("app.title")}</h1>
        <p>{t("app.subtitle")}</p>
        <div style={{ position: "absolute", top: "1rem", right: 0, display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button className="theme-toggle" onClick={toggleLang} aria-label="Switch language">
            {i18n.language === "en" ? "ES" : "EN"}
          </button>
          <button
            className="theme-toggle"
            onClick={toggleDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? t("app.lightMode") : t("app.darkMode")}
          </button>
          <WalletButton wallet={wallet} />
        </div>
      </header>

      {notification && !notification.dismissed && (
        <div
          role="alert"
          style={{
            background: "var(--warning-bg, #fff3cd)",
            color: "var(--warning-text, #856404)",
            border: "1px solid var(--warning-border, #ffc107)",
            borderRadius: "0.5rem",
            padding: "0.6rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.9rem",
          }}
        >
          <span>
            ⚠ {notification.count} credential{notification.count > 1 ? "s" : ""} expiring within 7 days
          </span>
          <button
            onClick={dismiss}
            aria-label="Dismiss notification"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === "identity" ? "active" : ""}`}
          onClick={() => setTab("identity")}
        >
          {t("tabs.identity")}
        </button>
        <button
          className={`tab ${tab === "credentials" ? "active" : ""}`}
          onClick={() => setTab("credentials")}
        >
          {t("tabs.credentials")}
        </button>
      </div>

      {tab === "identity" && <IdentityPanel wallet={wallet} />}
      {tab === "credentials" && <CredentialsPanel wallet={wallet} />}
    </div>
  );
}
