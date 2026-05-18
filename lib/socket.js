// lib/socket.js
import { io } from "socket.io-client";

let socket;

export const getSocket = (userId) => {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      autoConnect: true,
    });
  }

  if (userId) {
    // Join immediately if already connected, or wait for connection
    if (socket.connected) {
      socket.emit("join", userId);
    } else {
      socket.once("connect", () => {
        socket.emit("join", userId);
      });
    }
  }

  return socket;
};