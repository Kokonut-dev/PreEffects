// Zero-allocation RGBA TypedArray pool & byte-budgeted LRU RAM Preview Frame Cache

export class BufferPool {
  private buckets = new Map<number, Uint8ClampedArray[]>();
  private maxPerBucket = 24;
  private hotSize = -1;
  private hotList: Uint8ClampedArray[] | undefined;

  acquire(byteLength: number, zeroFill = true): Uint8ClampedArray {
    let list = byteLength === this.hotSize ? this.hotList : this.buckets.get(byteLength);
    if (byteLength !== this.hotSize && list) {
      this.hotSize = byteLength;
      this.hotList = list;
    }
    if (list && list.length > 0) {
      const buf = list.pop()!;
      if (zeroFill) buf.fill(0);
      return buf;
    }
    return new Uint8ClampedArray(byteLength);
  }

  release(buf: Uint8ClampedArray): void {
    const len = buf.byteLength;
    let list = len === this.hotSize ? this.hotList : this.buckets.get(len);
    if (!list) {
      list = [];
      this.buckets.set(len, list);
    }
    this.hotSize = len;
    this.hotList = list;
    if (list.length < this.maxPerBucket) {
      list.push(buf);
    }
  }

  clear(): void {
    this.buckets.clear();
    this.hotSize = -1;
    this.hotList = undefined;
  }
}

export const globalBufferPool = new BufferPool();

export interface CachedFrame {
  key: string;
  compId: string;
  frameIndex: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  renderTimeMs: number;
}

export class LruFrameCache {
  private entries = new Map<string, CachedFrame>();
  private usedBytes = 0;
  private maxBytes: number;
  private lastMruKey = '';
  public hits = 0;
  public misses = 0;

  constructor(maxMegabytes = 512) {
    this.maxBytes = maxMegabytes * 1024 * 1024;
  }

  setMaxMegabytes(mb: number): void {
    this.maxBytes = Math.max(16, mb) * 1024 * 1024;
    this.evictIfNeeded();
  }

  getUsedBytes(): number {
    return this.usedBytes;
  }

  getMaxBytes(): number {
    return this.maxBytes;
  }

  getEntryCount(): number {
    return this.entries.size;
  }

  get(key: string): CachedFrame | undefined {
    const found = this.entries.get(key);
    if (!found) {
      this.misses++;
      return undefined;
    }
    // Promote to MRU only when not already at the MRU tail
    if (this.lastMruKey !== key) {
      this.entries.delete(key);
      this.entries.set(key, found);
      this.lastMruKey = key;
    }
    this.hits++;
    return found;
  }

  set(frame: CachedFrame): void {
    const existing = this.entries.get(frame.key);
    if (existing) {
      this.usedBytes -= existing.pixels.byteLength;
      this.entries.delete(frame.key);
    }
    const copy = new Uint8ClampedArray(frame.pixels);
    const stored: CachedFrame = { ...frame, pixels: copy };
    this.entries.set(frame.key, stored);
    this.lastMruKey = frame.key;
    this.usedBytes += copy.byteLength;
    this.evictIfNeeded();
  }

  getCachedFramesForComp(compId: string): number[] {
    const out: number[] = [];
    for (const v of this.entries.values()) {
      if (v.compId === compId) out.push(v.frameIndex);
    }
    return out;
  }

  invalidateComp(compId: string): void {
    for (const [k, v] of this.entries) {
      if (v.compId === compId) {
        this.usedBytes -= v.pixels.byteLength;
        this.entries.delete(k);
        if (this.lastMruKey === k) this.lastMruKey = '';
      }
    }
  }

  purgeAll(): void {
    this.entries.clear();
    this.usedBytes = 0;
    this.lastMruKey = '';
  }

  private evictIfNeeded(): void {
    while (this.usedBytes > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const item = this.entries.get(oldestKey)!;
      this.usedBytes -= item.pixels.byteLength;
      this.entries.delete(oldestKey);
    }
  }
}

export function fnv1aHash(str: string): string {
  let h = 0x811c9dc5;
  const n = str.length;
  let i = 0;
  for (; i + 3 < n; i += 4) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ str.charCodeAt(i + 1), 0x01000193);
    h = Math.imul(h ^ str.charCodeAt(i + 2), 0x01000193);
    h = Math.imul(h ^ str.charCodeAt(i + 3), 0x01000193);
  }
  for (; i < n; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
