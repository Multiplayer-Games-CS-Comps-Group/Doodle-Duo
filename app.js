const { emit } = require('process');
const { callbackify } = require('util');

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/',function(req,res){
    //index.html will have 2 buttons: one for creating a new room that will give a random room number
    //the other button is for people to join the room
    //when clicked onto the button, emits "create" or "join" event and outputs the room number/ outputs joined specific room message
    res.sendfile('index.html');
});

// var nsp = io.of('/my-namespace');
// nsp.on('connection',function(socket){
//     nsp.emit('hi','Hello everyone!');
// });

const state = {};
const clientRooms = {};
var clients = 0;
var usernames = {};

io.on('connection',function(socket){
    clients++;
    
    console.log(clientRooms);


    socket.on('createClicked',function(data){
        let genId = function(min,max){ 
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        socket.username = data;
		// add the client's username to the global list
		usernames[socket.username] = data;
		
        console.log('this is host player name: '+ socket.username);

        let roomId = genId(10000,99999);
        clientRooms[socket.id]=roomId;
        console.log('client room added roomId '+ clientRooms[socket.id]);
        socket.emit('gameRoomNo', roomId);
        //around the 49 minute mark of https://www.youtube.com/watch?v=ppcBIHv_ZPs&ab_channel=TraversyMedia
        //state[roomId]= createGameState();
        socket.join(roomId);
        console.log('host joined room '+roomId);
        socket.number = 1;
        socket.emit('init',1);
    });

    socket.on('joinClicked', function(roomId,username){
        //look into the room object and grab the current players in the room
        // clientRooms[socket.id] = parseInt(roomId);
        // socket.join(parseInt(roomId));
        const room = io.sockets.adapter.rooms[parseInt(roomId)];
       
        //if (room){
        if(io.sockets.adapter.rooms.has(parseInt(roomId)) && (io.sockets.adapter.rooms.get(parseInt(roomId))).size !== 0){
            if ((io.sockets.adapter.rooms.get(parseInt(roomId))).size > 12){
                    socket.emit('tooManyPlayers');
                    return;
                }

            socket.username = username;
            // add the client's username to the global list
            usernames[username] = username;
            
            clientRooms[socket.id] = parseInt(roomId);
            socket.join(parseInt(roomId));
            socket.emit('waitingRoomforPlayer',parseInt(roomId));
            socket.in(parseInt(roomId)).emit('broadcastJoined',socket.username);
            console.log(io.sockets.adapter.rooms);
            console.log((io.sockets.adapter.rooms.get(parseInt(roomId))).size);
            //allPlayers = room.allSockets();//gives us object of all players, key is client id, object is client itself
        }
        else{
            socket.emit('errorRoomId');
            return;
        }

        // clientRooms[socket.id] = roomId;
        // socket.join(roomId);
        //socket.in('roomid').broadcast('player joined');
        //socket.number = numOfPlayers+1;
        //not sure about the socket.number here whether its supposed to be that or numofPlayers
        socket.emit('init',socket.number);
        startGameInterval(roomId);
    
    });
    

    socket.on('disconnect', function(){
        clients--;
        console.log('A user disconnected');
        // remove the username from global usernames list
		delete usernames[socket.username];
		// update list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
    });
});

function startGameInterval(roomId){
    
};

http.listen(5000,function(){
    console.log('listening on *:5000');
});