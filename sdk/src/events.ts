import { SorobanRpc, Contract, xdr, scValToNative } from '@stellar/stellar-sdk';

export interface EventFilter {
  topic?: string[] | string[][];
  contractId?: string;
}

export interface ContractEvent {
  type: string;
  contractId: string;
  topic: string[];
  value: Record<string, unknown>;
  ledger: number;
  txHash: string;
}

export interface GetEventsOptions {
  rpcUrl: string;
  contractId: string;
  /** Ledger to start scanning from. Omit to start from the oldest available. */
  startLedger?: number;
  /** Maximum number of events to return. Defaults to 100. */
  limit?: number;
  filter?: EventFilter;
}

/**
 * One-shot fetch of historical contract events via the Soroban RPC getEvents
 * endpoint. For real-time updates use SorobanEventListener instead.
 *
 * Event indexing strategy:
 *   - For lightweight queries: call this utility with a known startLedger.
 *   - For production indexing: consider the Mercury indexer for Soroban
 *     (https://mercurydata.app) or run a custom listener that checkpoints
 *     the last processed ledger and pages forward on each invocation.
 */
export async function getEvents(options: GetEventsOptions): Promise<ContractEvent[]> {
  const { rpcUrl, contractId, startLedger, limit = 100, filter } = options;
  const server = new SorobanRpc.Server(rpcUrl);

  const topicsFilter = buildTopicsFilter(filter);

  const response = await server.getEvents({
    startLedger: startLedger ?? undefined,
    filters: [{ type: 'contract', contractIds: [contractId], topics: topicsFilter }],
    limit,
  });

  if (!response.events?.length) return [];

  return response.events
    .map(parseRawEvent)
    .filter((e): e is ContractEvent => e !== null);
}

function buildTopicsFilter(filter?: EventFilter): string[][] | undefined {
  const topic = filter?.topic;
  if (!topic) return undefined;
  return Array.isArray(topic[0]) ? (topic as string[][]) : [topic as string[]];
}

function parseRawEvent(event: SorobanRpc.Api.EventResponse): ContractEvent | null {
  try {
    if (event.type !== 'contract') return null;

    const contractId =
      typeof event.contractId === 'string'
        ? event.contractId
        : (event.contractId as Contract).contractId();

    const topic = Array.isArray(event.topic)
      ? (event.topic as xdr.ScVal[]).map((t) => JSON.stringify(scValToNative(t)))
      : [];

    const value =
      event.value instanceof xdr.ScVal
        ? (scValToNative(event.value) as Record<string, unknown>)
        : {};

    return { type: event.type, contractId, topic, value, ledger: event.ledger, txHash: event.txHash };
  } catch {
    return null;
  }
}

export interface TypedEventFilter {
  /** Contract address to filter by. */
  contractId: string;
  /** Event name (first topic symbol) to match. */
  eventName: string;
  /** Optional additional topic filters. */
  topics?: string[][];
}

export interface EventsClientOptions {
  rpcUrl: string;
  /** Initial ledger to scan from. Defaults to earliest available. */
  startLedger?: number;
  /** Max events per page. Defaults to 100. */
  pageSize?: number;
  /** Base backoff delay in milliseconds. Defaults to 1000. */
  baseBackoffMs?: number;
  /** Maximum backoff delay in milliseconds. Defaults to 30000. */
  maxBackoffMs?: number;
}

/**
 * Typed event client that wraps `getEvents` with:
 * - Filter by contract ID and event name (first topic symbol)
 * - Automatic cursor tracking across calls
 * - Exponential backoff on RPC failures
 * - Async iterator interface for consuming events in order
 *
 * @example
 * ```ts
 * const client = new EventsClient({ rpcUrl: 'https://soroban-testnet.stellar.org' });
 * const filter: TypedEventFilter = { contractId: '...', eventName: 'payment' };
 *
 * for await (const event of client.subscribe(filter)) {
 *   console.log(event.contractId, event.value);
 * }
 * ```
 */
export class EventsClient {
  private server: SorobanRpc.Server;
  private options: Required<Omit<EventsClientOptions, 'startLedger'>> & { startLedger?: number };
  private cursor: number | undefined;

  constructor(options: EventsClientOptions) {
    this.server = new SorobanRpc.Server(options.rpcUrl);
    this.options = {
      rpcUrl: options.rpcUrl,
      startLedger: options.startLedger,
      pageSize: options.pageSize ?? 100,
      baseBackoffMs: options.baseBackoffMs ?? 1000,
      maxBackoffMs: options.maxBackoffMs ?? 30_000,
    };
    this.cursor = options.startLedger;
  }

  /**
   * Fetch the next page of events matching `filter`.
   *
   * Advances the internal cursor so subsequent calls page forward without
   * re-reading already-seen events.
   *
   * @param filter Contract and event-name filter.
   * @returns Array of matching contract events, possibly empty.
   */
  async fetchNext(filter: TypedEventFilter): Promise<ContractEvent[]> {
    const topics = buildTopicsFilterForName(filter.eventName, filter.topics);
    const response = await this.withBackoff(() =>
      this.server.getEvents({
        startLedger: this.cursor,
        filters: [
          { type: 'contract', contractIds: [filter.contractId], topics },
        ],
        limit: this.options.pageSize,
      })
    );

    const events = (response.events ?? [])
      .map(parseRawEvent)
      .filter((e): e is ContractEvent => e !== null);

    if (events.length > 0) {
      this.cursor = Math.max(...events.map((e) => e.ledger)) + 1;
    }

    return events;
  }

  /**
   * Async iterator that continuously polls for new events.
   *
   * Yields each event individually. Pauses between polls when there are no
   * new events (using exponential backoff on repeated empty responses).
   *
   * @param filter Contract and event-name filter.
   * @param pollIntervalMs Milliseconds to wait between polls when idle.
   */
  async *subscribe(
    filter: TypedEventFilter,
    pollIntervalMs = 5000
  ): AsyncGenerator<ContractEvent> {
    let idleMs = pollIntervalMs;
    while (true) {
      const events = await this.fetchNext(filter).catch(() => [] as ContractEvent[]);
      if (events.length > 0) {
        idleMs = pollIntervalMs;
        for (const event of events) {
          yield event;
        }
      } else {
        await sleep(idleMs);
        idleMs = Math.min(idleMs * 1.5, this.options.maxBackoffMs);
      }
    }
  }

  /** Reset the cursor to re-scan from `ledger` (or the beginning if omitted). */
  resetCursor(ledger?: number): void {
    this.cursor = ledger;
  }

  private async withBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let delay = this.options.baseBackoffMs;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= 4) throw err;
        await sleep(delay);
        delay = Math.min(delay * 2, this.options.maxBackoffMs);
      }
    }
  }
}

function buildTopicsFilterForName(
  eventName: string,
  extra?: string[][]
): string[][] {
  const nameTopic = [eventName];
  return extra ? [nameTopic, ...extra] : [nameTopic];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SorobanEventListener {
  private server: SorobanRpc.Server;
  private contractId: string;
  private filter?: EventFilter;
  private isRunning = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private lastLedger = 0;

  constructor(rpcUrl: string, contractId: string, filter?: EventFilter) {
    this.server = new SorobanRpc.Server(rpcUrl);
    this.contractId = contractId;
    this.filter = filter;
  }

  /**
   * Start polling for events at the specified interval.
   * @param callback Function called with matching events
   * @param intervalMs Polling interval in milliseconds (default: 5000)
   */
  start(callback: (events: ContractEvent[]) => void, intervalMs = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      try {
        const events = await this.server.getEvents({
          startLedger: this.lastLedger || undefined,
          filters: [
            {
              type: 'contract',
              contractIds: [this.contractId],
              topics: this.getTopicsFilter(),
            },
          ],
          limit: 100,
        });

        if (events.events && events.events.length > 0) {
          const contractEvents = events.events
            .map((e) => this.parseEvent(e))
            .filter((e) => e !== null) as ContractEvent[];

          if (contractEvents.length > 0) {
            callback(contractEvents);
            this.lastLedger =
              Math.max(...contractEvents.map((e) => e.ledger)) + 1;
          }
        }
      } catch (error) {
        console.error('Error polling events:', error);
      }
    };

    poll();
    this.intervalId = setInterval(poll, intervalMs);
  }

  /**
   * Stop polling for events.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
  }

  private parseEvent(event: SorobanRpc.Api.EventResponse): ContractEvent | null {
    return parseRawEvent(event);
  }

  private getTopicsFilter(): string[][] | undefined {
    return buildTopicsFilter(this.filter);
  }
}
