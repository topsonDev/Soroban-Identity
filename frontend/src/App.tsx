import { useState } from "react";
import IdentityPanel from "./components/IdentityPanel";
import CredentialsPanel from "./components/CredentialsPanel";
import WalletButton from "./components/WalletButton";
import { useWallet } from "./hooks/useWallet";

type Tab = "identity" | "credentials";

export default function App() {
  const [tab, setTab] = useState<Tab>("identity");
  const wallet = useWallet();

  return (
    <div className="container">
      <header style={{ position: "relative" }}>
        <h1>Soroban Identity</h1>
        <p>Decentralized Identity for a Trustless World</p>
        <div style={{ position: "absolute", top: "1rem", right: 0 }}>
          <WalletButton />
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
