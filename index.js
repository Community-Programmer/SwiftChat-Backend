const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv=require('dotenv');

const app = express();

dotenv.config()
app.use(cors()); 

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CROSS_ORIGIN_URL,
    methods: ['GET', 'POST']
  }
});

app.get('/',(req,res)=>{
  res.send('200 - OK - SwiftChat backend Running')
})


app.get('/api/room/users/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const users = roomUsers.get(roomId) || [];

  res.json({ users });
});


app.get('/api/rooms', (req, res) => {
  const rooms = Array.from(roomNames.values());
  res.json({ rooms });
});

const roomNames = new Map();
const roomUsers = new Map();

function handleCreateRoom(socket, data,ack) {
  const { username, roomName, roomId } = data;
  socket.join(roomId);
  roomNames.set(roomId, roomName);
  roomUsers.set(roomId, [{ username, socketId: socket.id }]);
  ack({ success: true });
}

function handleJoinRoom(socket, data) {
  const { username, roomId } = data;
  const roomExists = io.sockets.adapter.rooms.has(roomId);

  if (roomExists) {
    socket.join(roomId);
    const roomName = roomNames.get(roomId);
    const users = roomUsers.get(roomId) || [];
    users.push({ username, socketId: socket.id });
    roomUsers.set(roomId, users);
    io.to(roomId).emit('user-joined', { username, roomId, roomName, users });
    socket.emit('messages', { roomName, users });
  } else {
    socket.emit('message', `Room ${roomId} does not exist`);
  }
}

function handleSendMessage(socket, data) {
  const { roomId, username } = data;

  const room = io.sockets.adapter.rooms.get(roomId);
  if (room && room.has(socket.id)) {
    socket.to(roomId).emit('recieve', { message: data.message, timestamp: data.timestamp, username: data.username });
  } else {
    socket.emit('message', `User ${username} is no longer in room ${roomId}`);
  }
}

function handleExitRoom(socket, data) {
  const { roomId, username } = data;

  const roomExists = io.sockets.adapter.rooms.has(roomId);

  if (roomExists) {
    socket.leave(roomId);

    const roomName = roomNames.get(roomId);
    const users = roomUsers.get(roomId) || [];
    const updatedUsers = users.filter((user) => user.username !== username);
    roomUsers.set(roomId, updatedUsers);
    io.to(roomId).emit('user-exited', { username, roomId, roomName, users: updatedUsers });
    if (updatedUsers.length === 0) {
      roomNames.delete(roomId);
    }
  } else {
    socket.emit('message', `Room ${roomId} does not exist`);
  }
}

function handleDisconnect(socket) {
  
  roomUsers.forEach((users, room) => {
    const updatedUsers = users.filter((user) => user.socketId !== socket.id);
    roomUsers.set(room, updatedUsers);
    io.to(room).emit('user-disconnected', { socketId: socket.id, users: updatedUsers });
    if (updatedUsers.length === 0) {
      roomNames.delete(room);
    }
  });
}

io.on('connection', (socket) => {
  socket.on('create-room', (data, ack) => handleCreateRoom(socket, data, ack));
  socket.on('joinRoom', (data) => handleJoinRoom(socket, data));
  socket.on('send_message', (data) => handleSendMessage(socket, data));
  socket.on('exitRoom', (data) => handleExitRoom(socket, data));
  socket.on('disconnect', () => handleDisconnect(socket));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
