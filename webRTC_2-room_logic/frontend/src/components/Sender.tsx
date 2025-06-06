import { useEffect, useRef, useState } from "react";
import { useWebsocket } from "../hooks/useWebsocket";

export function Sender() {
  const [socket, setSocket] = useState<null | WebSocket>(null);
  const [receiverIds, setReceiverIds] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [showVideo, setShowVideo] = useState(false);

  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [createdRoom, setCreatedRoom] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Establish socket connection
  useEffect(() => {
    const socket_ws = useWebsocket();
    setSocket(socket_ws);

    socket_ws.onopen = () => {
      !createdRoom && socket_ws.send(JSON.stringify({ type: "sender" }));
      socket_ws.send(JSON.stringify({ type: "getRooms" }));

      setErr("");
    };

    socket_ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "receiverIds":
          setReceiverIds(message.receiverIds);
          setErr("");
          break;

        case "createAnswer":
          const answerPc = pcMapRef.current.get(message.receiverId);
          if (answerPc) await answerPc.setRemoteDescription(message.sdp);
          break;

        case "iceCandidate":
          const icePc = pcMapRef.current.get(message.receiverId);
          if (icePc) await icePc.addIceCandidate(message.candidate);
          setErr("");
          break;

        case "availableRooms":
          setAvailableRooms(message.rooms);
          setErr("");
          break;

        case "roomCreated":
          setCreatedRoom(message.roomId);
          break;

        case "error":
          setErr(message.message);
          break;

        default:
          console.warn("Unhandled message:", message);
      }
    };
    setSocket(socket_ws);
  }, []);

  // Start sending videos ----------------------
  async function startSendingVideo() {
    if (!socket) {
      alert("Web-Socket not ready");
      return;
    }

    socket?.send(
      JSON.stringify({
        type: "getReceiverIds",
        roomId: createdRoom,
      })
    );

    if (!receiverIds.length) {
      socket?.send(
        JSON.stringify({
          type: "getReceiverIds",
        })
      );
      console.log("no receivers");
      alert("No Receivers >> ");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setShowVideo(true);
      setErr("");
    }

    for (const receiverId of receiverIds) {
      const pc = new RTCPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send(
            JSON.stringify({
              type: "iceCandidate",
              roomId: createdRoom,
              candidate: event.candidate,
              receiverId,
            })
          );
        }
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        // console.log("Track added >>>> ", track, stream);
      });

      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer(); //sdp
        await pc.setLocalDescription(offer);

        socket.send(
          JSON.stringify({
            type: "createOffer",
            roomId: createdRoom,
            sdp: pc.localDescription,
            receiverId,
          })
        );
      };
      pcMapRef.current.set(receiverId, pc);
    }
  }

  return (
    <div>
      <h2 className="font-semibold text-xl">Sender Dashboard</h2>
      {err && <p className="text-red-500 text-xs">Error : {err}</p>}
      <p className="my-1">
        My Created Room :{" "}
        <span className="border rounded-sm font-semibold p-1 border-emerald-700">
          {createdRoom}
        </span>
      </p>
      <div>
        <span>All Rooms id : </span>
        {availableRooms?.length === 0 && <p>No rooms available</p>}
        <ul className="flex gap-2 justify-between mx-auto max-w-max">
          {availableRooms?.map((room) => (
            <li className="border rounded-sm px-2 border-amber-400 " key={room}>
              {room}
            </li>
          ))}
        </ul>
      </div>
      <div className="my-1">
        <button
          className={`${receiverIds?.length < 1 && "text-gray-600"}`}
          onClick={startSendingVideo}
          disabled={!receiverIds?.length}>
          {receiverIds?.length
            ? `Send video to ${
                receiverIds?.length ? receiverIds?.length : 0
              } receiver`
            : "No receivers"}
        </button>
      </div>
      <div className="flex gap-1 flex-wrap justify-center my-2 mx-10">
        {receiverIds.map((id) => (
          <p className="font-sm border p-1 text-red-300 rounded-sm " key={id}>
            {id}
          </p>
        ))}
      </div>

      <div>
        <video
          className="mx-auto"
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls
          style={{
            width: "600px",
            backgroundColor: "black",
            display: showVideo && receiverIds?.length > 0 ? "block" : "none",
          }}
        />
      </div>
    </div>
  );
}
