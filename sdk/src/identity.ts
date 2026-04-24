import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Keypair,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { CallOptions, DidDocument, SorobanIdentityConfig } from "./types";
import { retryWithBackoff } from "./utils";

export class IdentityClient {
  private server: SorobanRpc.Server;
  private contract: Contract;
  private config: SorobanIdentityConfig;

  constructor(config: SorobanIdentityConfig) {
    this.config = config;
    this.server = new SorobanRpc.Server(config.rpcUrl);
    this.contract = new Contract(config.identityRegistryId);
  }

  /**
   * Create a new DID for the given keypair.
   */
  async createDid(
    keypair: Keypair,
    metadata: Record<string, string> = {},
    options?: CallOptions
  ): Promise<string> {
    const account = await this.server.getAccount(keypair.publicKey());

    const metaScVal = nativeToScVal(metadata, { type: "map" });
    const timeout = options?.timeoutSeconds ?? this.config.txTimeout ?? 30;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          "create_did",
          nativeToScVal(keypair.publicKey(), { type: "address" }),
          metaScVal
        )
      )
      .setTimeout(timeout)
      .build();

    const prepared = await retryWithBackoff(() => this.server.prepareTransaction(tx));
    prepared.sign(keypair);

    const result = await retryWithBackoff(() => this.server.sendTransaction(prepared));
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${result.status}`);
    }

    let confirmed: SorobanRpc.Api.GetSuccessfulTransactionResponse;
    try {
      confirmed = await this.waitForConfirmation(result.hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("DID already exists")) {
        throw new Error(
          `A DID already exists for address ${keypair.publicKey()}. Each address can only have one DID.`
        );
      }
      throw e;
    }
    return scValToNative(confirmed.returnValue!) as string;
  }

  /**
   * Update metadata on an existing DID.
   */
  async updateDid(
    keypair: Keypair,
    metadata: Record<string, string>,
    options?: CallOptions
  ): Promise<void> {
    const account = await this.server.getAccount(keypair.publicKey());
    const timeout = options?.timeoutSeconds ?? this.config.txTimeout ?? 30;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          "update_did",
          nativeToScVal(keypair.publicKey(), { type: "address" }),
          nativeToScVal(metadata, { type: "map" })
        )
      )
      .setTimeout(timeout)
      .build();

    const prepared = await retryWithBackoff(() => this.server.prepareTransaction(tx));
    prepared.sign(keypair);

    const result = await retryWithBackoff(() => this.server.sendTransaction(prepared));
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${result.status}`);
    }

    try {
      await this.waitForConfirmation(result.hash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("DID not found")) {
        throw new Error(
          `No DID found for address ${keypair.publicKey()}. Create one first with createDid.`
        );
      }
      if (msg.includes("require_auth") || msg.includes("not authorized")) {
        throw new Error(
          `Address ${keypair.publicKey()} is not the controller of this DID.`
        );
      }
      throw e;
    }
  }

  /**
   * Resolve a DID document by controller address.
   */
  async resolveDid(controllerAddress: string, options?: CallOptions): Promise<DidDocument> {
    const account = await this.server.getAccount(controllerAddress);
    const timeout = options?.timeoutSeconds ?? this.config.txTimeout ?? 30;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          "resolve_did",
          nativeToScVal(controllerAddress, { type: "address" })
        )
      )
      .setTimeout(timeout)
      .build();

    const result = await retryWithBackoff(() => this.server.simulateTransaction(tx));
    if (SorobanRpc.Api.isSimulationError(result)) {
      const errMsg = result.error ?? "";
      if (errMsg.includes("DidDeactivated")) {
        throw new Error(`DID for address ${controllerAddress} has been deactivated.`);
      }
      if (errMsg.includes("DidNotFound")) {
        throw new Error(`No DID found for address ${controllerAddress}.`);
      }
      throw new Error(`Simulation failed: ${errMsg}`);
    }

    return scValToNative(
      (result as SorobanRpc.Api.SimulateTransactionSuccessResponse)
        .result!.retval
    ) as DidDocument;
  }

  /**
   * Check if an address has an active DID.
   */
  async hasActiveDid(controllerAddress: string, options?: CallOptions): Promise<boolean> {
    const account = await this.server.getAccount(controllerAddress);
    const timeout = options?.timeoutSeconds ?? this.config.txTimeout ?? 30;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          "has_active_did",
          nativeToScVal(controllerAddress, { type: "address" })
        )
      )
      .setTimeout(timeout)
      .build();

    const result = await retryWithBackoff(() => this.server.simulateTransaction(tx));
    if (SorobanRpc.Api.isSimulationError(result)) return false;

    return scValToNative(
      (result as SorobanRpc.Api.SimulateTransactionSuccessResponse)
        .result!.retval
    ) as boolean;
  }

  /**
   * Deactivate the DID associated with the given keypair.
   * Throws if the DID is not found or is already inactive.
   */
  async deactivateDid(keypair: Keypair): Promise<void> {
    const isActive = await this.hasActiveDid(keypair.publicKey());
    if (!isActive) {
      throw new Error(
        `DID for ${keypair.publicKey()} is already inactive or does not exist`
      );
    }

    const account = await this.server.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          "deactivate_did",
          nativeToScVal(keypair.publicKey(), { type: "address" })
        )
      )
      .setTimeout(this.config.txTimeout ?? 30)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(keypair);

    const result = await this.server.sendTransaction(prepared);
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${result.status}`);
    }

    await this.waitForConfirmation(result.hash);
  }

  private async waitForConfirmation(
    hash: string,
    retries = 10
  ): Promise<SorobanRpc.Api.GetSuccessfulTransactionResponse> {
    for (let i = 0; i < retries; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await this.server.getTransaction(hash);
      if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return status as SorobanRpc.Api.GetSuccessfulTransactionResponse;
      }
      if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error("Transaction failed on-chain");
      }
    }
    throw new Error("Transaction confirmation timeout");
  }
}
