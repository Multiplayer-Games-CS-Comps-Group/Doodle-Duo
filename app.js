const lib = require("./lib");

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

var gameInstancesArray = [];


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
        //console.log('INSIDE START GAME FUNC');
        if(io.sockets.adapter.rooms.has(parseInt(roomId)) && (io.sockets.adapter.rooms.get(parseInt(roomId))).size !== 0){
            if ((io.sockets.adapter.rooms.get(parseInt(roomId))).size < 2){
                    socket.emit('tooFewPlayers');
                    return;
                }
        }
        var playersInRoom = io.sockets.adapter.rooms.get(parseInt(roomId));

        //console.log(`roomID: ${roomId}; maxPlayers: ${maxPlayers}; roundInput: ${roundInput}; roundTimer: ${roundTimer}`);
        let gameState = lib.createGameInstance(usernames,playersInRoom,maxPlayers,roundInput, roundTimer, roomId);
        //emit 'New Round' even that gives game instance data to front end to notify players of views, correct answer, time left, current scoreboard
        state[roomId] = gameState;
        updateGameState(roomId, state[roomId]);
        console.log('curr drawers: '+state[roomId].meta.currDrawers);
        notifyDrawers(roomId, state[roomId]);
        notifyGuessers(roomId,state[roomId]);

        //
        //players will type their guesses and events are emitted
        //
        //whenever 'correctGuess' event is emitted, check to see if all other players guessed correctly
        //if so, end round early

        // if (response === "DIE") {
        //     console.log("mama mia!");
        //     clearTimeout(currentCountdown);

        //OR
        //if timeLeft == 0 and curRound != numOfRounds
            //emit to display scoreboard
            //emit updateGameState to start next round and update views

        //else
            //emit to display final screen w scorboard
            //ask if wanna start over
            //clear all game states, emit end game msg
            
            
        

        console.log('\n\n====+++++++++++++++++=======');
        console.log(gameState);
        console.log('\n---------------\n', gameState.meta.drawPairs);
        console.log('\n\n====+++++++++++++++++=======');

        // ENTER GAME LOOP HERE
        //if result of game state != 1 (end of game/ all rounds)
        //emit game state function called (go through the gameloop to update state)
        //else emit endGame event, clear game state
        lib.startGameLoop(gameState);
        console.log('SERVER HERE!');
        
     });

     socket.on('correctGuess',function(gameState,roomId){
        //update player's guess boolean to be true
        for(var i = 0; i<gameState.players.length;i++){
            if (gameState.players[i].socketId.equals(socket.id)){
                gameState.players[i].score+=10;
                gameState.players[i].guessed = true;
            }
        }
        state[roomId] = gameState;
        //WARNING! WE NEED TO DIFFERENTIATE BETWEEN UPDATE STATE WHEN CORRECT GUESSES ARE MADE
        //VERSUS NEW ROUND DATA
        //updateGameState(roomId, state[roomId]);
        updateGuessed(roomId,gameState,socket.username);
        //CHECK IF ALL OTHERS ARE DONE WITH GUESSES
        //CALL ALL GUESSED FUNCTION
        if(allGuessed()){
            clearInterval(gameState.meta.currentCountdown);
        }
        
     });

     socket.on('playerGuess',function(playerGuess,roomId){
         io.sockets.in(roomId)
            .emit('wrongGuess',playerGuess,socket.id);

     });
    
    function updateGuessed(roomId,gameState){
        io.sockets.in(roomId)
            .emit('someoneGuessed',gameState);
    }

    function displayScore(roomId,gameState){
        //showing score board 
        //call updateGameState in 5 seconds
        //if result of game state != 1 (end of game/ all rounds)
        //egame state function called (go through the gameloop to update state)
        // if (game isn[t over) {
            setTimeout(() => updateGameState(roomId,gameState) ,5000);
        // }

        //else{
            //emit to display final screen w scorboard
            //ask if wanna start over
            //clear all game states, emit end game msg
        //}


    }

    function countdown() {
        if (currentTimeLeft <= 0 ) {
          clearInterval(gameState.meta.currentCountdown);
        }
      
        currentTimeLeft--;
    }
      

     //params: roomId, state[roomId]
    function updateGameState(roomId, gameState){
        gameState.meta.currentTimeLeft = gameState.rules.roundTimer;
        gameState.meta.currentCountdown = setInterval(countdown, 1000);

        io.sockets.in(roomId)
            .emit('gameState', gameState);
    };
    function notifyDrawers(roomId,gameState){
        io.sockets.in(roomId)
            .to(gameState.meta.currDrawers).emit('drawerView',gameState);
    }
    function notifyGuessers(roomId,gameState){
        io.sockets.in(roomId)
            .to(gameState.meta.currGuessers).emit('guesserView',gameState);
    }
    //maybe second param of endGame func could be result/ score instance of state obj
    //params: roomId, state[roomId]
    function endOfGame(){};
    //params: roomId
    function startGameInterval(){};



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


http.listen(5000,function(){
    console.log('listening on *:5000');
});

