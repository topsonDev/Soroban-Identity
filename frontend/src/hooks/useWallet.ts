import { useState, useCallback } from "react";

// Freighter injects window.freighter — types are minimal here
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<string>;
      getNetwork: () => Promise<{ network: string; networkPassphrase: string }>;
    };
  }
}

export interface WalletState {
  publicKey: string | null;
  networkPassphrase: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    networkPassphrase: null,
    connected: false,
    connecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    if (!window.freighter) {
      setState((s) => ({
        ...s,
        error: "Freighter wallet not found. Install it from freighter.app",
      }));
      return;
    }

    setState((s) => ({ ...s, connecting: true, error: null }));

    try {
      const isConnected = await window.freighter.isConnected();
      if (!isConnected) {
        setState((s) => ({
          ...s,
          connecting: false,
          error: "Please unlock Freighter and try again.",
        }));
        return;
      }

      const [publicKey, { networkPassphrase }] = await Promise.all([
        window.freighter.getPublicKey(),
        window.freighter.getNetwork(),
      ]);

      setState({
        publicKey,
        networkPassphrase,
        connected: true,
        connecting: false,
        error: null,
      });
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: e instanceof Error ? e.message : "Connection failed",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      publicKey: null,
      networkPassphrase: null,
      connected: false,
      connecting: false,
      error: null,
    });
  }, []);

  /**
   * Sign a transaction XDR string via Freighter and return the signed XDR.
   */
  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!window.freighter || !state.networkPassphrase) {
        throw new Error("Wallet not connected");
      }
      return window.freighter.signTransaction(xdr, {
        networkPassphrase: state.networkPassphrase,
      });
    },
    [state.networkPassphrase]
  );

  return { ...state, connect, disconnect, signTransaction };
}
