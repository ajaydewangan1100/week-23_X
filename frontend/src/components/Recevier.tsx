import { useEffect, useRef, useState } from "react";

export function Receiver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null); // <== Use a ref
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8082");
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "receiver" }));
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
              })
            );
          }
        };

        pc.ontrack = (event) => {
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

        socket.send(
          JSON.stringify({ type: "createAnswer", sdp: pc.localDescription })
        );
      } else if (message.type === "iceCandidate") {
        const pc = pcRef.current;
        if (pc) {
          pc.addIceCandidate(message.candidate);
        }
      }
    };
  }, []);

  return (
    <div>
      <p>RecevierComponent</p>

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
