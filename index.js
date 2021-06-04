const express = require('express')
const socketio = require('socket.io')
const http = require('http')

const cors = require('cors')
const bodyParser = require('body-parser')
const stripe = require('stripe')('sk_test_51Isp9eLjpdOyivM3byTsDhyQJl1nYGLr6nnsxhqX3iZlOMOJ4k4bfEcszqSXlS7YDtjTexrE5dmcRXdFfJILGm0u00yR1JyFp8');


const app = express()
const server = http.createServer(app)

//const { Socket } = require('socket.io')
var PORT = process.env.PORT || 3001

const io = require('socket.io')(server, {
    cors: {
        origin: 'http://localhost:3000/', //http://localhost:3000
        method: ["GET", "POST"],
    },
})


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(cors())


//stripe subscription part
app.post('/pay', async (req, res) => {
    const {email} = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
        amount: 5000,
        currency: 'usd',
        // Verify your integration in this guide by including this parameter
        metadata: {integration_check: 'accept_a_payment'},
        receipt_email: email,
      });

      res.json({'client_secret': paymentIntent['client_secret']})
})

app.post('/sub', async (req, res) => {
  const {email, payment_method} = req.body;

  const customer = await stripe.customers.create({
    payment_method: payment_method,
    email: email,
    invoice_settings: {
      default_payment_method: payment_method,
    },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ plan: 'price_1IspDtLjpdOyivM3Hqzn8yhf' }],
    expand: ['latest_invoice.payment_intent']
  });
  
  const status = subscription['latest_invoice']['payment_intent']['status'] 
  const client_secret = subscription['latest_invoice']['payment_intent']['client_secret']
  const customer_obj = JSON.stringify(customer)
  const stringSubscription = JSON.stringify(subscription)

  res.json({'client_secret': client_secret, 'status': status, 'customer_obj': customer_obj, 'subscription_obj': stringSubscription});
})

app.post('/create-customer-portal-session', async (req, res) => {
  //req body
  const {customerId} = req.body;
  // Authenticate your user.
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'http://localhost:3000/',
  });

  res.json({'redirectUrl': session.url})
});

app.post('/get-customer-data', async (req, res) =>{
  const {subId} = req.body;

  const subscription = await stripe.subscriptions.retrieve(
    subId
  );
  
  const subscriptionString = JSON.stringify(subscription)

  res.json({'subscriptionDetails': subscriptionString})
})





server.listen(PORT, () => console.log(`server http://localhost:${PORT}`))

//socket part

const allConnections = []
var rooms = []
var roomFound = false
const roomLimitReached = []

const userInRoom = []
const userRooms = []
const userData = []

var playerArr = []
const Players = {}
const UsersInRoom = {}
const playerSocketIdPorps = {}
const hostSocketIdPorps = {}

const socketLeft = []
const roomsWithGames = []


io.on('connection', (socket)=>{
    allConnections.push(socket.id)
    console.log(`made connected ${socket.id} total connection: ${allConnections.length}`)
    console.log(socket.rooms)


    socket.on('disconnecting', () => {
        console.log(socket.id);
        if(socketLeft.includes(socket.id)){
            socketLeft.splice(socketLeft.indexOf(socket.id), 1)
            return
        }
        if(hostSocketIdPorps[socket.id] !== undefined){
            console.log(hostSocketIdPorps)
            console.log(hostSocketIdPorps[socket.id])
            console.log(hostSocketIdPorps[socket.id].room)

            //terminate the room
            socket.leave(hostSocketIdPorps[socket.id].room)
            io.to(hostSocketIdPorps[socket.id].room).emit('EndedGame', 'end')

            console.log(rooms, 'this is your rooms')
            rooms.splice(rooms.indexOf(hostSocketIdPorps[socket.id].room), 1)
            console.log(rooms, 'this is your rooms')

            delete hostSocketIdPorps[socket.id]
        }
        if(playerSocketIdPorps[socket.id] !== undefined){
            console.log(playerSocketIdPorps)
            console.log(playerSocketIdPorps[socket.id])
            console.log(playerSocketIdPorps[socket.id].room)

            //make the player leave the room

            socket.leave(playerSocketIdPorps[socket.id].room)
            console.log(socket.rooms, 'see the room you left')
            delete Players[`${playerSocketIdPorps[socket.id].name}${playerSocketIdPorps[socket.id].room}`]
            UsersInRoom[playerSocketIdPorps[socket.id].room].splice(UsersInRoom[playerSocketIdPorps[socket.id].room].indexOf(playerSocketIdPorps[socket.id].name), 1)
            console.log(UsersInRoom[playerSocketIdPorps[socket.id].room])
    
            console.log(Players)
            io.to(playerSocketIdPorps[socket.id].room).emit('playerLeftRoom', {
                UsersInRoom: UsersInRoom[playerSocketIdPorps[socket.id].room]
            })

            delete playerSocketIdPorps[socket.id]
        }
      });


    socket.on('createroom', (data)=>{
        if(data.host == null) return
        if(rooms.includes(data.room) == false){
        socket.join(data.room)
        rooms.push(data.room)
        console.log(socket.rooms)
        io.to(data.room).emit('roomcreated', {
            message:`Success Fully created ${data.room}`,
            room: data.room,
            gamecode: data.gamecode
        })
        hostSocketIdPorps[socket.id] = {room: data.room}
    }
    else{
        io.to(socket.id).emit('roomAlreadyExists', '')
    }
    })
    socket.on('joinHostRoom', (data)=>{
        console.log(data.room)
        socket.join(data.room)
        console.log(socket.rooms)
    })

    socket.on('time', (data)=>{
        io.to(data.room).emit('timeBoard', {
            time: data.time,
            user: data.user
        })
    })


    socket.on('joinPlayerRoom', (data)=>{
        console.log(data.room)
        socket.join(data.room)
        console.log(socket.rooms)

        io.to(data.room).emit('joinedWaitingRoom', 'Joined The Waiting Room')
    })
    socket.on('joinGame', (data)=>{
        console.log(data.room)
        socket.join(data.room)
        console.log(socket.rooms)

        io.to(data.room).emit('joinedGameRoom', 'Joined the game')
    })

    socket.on('adduser', (data)=>{
        if(data.name + data.room in Players){
            io.to(socket.id).emit('changeName', {
                name: data.name,
                message: `The Name ${data.name} is Already taken choose another one`
            });
        }
        else{
            if(data.name !== undefined){
                userInRoom.push(data.name)
                userRooms.push(data.room)
                Players[`${data.name}${data.room}`] = {name:data.name, room:data.room}
                playerSocketIdPorps[socket.id] = {name:data.name, room:data.room}

                
                var keys = Object.keys(Players)
                for(var i = 0; i < Object.keys(Players).length; i++){
                    if(Players[keys[i]].room == data.room){
                        playerArr.push(Players[keys[i]].name)
                    }
                }
                UsersInRoom[data.room] = playerArr
                console.log(UsersInRoom[data.room], 'this is the array you are looking for')
                playerArr = []
        
        
        
                console.log(data.room)


                if(Players[data.name + data.room])
        
                io.to(data.room).emit('addeduser', {
                    currentRoom: data.room,
                    names: userInRoom,
                    UserRooms: userRooms,
                    UsersInRoom: UsersInRoom[data.room],
                    name: data.name
                })
                io.sockets.emit('roomAdd', 'aleert')
            }
        }

    })
    socket.on('roomLimitReached', (data) =>{
        roomLimitReached.push(data)
    })

    socket.on('startGame', (data)=>{
        console.log(data.room)
        io.to(data.room).emit('gameStarted', {
            message: `Game has Started in ${data.room}`,
            room: data.room,
            gamecode: data.gamecode
        })
        roomsWithGames.push(data.room)

    })

    socket.on('PlayerFinsihed', (data)=>{
        io.to(data.room).emit('UpdatePodium', {
            user: data.user,
            room: data.room,
            time: data.time
        })
        io.to(data.room).emit('PlayerFinished2', data.user)
    })

    socket.on('leaveRoom', (data)=>{
        socket.leave(data.room)
        socketLeft.push(socket.id)
        console.log(socket.rooms, 'see the room you left')
        delete Players[`${data.user}${data.room}`]
        UsersInRoom[data.room].splice(UsersInRoom[data.room].indexOf(data.user), 1)
        console.log(UsersInRoom[data.room])

        console.log(Players)
        io.to(data.room).emit('playerLeftRoom', {
            UsersInRoom: UsersInRoom[data.room]
        })
        console.log('emited')
    })

    socket.on('EndGame', (data)=>{
        socket.leave(data.room)
        io.to(data.room).emit('EndedGame', 'end')

        console.log(rooms, 'this is your rooms')
        rooms.splice(rooms.indexOf(data.room), 1)
        console.log(rooms, 'this is your rooms')
        roomLimitReached.splice(roomLimitReached.indexOf(data.room), 1)
        roomsWithGames.splice(roomsWithGames.indexOf(data.room), 1)
    })

    socket.on('GameOver', (data)=>{
        socket.leave(data.room)
        io.to(data.room).emit('GameIsOver', data.podium)

        console.log(rooms, 'this is your rooms')
        rooms.splice(rooms.indexOf(data.room), 1)
        console.log(rooms, 'this is your rooms')
        roomLimitReached.splice(roomLimitReached.indexOf(data.room), 1)
        roomsWithGames.splice(roomsWithGames.indexOf(data.room), 1)
    })

    socket.on('GenerateCode', (data)=>{
        var code = 0
        const codeFunction = () => {
            code = Math.random().toString(36).substring(2)
            if(rooms.includes(code)){
                codeFunction()
            }
        }
        codeFunction()
        if(rooms.includes(code)){
            codeFunction()
        }
        io.to(socket.id).emit('GeneratedCode', code)
    })


    socket.on('joinroom', (data)=>{
        console.log(socket.rooms)
        roomFound = false
        if(roomLimitReached.includes(data.code) == true){
            io.to(socket.id).emit('roomFull', {
                room: data.code,
                message: `The Room ${data.code} Is Full`
            })
            return
        }
        if(roomsWithGames.includes(data.code)){
            io.to(socket.id).emit('gameAlreadyStarted', {
                room: data.code,
            })
            return
        }
        for (var i = 0; i < rooms.length; i++){
            if(rooms[i] == data.code){
                socket.join(data.code)
                console.log(socket.rooms)
                io.to(data.code).emit('myroom', {
                    room: data.code,
                    name: data.name
                })
                roomFound = true
            }
            else{
                //
            }
        }
        if (roomFound == false){
            io.sockets.emit('roomcallback', {
                message: 'Room not Found :(',
                joined: false
            })
        }
        if(roomFound == true){
            io.sockets.emit('roomcallback', {
                message: `Room ${data.code} Found!`,
                joined: true
            })
        }
        
    })
})