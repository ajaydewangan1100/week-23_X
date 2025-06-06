import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8082, host: "0.0.0.0" });

const rooms = new Map<string, Room>();

interface Room {
  sender: WebSocket;
  receivers: Map<string, WebSocket>;
}

// Broadcasting updated receivers to a room's sender
const sendUpdatedReceivers = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const receiverIds = Array.from(room.receivers.keys());
  room?.sender?.send(JSON.stringify({ type: "receiverIds", receiverIds }));
};

const returnSocket = (ws: WebSocket, message: string) => {
  console.log("server >> return socket ERROR : ", message);
  ws.send(
    JSON.stringify({
      type: "error",
      message,
    })
  );
};

const broadcastRooms = () => {
  const roomList = getAllRooms();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "availableRooms", rooms: roomList }));
    }
  });
};

const getAllRooms = () => {
  return Array.from(rooms.keys());
};

wss.on("connection", function connection(ws) {
  // on Websocket error
  ws.on("error", console.error);

  // on Websocket message
  ws.on("message", function message(data: any) {
    const message = JSON.parse(data);

    if (message.type === "sender") {
      const roomId = Math.random().toString(36).substring(2, 10);
      rooms.set(roomId, { sender: ws, receivers: new Map() });

      broadcastRooms();
      (ws as any).roomId = roomId;
      ws.send(JSON.stringify({ roomId, type: "roomCreated" }));
      // sendUpdatedReceivers();
    } else if (message.type === "getRooms") {
      ws.send(JSON.stringify({ type: "availableRooms", rooms: getAllRooms() }));
    } else if (message.type === "receiver") {
      const { receiverId, roomId } = message;

      if (!receiverId || !roomId) {
        returnSocket(ws, "receiverId and roomId is required");
        return;
      }

      const room = rooms.get(roomId);

      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }

      if (room?.receivers.size >= 5) {
        ws.send(JSON.stringify({ error: "Maximum receiver limit reached." }));
        ws.close(); // optionally disconnect the socket
        return;
      }

      room.receivers.set(receiverId, ws);
      (ws as any).roomId = roomId;
      (ws as any).receiverId = receiverId;

      // if new receiver connected send updated receivers list
      sendUpdatedReceivers(roomId);
    } else if (message.type === "createOffer") {
      const { roomId, receiverId, sdp } = message;
      if (!roomId || !receiverId || !sdp) {
        returnSocket(ws, "Required fields : roomId, receiverId, sdp");
        return;
      }

      const room = rooms.get(roomId);

      if (!room || ws !== room.sender) {
        returnSocket(
          ws,
          "Room not available / you must be a sender to create offer : "
        );
      }

      // sendUpdatedReceivers();
      const receiver = room?.receivers.get(receiverId);
      if (receiver) {
        receiver.send(
          JSON.stringify({ type: "createOffer", sdp: message.sdp })
        );
      } else {
        room?.sender.send(
          JSON.stringify({
            type: "error",
            message: `Receiver ${receiverId} not found.`,
          })
        );
      }
    } else if (message.type === "createAnswer") {
      const roomId = (ws as any).roomId;
      const receiverId = (ws as any).receiverId;

      const room = rooms.get(roomId);

      if (room && receiverId && room.sender) {
        room.sender.send(
          JSON.stringify({ type: "createAnswer", sdp: message.sdp, receiverId })
        );
      } else {
        returnSocket(ws, "Something went wrong, createAnswer not done");
      }
    } else if (message.type === "iceCandidate") {
      const { candidate, receiverId, roomId } = message;
      const room = rooms.get(roomId);

      if (!room) {
        returnSocket(ws, "Room not found");
        return;
      }

      if (ws === room.sender) {
        const receiver = room.receivers.get(receiverId);
        receiver?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate,
          })
        );
      } else {
        room.sender?.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate,
            receiverId,
          })
        );
      }
    } else if (message.type === "getReceiverIds") {
      const { roomId } = message;
      const room = rooms.get(roomId);

      if (!room || ws !== room?.sender) {
        returnSocket(
          ws,
          "Room not available / You must be a sender to get receivers"
        );
      }

      sendUpdatedReceivers(roomId);
    } else {
      returnSocket(ws, "Wrong type putted");
    }
  });

  // on Websocket close
  ws.on("close", () => {
    const roomId = (ws as any).roomId;
    const receiverId = (ws as any).receiverId;

    const room = rooms.get(roomId);

    if (!room) {
      returnSocket(ws, "Room not available");
    }

    if (ws === room?.sender) {
      for (const receiver of room.receivers.values()) {
        receiver.send(
          JSON.stringify({
            type: "senderDisconnected",
            message: "Sender has disconnected, Join other room.",
          })
        );
        receiver.close();
      }
      rooms.delete(roomId); // Deleting room on diconnect
      broadcastRooms();
    } else if (room?.receivers.get(receiverId)) {
      room.receivers.delete(receiverId);
      sendUpdatedReceivers(roomId);
    }
  });
});
