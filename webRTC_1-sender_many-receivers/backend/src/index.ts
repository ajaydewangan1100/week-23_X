import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8082, host: "0.0.0.0" });

let senderSocket: null | WebSocket = null;
const receiverMap = new Map<string, WebSocket>(); // Map to track multiple receivers with ID

const sendUpdatedReceivers = () => {
  const receiverIds = Array.from(receiverMap.keys());
  senderSocket?.send(JSON.stringify({ type: "receiverIds", receiverIds }));
};

wss.on("connection", function connection(ws) {
  // on Websocket error
  ws.on("error", console.error);

  // on Websocket message
  ws.on("message", function message(data: any) {
    const message = JSON.parse(data);

    if (message.type === "sender") {
      senderSocket = ws;
      sendUpdatedReceivers();

      for (const receiver of receiverMap.values()) {
        receiver.send(
          JSON.stringify({
            type: "senderReconnected",
            message: "Sender has reconnected. Please renegotiate.",
          })
        );
      }
    } else if (message.type === "receiver") {
      if (receiverMap.size >= 5) {
        ws.send(JSON.stringify({ error: "Maximum receiver limit reached." }));
        ws.close(); // optionally disconnect the socket
        return;
      }
      const receiverId = message.receiverId;
      if (!receiverId) {
        ws.send(JSON.stringify({ error: "receiverId is required" }));
        return;
      }

      receiverMap.set(receiverId, ws);
      const socketWithId = ws as WebSocket & { receiverId?: string };
      socketWithId.receiverId = receiverId; // attach ID for cleanup

      // if new receiver connected send updated receivers list
      sendUpdatedReceivers();
    } else if (message.type === "createOffer") {
      if (ws !== senderSocket) {
        return;
      }
      sendUpdatedReceivers();
      const receiver = receiverMap.get(message.receiverId);
      if (receiver) {
        receiver.send(
          JSON.stringify({ type: "createOffer", sdp: message.sdp })
        );
      } else {
        senderSocket.send(
          JSON.stringify({ error: `Receiver ${message.receiverId} not found.` })
        );
      }
    } else if (message.type === "createAnswer") {
      const socketWithId = ws as WebSocket & { receiverId?: string };
      if (socketWithId.receiverId && senderSocket) {
        senderSocket?.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: message.sdp,
            receiverId: socketWithId.receiverId,
          })
        );
      }
    } else if (message.type === "iceCandidate") {
      const socketWithId = ws as WebSocket & { receiverId?: string };
      if (ws === senderSocket) {
        const receiver = receiverMap.get(message.receiverId);
        receiver?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: message.candidate,
          })
        );
      } else if (socketWithId.receiverId && senderSocket) {
        senderSocket?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: message.candidate,
            receiverId: socketWithId.receiverId,
          })
        );
      }
    } else if (message.type === "getReceiverIds") {
      if (ws !== senderSocket) return;
      const receiverIds = Array.from(receiverMap.keys());
      ws.send(JSON.stringify({ type: "receiverIds", receiverIds }));
    }
  });

  // on Websocket close
  ws.on("close", () => {
    if (ws === senderSocket) {
      senderSocket = null;
      for (const receiver of receiverMap.values()) {
        receiver.send(
          JSON.stringify({
            type: "senderDisconnected",
            message: "Sender has disconnected.",
          })
        );
      }
    } else {
      const socketWithId = ws as WebSocket & { receiverId?: string };
      if (socketWithId.receiverId) {
        receiverMap.delete(socketWithId.receiverId);
      }
      sendUpdatedReceivers();
    }
  });
});
