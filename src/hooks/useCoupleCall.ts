"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export type CallKind = "voice" | "video";
export type CallPhase = "idle" | "calling" | "incoming" | "connected";

type Signal = {
  kind?: string;
  callType?: CallKind;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useCoupleCall(socket: Socket | null) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callType, setCallType] = useState<CallKind>("voice");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const phaseRef = useRef<CallPhase>("idle");
  const typeRef = useRef<CallKind>("voice");
  const socketRef = useRef(socket);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  phaseRef.current = phase;
  typeRef.current = callType;
  socketRef.current = socket;

  const signal = (kind: string, data?: RTCSessionDescriptionInit | RTCIceCandidateInit, type?: CallKind) => {
    socketRef.current?.emit("call:signal", { kind, callType: type || typeRef.current, data });
  };

  const attachRemote = () => {
    const stream = remoteRef.current;
    if (!stream) return;
    const node = typeRef.current === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (!node) return;
    if (node.srcObject !== stream) node.srcObject = stream;
    void node.play().catch(() => undefined);
  };

  const attachLocal = () => {
    const stream = localRef.current;
    if (!stream || typeRef.current !== "video" || !localVideoRef.current) return;
    localVideoRef.current.srcObject = stream;
    void localVideoRef.current.play().catch(() => undefined);
  };

  const teardown = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    remoteRef.current = null;
    pendingIce.current = [];
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  const release = () => {
    teardown();
    pendingOffer.current = null;
    setMuted(false);
    setCameraOn(true);
    setSeconds(0);
    setPhase("idle");
  };

  const makePc = () => {
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (event) => {
      if (event.candidate) signal("ice", event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      remoteRef.current = event.streams[0] || new MediaStream([event.track]);
      attachRemote();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPhase("connected");
      if (pc.connectionState === "failed") setNotice("The call could not connect");
    };
    pcRef.current = pc;
    return pc;
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingIce.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // A late candidate can arrive after the call has moved on.
      }
    }
  };

  const grabMedia = async (type: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: type === "video" ? { facingMode: "user" } : false,
    });
    localRef.current = stream;
    attachLocal();
    return stream;
  };

  const start = async (type: CallKind) => {
    if (phaseRef.current !== "idle") return;
    setNotice("");
    setCallType(type);
    typeRef.current = type;
    setPhase("calling");
    try {
      const stream = await grabMedia(type);
      const pc = makePc();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal("offer", { type: offer.type, sdp: offer.sdp }, type);
    } catch {
      release();
      setNotice(type === "video" ? "Allow the camera and microphone, then try the video call again" : "Allow the microphone, then try the call again");
    }
  };

  const accept = async () => {
    const offer = pendingOffer.current;
    if (!offer || phaseRef.current !== "incoming") return;
    const type = typeRef.current;
    try {
      const stream = await grabMedia(type);
      const pc = makePc();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setPhase("connected");
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await pc.setRemoteDescription(offer);
      await flushIce();
      attachRemote();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signal("answer", { type: answer.type, sdp: answer.sdp }, type);
      pendingOffer.current = null;
    } catch {
      signal("reject");
      release();
      setNotice(type === "video" ? "Allow the camera and microphone to answer" : "Allow the microphone to answer");
    }
  };

  const decline = () => {
    signal("reject");
    release();
  };

  const hangup = () => {
    if (phaseRef.current !== "idle") signal("hangup");
    release();
  };

  const toggleMute = () => {
    setMuted((value) => {
      const next = !value;
      localRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  };

  const toggleCamera = () => {
    setCameraOn((value) => {
      const next = !value;
      localRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  };

  useEffect(() => {
    attachLocal();
    attachRemote();
  }, [phase, callType]);

  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!socket) return;

    const onSignal = async (payload: Signal) => {
      if (payload.kind === "offer" && payload.data && "type" in payload.data) {
        if (phaseRef.current !== "idle") {
          socket.emit("call:signal", { kind: "reject", callType: payload.callType });
          return;
        }
        const type: CallKind = payload.callType === "video" ? "video" : "voice";
        typeRef.current = type;
        setCallType(type);
        pendingOffer.current = payload.data;
        pendingIce.current = [];
        setPhase("incoming");
        setNotice("");
        return;
      }

      if (payload.kind === "answer" && payload.data && "type" in payload.data && pcRef.current) {
        await pcRef.current.setRemoteDescription(payload.data);
        await flushIce();
        attachRemote();
        setPhase("connected");
        return;
      }

      if (payload.kind === "ice" && payload.data) {
        if (!pcRef.current?.remoteDescription) {
          pendingIce.current.push(payload.data as RTCIceCandidateInit);
          return;
        }
        try {
          await pcRef.current.addIceCandidate(payload.data as RTCIceCandidateInit);
        } catch {
          // Ignore a candidate that arrives after the connection closes.
        }
        return;
      }

      if (payload.kind === "hangup" || payload.kind === "reject") {
        const wasCalling = phaseRef.current === "calling";
        release();
        if (payload.kind === "reject" && wasCalling) setNotice("Call declined");
      }
    };

    socket.on("call:signal", onSignal);
    return () => {
      socket.off("call:signal", onSignal);
    };
  }, [socket]);

  useEffect(() => () => teardown(), []);

  return {
    phase,
    callType,
    muted,
    cameraOn,
    seconds,
    notice,
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    start,
    accept,
    decline,
    hangup,
    toggleMute,
    toggleCamera,
  };
}
