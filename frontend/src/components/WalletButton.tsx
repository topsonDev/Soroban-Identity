import { useState } from "react";
import type { WalletState, WalletType } from "../hooks/useWallet";

interface Props {
  wallet: WalletState & {
    connect: (walletType?: WalletType) => void;
    disconnect: () => void;
  };
}

export default function WalletButton({ wallet }: Props) {
  const { publicKey, connected, connecting, walletType, error, connect, disconnect } = wallet;
  const [showPicker, setShowPicker] = useState(false);

  const short = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

  const handleSelect = (type: WalletType) => {
    setShowPicker(false);
    connect(type);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", position: "relative" }}>
      {connected && publicKey ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            via {walletType === "walletconnect" ? "WalletConnect" : "Freighter"}
          </span>
          <span className="badge badge-green">{short(publicKey)}</span>
          <button
            onClick={disconnect}
            style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "0.3rem 0.7rem" }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowPicker((v) => !v)}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>

          {showPicker && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 0.5rem)",
              right: 0,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              minWidth: "180px",
              zIndex: 10,
            }}>
              <button
                onClick={() => handleSelect("freighter")}
                style={{ justifyContent: "flex-start", gap: "0.5rem", display: "flex", alignItems: "center" }}
              >
                🪐 Freighter
              </button>
              <button
                onClick={() => handleSelect("walletconnect")}
                style={{ justifyContent: "flex-start", gap: "0.5rem", display: "flex", alignItems: "center" }}
              >
                🔗 WalletConnect
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <span style={{ fontSize: "0.75rem", color: "#fca5a5" }}>{error}</span>
      )}
    </div>
  );
}
