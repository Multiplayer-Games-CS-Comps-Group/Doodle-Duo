const lib = require("./lib");

const { emit } = require('process');
const { callbackify } = require('util');
//const { createData} = require('./compoundGame')
//const { startGameLoop} = require('./compoundGame')
//const game = require("./compoundGame");

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/',function(req,res){
    //index.html will have 2 buttons: one for creating a new room that will give a random room number
    //the other button is for people to join the room
    //when clicked onto the button, emits "create" or "join" event and outputs the room number/ outputs joined specific room message
    res.sendfile('index.html');
    //res.sendfile('hostWaitingRoom.html');
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

    socket.on('createClicked',function(data){
        let genId = function(min,max){ 
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        socket.username = data;
        // add the client's username to the global list
        usernames[socket.username] = data;
        let roomId = genId(10000,99999);
        clientRooms[socket.id]=roomId;
        socket.emit('gameRoomNo', roomId);
        //around the 49 minute mark of https://www.youtube.com/watch?v=ppcBIHv_ZPs&ab_channel=TraversyMedia
        //state[roomId]= createGameState();
        socket.join(roomId);
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
            
            clientRooms[socket.id] = parseInt(roomId);
            socket.join(parseInt(roomId));
            if (username === ''){
                socket.username = 'player '+io.sockets.adapter.rooms.get(parseInt(roomId)).size;
            }

            else{
                socket.username = username;
                // add the client's username to the global list
                usernames[username] = username;
            }
            socket.emit('waitingRoomforPlayer',parseInt(roomId));
            socket.in(parseInt(roomId)).emit('broadcastJoined',socket.username);
            //console.log(io.sockets.adapter.rooms);
            console.log(io.sockets.adapter.rooms.get(parseInt(roomId)));
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
    
    socket.on('startGame',function(roomId,maxPlayers,roundInput,roundTimer){
        var playersInRoom = io.sockets.adapter.rooms.get(parseInt(roomId));

        //console.log(`roomID: ${roomId}; maxPlayers: ${maxPlayers}; roundInput: ${roundInput}; roundTimer: ${roundTimer}`);
        let gameState = createData(usernames,playersInRoom,maxPlayers,roundInput,roundTimer, roomId);
        console.log(gameState);

        startGameLoop(gameState);
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


/*=======================================================================================*/
/* Game Logic Code - Imported due to nodeJS limitations */


// Simulate server creating and sending initData to the game logic
function createData(usernames, websocketID, maxplayers, roundnumber,roundTimer, roomId){

    /* gameInstance object:
        players = array of players with [name, playerID, profile picture object]
        rules = dictionary with all the rules set by the host
        meta = meta data related/useful to the server
    */

    /*
    [
        ['xfdsfh_wqw', 'Alex', 0, 0],
        ['fdef0efe', 'Bob' 0, 0]
    ]
    */

    const tempIterator = websocketID.values();
    
    var playerArray = [];
    for(var i in usernames){
        var curr = [];
        curr.push(tempIterator.next().value);
        curr.push(usernames[i]);
        curr.push(0);
        curr.push(0);
        playerArray.push(curr);
    }

    var gameInstance = {
        players: playerArray,
        rules: {
            maxPlayers: parseInt(maxplayers),
            numRounds:  parseInt(roundnumber),
            roundTimer:  1000 /* parseInt(roundTimer) in milliseconds; 60000 is one minute*/,
        },
        meta: {
            roomID: roomId,
            totalPlayers: playerArray.length
        }
    }

    return gameInstance;
}

function startGameLoop(gameInstance){
    var numRounds = gameInstance.rules.numRounds;
    var roundTimer = gameInstance.rules.roundTimer;
    
    var gameWords = lib.getGameWords(numRounds);
    var players = gameInstance.players;
    var drawPairs = lib.getDrawPairs(gameWords, players);

    console.log(drawPairs);
    for(var i=0;i<drawPairs.length;i++){
        var currWord = drawPairs[i][0];
        var drawer1 = drawPairs[i][1];
        var drawer2 = drawPairs[i][2];
        console.log(`${currWord}: ${drawer1[1]}, ${drawer2[1]}`);
        
        var startTime = Date.now();
        while ((Date.now() - startTime) < roundTimer){
            myTimer();

            //Test function to test exiting the current word early
            //exit function when all players are 'done'
            if(currWord === 'backlog'){
                console.log('Skipping this word');
                break;
            }
        }

        //After everyone guesses, or time runs out
        console.log('Current word done!');
    }
    return [3, 2, 4, 5, 1, 6, 7]
}






function myTimer() {
          var d = new Date();
          var t = d.toLocaleTimeString();
          //console.log(t);
}