const express = require('express')
const { ExpressPeerServer } = require('peer')
const cors = require('cors')
const http = require('http')
const socketio = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const { userJoin, getRoomUsers, getUser, userLeave } = require('./utils/users');

app.use(cors())

app.get('/', (req, res, next) => res.send('Hello world!'))

const peerServer = ExpressPeerServer(server, {
    debug: true
})

app.use('/signaling', peerServer)

io.on('connection', socket => {
    socket.on('join-room', ({ id, username, room }) => {
        const user = userJoin(id, username, room)
        socket.join(user.room)
        // Broadcast when  a user connects
        socket.broadcast.to(user.room).emit('room-users-joined', { userId: user.id, username: username })

        // Send users and Room info
        io.to(user.room).emit('room-users', {
            room: user.room,
            users: getRoomUsers(user.room)
        })

        // Runs when client disconnects
        socket.on('disconnect', () => {
            const user = userLeave(id)

            if (user) {
                io.to(user.room).emit('room-users-left', { userId: user.username })

                // Send users and room info
                io.to(user.room).emit('room-users', {
                    room: user.room,
                    users: getRoomUsers(user.room)
                })
            }
        })

        // Listen to WebcamOn
        socket.on('webcam-on', () => {
            user.cam = true
            io.to(user.room).emit('add-webcam-icon', user.id)
        })

        // Listen to webcamOff
        socket.on('webcam-off', () => {
            user.cam = false
            io.to(user.room).emit('remove-webcam-icon-stream-called', user.id)
        })

        socket.on('room-chat-message-post', ({ username, message }) => {
            console.log('recived a new message in chat')
            io.to(user.room).emit('room-chat-message-post', { username, message })
        })

        socket.on('room-chat-message-history',()=>{
            console.log('sending message history')
            io.to(user.id).emit('room-chat-message-all',{messages:[]})
        })
    })
})

server.listen(9000, () => console.log(`Server running on http://127.0.0.1:${9000}`))
io.listen(server)