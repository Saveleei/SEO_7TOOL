export const DEFAULT_METRIKA_RETRY_DELAYS = [100, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000];

/**
 * Keeps goals in memory until the Metrika bootstrap function is available.
 * One-time goals are persisted only after they have been handed to `ym`.
 *
 * @param {{
 *   deliver: (event: string, params: Record<string, unknown>) => boolean,
 *   schedule: (callback: () => void, delay: number) => unknown,
 *   readOnce: (key: string) => boolean,
 *   writeOnce: (key: string) => void,
 *   retryDelays?: number[],
 *   maxQueueSize?: number,
 * }} options
 */
export function createMetrikaDispatcher(options) {
  const retryDelays = options.retryDelays ?? DEFAULT_METRIKA_RETRY_DELAYS;
  const maxQueueSize = options.maxQueueSize ?? 100;
  const queue = [];
  const pendingOnceKeys = new Set();
  const completedOnceKeys = new Set();
  let timerScheduled = false;
  let retryIndex = 0;

  function wasSentOnce(key) {
    return completedOnceKeys.has(key) || options.readOnce(key);
  }

  function markSentOnce(key) {
    completedOnceKeys.add(key);
    pendingOnceKeys.delete(key);
    options.writeOnce(key);
  }

  function attempt(item) {
    if (item.onceKey && wasSentOnce(item.onceKey)) {
      pendingOnceKeys.delete(item.onceKey);
      return true;
    }
    if (!options.deliver(item.event, item.params)) return false;
    if (item.onceKey) markSentOnce(item.onceKey);
    return true;
  }

  function scheduleNext() {
    if (timerScheduled || queue.length === 0) return;
    if (retryIndex >= retryDelays.length) {
      retryIndex = 0;
      return;
    }
    const delay = retryDelays[retryIndex++];
    timerScheduled = true;
    options.schedule(() => {
      timerScheduled = false;
      flush();
    }, delay);
  }

  function enqueue(item) {
    if (queue.length >= maxQueueSize) {
      const removed = queue.shift();
      if (removed?.onceKey) pendingOnceKeys.delete(removed.onceKey);
    }
    queue.push(item);
    if (item.onceKey) pendingOnceKeys.add(item.onceKey);
    scheduleNext();
  }

  function flush() {
    if (queue.length === 0) return;
    const pending = queue.splice(0, queue.length);
    for (const item of pending) {
      if (!attempt(item)) queue.push(item);
    }
    if (queue.length === 0) retryIndex = 0;
    else scheduleNext();
  }

  function send(event, params) {
    const item = { event, params };
    if (attempt(item)) return true;
    enqueue(item);
    return false;
  }

  function sendOnce(onceKey, event, params) {
    if (wasSentOnce(onceKey) || pendingOnceKeys.has(onceKey)) return false;
    const item = { onceKey, event, params };
    if (attempt(item)) return true;
    enqueue(item);
    return false;
  }

  return { send, sendOnce, flush };
}
