import { useEffect, useRef, useState } from "react";
import { useWebsocket } from "../hooks/useWebsocket";

export function Sender() {
  const [socket, setSocket] = useState<null | WebSocket>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Maintaining a map of PeerConnections keyed by receiverId
  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Simulating a list of known receiverIds (TODO - fetch this dynamically, for the receivers who are online and connected to server)
  const [receiverIds, setReceiverIds] = useState<string[]>([]);
  // const receiverIds = ["receiver-1001", "receiver-1002", "receiver-1003"];

  useEffect(() => {
    const socket_ws = useWebsocket();
    setSocket(socket_ws);

    socket_ws.onopen = () => {
      socket_ws.send(JSON.stringify({ type: "sender" }));
      socket?.send(
        JSON.stringify({
          type: "getReceiverIds",
        })
      );
    };

    socket_ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "createAnswer") {
        const pc = pcMapRef.current.get(data.receiverId);
        if (pc) {
          await pc.setRemoteDescription(data.sdp);
        }
      } else if (data.type === "iceCandidate") {
        const pc = pcMapRef.current.get(data.receiverId);
        if (pc) {
          await pc.addIceCandidate(data.candidate);
        }
      } else if (data.type === "receiverIds") {
        setReceiverIds(data.receiverIds); // <- Update state
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
      })
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setShowVideo(true);
    }

    if (!receiverIds.length) {
      socket?.send(
        JSON.stringify({
          type: "getReceiverIds",
        })
      );
      console.log("no receivers");
      alert("No Receivers >> ");
      return;
    } else {
      for (const receiverId of receiverIds) {
        const pc = new RTCPeerConnection();

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.send(
              JSON.stringify({
                type: "iceCandidate",
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
              sdp: pc.localDescription,
              receiverId,
            })
          );
        };
        pcMapRef.current.set(receiverId, pc);
      }
    }
  }

  return (
    <div>
      <h2 className="font-semibold text-xl">Sender</h2>
      <div className="my-1">
        <button
          className={`${receiverIds?.length < 1 && "text-gray-600"}`}
          onClick={startSendingVideo}
          disabled={receiverIds?.length < 1 ? true : false}>
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
