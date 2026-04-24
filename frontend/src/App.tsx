import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t, i18n } = useTranslation();

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
