import { useEffect, useRef, useState } from "react";
import { useWebsocket } from "../hooks/useWebsocket";

export function Receiver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null); // <== Use a ref
  const socketRef = useRef<WebSocket | null>(null);

  const [receiverId, setReceiverId] = useState<null | string>(
    `receiver-${Math.floor(Math.random() * 100000)}`
  );

  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const socket = useWebsocket();
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
      socket.send(JSON.stringify({ type: "getRooms" }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "error") {
        setErr(message.message);
      }
      if (message.type === "availableRooms") {
        setAvailableRooms(message.rooms);
      }

      if (message.type === "createOffer") {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
          console.log("EVENT : ", event);
          console.log("event.candidate : ", event.candidate);
          console.log("roomId : ", roomId);
          if (event.candidate && roomId) {
            console.log("sending iceCandidate from receiver :");
            socket?.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: event.candidate,
                receiverId,
                roomId,
              })
            );
          }
        };

        pc.ontrack = (event) => {
          const stream = event.streams[0];
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setShowVideo(true); //
          }
        };

        await pc.setRemoteDescription(message.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: pc.localDescription,
            receiverId,
          })
        );
      } else if (message.type === "iceCandidate") {
        const pc = pcRef.current;
        if (pc) {
          pc.addIceCandidate(message.candidate);
        }
      }
      if (message.type === "senderDisconnected") {
        console.log("socket disconnected");
        setRoomId(null);
        setShowVideo(false);
      }
      if (message.type === "senderReconnected") {
        setShowVideo(true);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setReceiverId(null);
    };
  }, [receiverId, roomId]);

  const handleJoinRoom = (room: string) => {
    setRoomId(room);
    console.log("ROOM : ", room);

    socketRef?.current?.send(
      JSON.stringify({ type: "receiver", receiverId, roomId: room })
    );
  };

  return (
    <div>
      {receiverId ? (
        <p>Recevier Component (ID: {receiverId})</p>
      ) : (
        <p>Socket closed / not connected / max receivers limit exceeded</p>
      )}

      {roomId ? (
        <p>Joined room : {roomId}</p>
      ) : (
        <div>
          {err && <span>ERROR : {err}</span>}
          <h3 className="my-1 ">Select a room</h3>
          {availableRooms?.length === 0 && <p>No rooms available</p>}
          <ul className="flex justify-between gap-1 mx-auto max-w-max">
            {availableRooms?.map((room) => (
              <li key={room}>
                <button onClick={() => handleJoinRoom(room)}>
                  Join room : {room}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {videoRef && showVideo && (
        <div>
          <span>To exit room refresh page</span>
        </div>
      )}
      {roomId && !videoRef.current?.srcObject && (
        <div>
          <span>Sender not started sharing</span>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        style={{
          width: "600px",
          backgroundColor: "black",
          display: videoRef && showVideo ? "block" : "none",
        }}
      />
    </div>
  );
}

// ---------------------------
