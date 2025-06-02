import { useEffect, useRef, useState } from "react";
import { useWebsocket } from "../hooks/useWebsocket";

export function Receiver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null); // <== Use a ref
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [receiverId, setReceiverId] = useState<null | string>(
    `receiver-${Math.floor(Math.random() * 100000)}`
  );

  // Generate a unique receiverId once per component mount
  // let receiverId: null | string = useRef(`receiver-${Math.floor(Math.random() * 100000)}`).current;

  useEffect(() => {
    const socket = useWebsocket();
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "receiver", receiverId }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: event.candidate,
                receiverId,
              })
            );
          }
        };

        pc.ontrack = (event) => {
          // console.log("Getting TRACK : ", event.track);
          // Bad way to use stream
          // if (videoRef.current) {
          //   videoRef.current.srcObject = new MediaStream([event.track]);
          //   videoRef.current.play();
          // }

          // Good way to use stream
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
        // console.log("LOCAL DESCRIPTION set : ", pc.localDescription);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: pc.localDescription,
            receiverId,
          })
        );
      } else if (message.type === "iceCandidate") {
        const pc = pcRef.current;
        // console.log("ADDED ICE Candidate : ", message.candidate);
        if (pc) {
          pc.addIceCandidate(message.candidate);
        }
      } else if (message.type === "senderDisconnected") {
        console.log("socket disconnected");
        setShowVideo(false);
      } else if (message.type === "senderReconnected") {
        setShowVideo(true);
      }
    };

    socket.onclose = () => {
      setReceiverId(null);
    };
  }, [receiverId]);

  return (
    <div>
      {receiverId ? (
        <p>Recevier Component (ID: {receiverId})</p>
      ) : (
        <p>Socket not connected / closed / max receivers limit exceeded</p>
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
          display: showVideo ? "block" : "none",
        }}
      />
    </div>
  );
}

// ---------------------------
