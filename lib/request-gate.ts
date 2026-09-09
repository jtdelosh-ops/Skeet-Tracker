// Invalidates completions even when a transport cannot abort an in-flight response.
export function createRequestGate() {
  let version = 0;
  let controller: AbortController | null = null;
  const cancel = () => { version++; controller?.abort(); };
  return {
    cancel,
    start() {
      cancel();
      controller = new AbortController();
      const current = version;
      return { signal: controller.signal, isCurrent: () => current === version };
    },
  };
}
