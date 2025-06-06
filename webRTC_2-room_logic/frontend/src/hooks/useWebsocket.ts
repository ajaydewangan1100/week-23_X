export function useWebsocket() {
  return new WebSocket(`ws://localhost:8082`);
}
