"use strict";

const lib = require("./lib");

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'))

app.get('/', function (req, res) {
  res.sendFile('index.html', { root: __dirname });
});



const getRandBetween = (min, max) =>
  Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min);

function genId(min, max, dict, prefix = null) {
  let newId = getRandBetween(min, max);

  // Generate new random ID until it's not a duplicate of one in the 
  // dictionary it's being generated for
  while (newId in dict) newId = getRandBetween(min, max);

  if (prefix) newId = prefix + newId;

  return newId;
}

//TODO: Make a global users dict that points to lobbyId instead?
//TODO: Make lobby into a class?
//TODO: Default usernames
//TODO: No duplicate username? Not necessary since userId but might be preferred

/*
 * lobbies keeps track of the game and user data for each current ongoing game or lobby.
 * 
 * Each socket object should keep track of its lobbyId and userId.
 */
const lobbies = {}
function createLobby() {
  let lobbyId = genId(10000, 99999, lobbies, 'lobby');

  lobbies[lobbyId] = {
    state: {},
    users: {}
  }

  return lobbyId;
}

function addUserToLobby(lobbyId, socketObject, username) {
  // If user already has an ID, they should already be in a lobby/
  // TODO: Might want to allow a user with an existing ID to join a lobby 
  // (for example if they came from a previous game).
  if ('userId' in socketObject) return; 

  socketObject.lobbyId = lobbyId;
  
  let userId = genId(10000, 99999, lobbies[lobbyId].users, 'user');
  socketObject.userId = userId;
  lobbies[lobbyId].users[userId] = username;
}

// TEST CODE
// let newLobby1 = createLobby();
// let newLobby2 = createLobby();
// let test12 = {}
// addUserToLobby(newLobby1, {}, 'monkey1');
// addUserToLobby(newLobby1, {}, 'monkey2');
// addUserToLobby(newLobby1, {}, 'monkey3');
// addUserToLobby(newLobby1, {}, 'monkey4');
// addUserToLobby(newLobby2, {}, 'gorilla1');
// addUserToLobby(newLobby2, {}, 'gorilla2');
// addUserToLobby(newLobby2, {}, 'gorilla3');
// addUserToLobby(newLobby2, test12, 'gorilla4');

io.on('connection', function (socket) {
  socket.on('createClicked', function (data) {
    socket.username = data;
    // add the client's username to the global list
    // usernames[socket.username] = data;
    socket.emit('gameRoomNo', roomId);
    //around the 49 minute mark of https://www.youtube.com/watch?v=ppcBIHv_ZPs&ab_channel=TraversyMedia
    //state[roomId]= createGameState();
    socket.join(roomId);
    socket.number = 1;
    socket.emit('init', 1);
  });

  socket.on('joinClicked', function (roomId, username) {
    //look into the room object and grab the current players in the room
    // clientRooms[socket.id] = parseInt(roomId);
    // socket.join(parseInt(roomId));
    const room = io.sockets.adapter.rooms[parseInt(roomId)];

    //if (room){
    if (io.sockets.adapter.rooms.has(parseInt(roomId)) && (io.sockets.adapter.rooms.get(parseInt(roomId))).size !== 0) {
      if ((io.sockets.adapter.rooms.get(parseInt(roomId))).size > 12) {
        socket.emit('tooManyPlayers');
        return;
      }

      socket.join(parseInt(roomId));
      if (username === '') {
        socket.username = 'player ' + io.sockets.adapter.rooms.get(parseInt(roomId)).size;
      }

      else {
        socket.username = username;
        // add the client's username to the global list
        // usernames[username] = username;
      }
      socket.emit('waitingRoomforPlayer', parseInt(roomId));
      socket.in(parseInt(roomId)).emit('broadcastJoined', socket.username);
      //console.log(io.sockets.adapter.rooms);
      console.log(io.sockets.adapter.rooms.get(parseInt(roomId)));
      //allPlayers = room.allSockets();//gives us object of all players, key is client id, object is client itself
    }
    else {
      socket.emit('errorRoomId');
      return;
    }

    // clientRooms[socket.id] = roomId;
    // socket.join(roomId);
    //socket.in('roomid').broadcast('player joined');
    //socket.number = numOfPlayers+1;
    //not sure about the socket.number here whether its supposed to be that or numofPlayers
    socket.emit('init', socket.number);

    startGameInterval(roomId);

  });

  socket.on('startGame', function (roomId, maxPlayers, roundInput, roundTimer) {
    //console.log('INSIDE START GAME FUNC');
    if (io.sockets.adapter.rooms.has(parseInt(roomId)) && (io.sockets.adapter.rooms.get(parseInt(roomId))).size !== 0) {
      if ((io.sockets.adapter.rooms.get(parseInt(roomId))).size < 2) {
        socket.emit('tooFewPlayers');
        return;
      }
    }
    let playersInRoom = io.sockets.adapter.rooms.get(parseInt(roomId));

    //console.log(`roomID: ${roomId}; maxPlayers: ${maxPlayers}; roundInput: ${roundInput}; roundTimer: ${roundTimer}`);
    let gameState = lib.createGameInstance(usernames, playersInRoom, maxPlayers, roundInput, roundTimer, roomId);
    //emit 'New Round' even that gives game instance data to front end to notify players of views, correct answer, time left, current scoreboard
    state[roomId] = gameState;
    updateGameState(roomId, state[roomId]);
    console.log('curr drawers: ' + state[roomId].meta.currDrawers);
    notifyDrawers(roomId, state[roomId]);
    notifyGuessers(roomId, state[roomId]);

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

  socket.on('correctGuess', function (gameState, roomId) {
    //update player's guess boolean to be true
    for (let i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].socketId.equals(socket.id)) {
        gameState.players[i].score += 10;
        gameState.players[i].guessed = true;
      }
    }
    state[roomId] = gameState;
    //WARNING! WE NEED TO DIFFERENTIATE BETWEEN UPDATE STATE WHEN CORRECT GUESSES ARE MADE
    //VERSUS NEW ROUND DATA
    //updateGameState(roomId, state[roomId]);
    updateGuessed(roomId, gameState, socket.username);
    //CHECK IF ALL OTHERS ARE DONE WITH GUESSES
    //CALL ALL GUESSED FUNCTION
    if (allGuessed(gameState)) {
      clearInterval(gameState.meta.currentCountdown);
      updateGuessed(roomId, gameState);
    }

  });

  function allGuessed(gameState) {
    for (let i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].guessed == false) {
        return false;
      }
    }
    return true;
  }

  socket.on('playerGuess', function (playerGuess, roomId) {
    io.sockets.in(roomId)
      .emit('wrongGuess', playerGuess, socket.id);

  });

  function updateGuessed(roomId, gameState) {
    io.sockets.in(roomId)
      .emit('someoneGuessed', gameState);
  };

  function endOfRound(roomId, gameState) {
    //if result of game state != 1 (end of game/ all rounds)
    //egame state function called (go through the gameloop to update state)
    //else{
    //emit to display final screen w scorboard
    //ask if wanna start over
    //clear all game states, emit end game msg
    //}

    if (gameState.meta.currRound == gameState.rules.numRounds) {
      endOfGame();
    }

    //showing score board 
    //call updateGameState in 5 seconds
    else {
      io.sockets.in(roomId)
        .emit('endRoundScores', gameState);
      setTimeout(() => updateGameState(roomId, gameState), 5000);
    }
  };

  function countdown(roomId, gameState) {
    if (currentTimeLeft <= 0) {
      endOfRound(roomId, gameState);
      clearInterval(gameState.meta.currentCountdown);
    }

    currentTimeLeft--;
  }

  //params: roomId, state[roomId]
  function updateGameState(roomId, gameState) {
    gameState.meta.currRound++;
    gameState.meta.currWord = gameState.meta.drawPairs[gameState.meta.currRound][0];
    gameState.meta.currDrawers = [gameState.meta.drawPairs[gameState.meta.currRound][1][0], gameState.meta.drawPairs[gameState.meta.currRound][2][0]]
    gameState.meta.currGuessers = lib.getAllGuessers(lib.playerArray, gameState.meta.currDrawers);
    gameState.meta.currentTimeLeft = gameState.rules.roundTimer;
    gameState.meta.currentCountdown = setInterval(countdown, 1000);

    io.sockets.in(roomId)
      .emit('gameState', gameState);
  };

  function notifyDrawers(roomId, gameState) {
    io.sockets.in(roomId)
      .to(gameState.meta.currDrawers).emit('drawerView', gameState);
  };

  function notifyGuessers(roomId, gameState) {
    io.sockets.in(roomId)
      .to(gameState.meta.currGuessers).emit('guesserView', gameState);
  };

  //maybe second param of endGame func could be result/ score instance of state obj
  //params: roomId, state[roomId]
  function endOfGame() { };
  //params: roomId
  function startGameInterval() { };



  socket.on('disconnect', function () {
    console.log('A user disconnected');
    // remove the username from global usernames list
    // delete usernames[socket.username];
    // update list of users in chat, client-side
    // io.sockets.emit('updateusers', usernames);
    // echo globally that this client has left
    socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
  });
});


http.listen(5000, function () {
  console.log('listening on *:5000');
});

