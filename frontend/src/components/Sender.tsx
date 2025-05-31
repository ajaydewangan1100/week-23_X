import { useEffect, useRef, useState } from "react";

export function Sender() {
  const [socket, setSocket] = useState<null | WebSocket>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8082");
    setSocket(socket);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "sender" }));
    };
  }, []);

  async function startSendingVideo() {
    if (!socket) {
      alert("Socket not found");
      return;
    }
    const pc = new RTCPeerConnection();

    // create offer
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer(); // sdp
      await pc.setLocalDescription(offer);
      socket?.send(
        JSON.stringify({ type: "createOffer", sdp: pc.localDescription })
      );
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "createAnswer") {
        await pc.setRemoteDescription(data.sdp);
      } else if (data.type === "iceCandidate") {
        await pc.addIceCandidate(data.candidate);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.send(
          JSON.stringify({ type: "iceCandidate", candidate: event.candidate })
        );
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    // const video = document.createElement("video");
    // video.srcObject = stream;
    // video.play();
    // document.body.appendChild(video);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream); // ✅ MUST include the stream
      setShowVideo(true);
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }

  return (
    <div>
      <p>Sender</p>
      <div>
        <button onClick={startSendingVideo}>Send video</button>
      </div>
      <br />
      <div>
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
    </div>
  );
}
