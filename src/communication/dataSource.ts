/**
 * DATA SOURCE ABSTRACTION — §14.1 of the master spec.
 *
 * "The UI must not know where data originates."
 *
 * Every source — simulation, WebSocket gateway, OPC-UA, historian replay —
 * implements this one interface and emits the same normalised TagFrame. Swapping
 * the source is a one-line change in the provider; no component is aware that
 * anything changed.
 */

import type { OperatingMode } from '../types/machine'
import type { TagFrame } from '../types/tags'

export interface DataFrameEnvelope {
  /** Source-stamped time the frame describes. */
  timestamp: number
  tags: TagFrame
}

export type DataCallback = (frame: DataFrameEnvelope) => void
export type Unsubscribe = () => void

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'

export interface ConnectionInfo {
  status: ConnectionStatus
  /** Human-readable name shown in the connection banner. */
  sourceName: string
  /** Populated when status is ERROR. */
  error?: string
  /** Nominal publish rate of this source, Hz. */
  nominalRateHz: number
}

export type ConnectionListener = (info: ConnectionInfo) => void

export interface DataSource {
  readonly id: string
  readonly name: string
  /** Which operating mode this source puts the twin into. */
  readonly mode: OperatingMode

  connect(): Promise<void>
  disconnect(): Promise<void>
  /**
   * Subscribe to a set of tags. Passing an empty array means "all tags this
   * source publishes" — the simulation and historian sources publish whole
   * frames, while OPC-UA subscribes per item.
   */
  subscribe(tags: string[], callback: DataCallback): Unsubscribe
  onConnectionChange(listener: ConnectionListener): Unsubscribe
  getConnectionInfo(): ConnectionInfo
}

/**
 * Shared connection-listener plumbing. Every concrete source extends this so
 * connection reporting behaves identically regardless of transport.
 */
export abstract class BaseDataSource implements DataSource {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly mode: OperatingMode

  protected dataListeners = new Set<DataCallback>()
  private connectionListeners = new Set<ConnectionListener>()
  protected info: ConnectionInfo

  constructor(nominalRateHz: number, sourceName: string) {
    this.info = { status: 'DISCONNECTED', sourceName, nominalRateHz }
  }

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>

  subscribe(_tags: string[], callback: DataCallback): Unsubscribe {
    this.dataListeners.add(callback)
    return () => this.dataListeners.delete(callback)
  }

  onConnectionChange(listener: ConnectionListener): Unsubscribe {
    this.connectionListeners.add(listener)
    listener(this.info)
    return () => this.connectionListeners.delete(listener)
  }

  getConnectionInfo(): ConnectionInfo {
    return this.info
  }

  protected emit(frame: DataFrameEnvelope): void {
    for (const listener of this.dataListeners) listener(frame)
  }

  protected setConnection(patch: Partial<ConnectionInfo>): void {
    this.info = { ...this.info, ...patch }
    for (const listener of this.connectionListeners) listener(this.info)
  }
}
