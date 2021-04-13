"use strict";

const lib = require("./lib");

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Server Setup START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
app.use(express.static('public'))

app.get('/', function (req, res) {
  res.sendFile('index.html', { root: __dirname });
});
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Server Setup END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Game Constants START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
const MAX_LOBBY_SIZE = 12;
const MIN_PLAYERS = 2; //TODO: Min players should probably be 3 or 4? 
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Game Constants END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Utility Functions START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
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

const getSocket = (socketId) =>
  io.sockets.sockets.get(socketId);

const checkRoomExists = (roomName) =>
  io.sockets.adapter.rooms.has(roomName);
const getRoomSize = (roomName) =>
  io.sockets.adapter.rooms.get(roomName).size;

const getUsername = (socketObject) =>
  lobbies[socketObject.lobbyId].users[socketObject.id];
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Utility Functions END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Lobbies and User Data START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
//TODO: Make a global users dict that points to lobbyId instead?
//TODO: Make lobby into a class?
//TODO: Default usernames
//TODO: No duplicate username? Not necessary since userId but might be preferred
//TODO: https://socket.io/docs/v4/emitting-events/ Acknowledgements might be good for joining a lobby.
//TODO: Have the users join a room with their lobby id.

/*
 * lobbies keeps track of the game and user data for each current ongoing game or lobby.
 * 
 * Each socket object should keep track of its lobbyId.
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

/* 
 * Adds a user to a lobby.
 * 
 * Adds their {socketio.id: username} pair to the users dict in lobby.
 * Also assigns the socket object the lobbyId property, and has it
 * join a room with name lobbyId.
 */
function addUserToLobby(lobbyId, socketObject, username) {
  // If user is already in a lobby, don't let them rejoin
  if ('lobbyId' in socketObject) return;

  socketObject.lobbyId = lobbyId;
  socketObject.join(lobbyId);

  lobbies[lobbyId].users[socketObject.id] = username;
}
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Lobbies and User Data END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ SocketIO START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
io.on('connection', function (socket) {
  socket.on('createClicked', function (newUsername) {
    let newLobbyId = createLobby();

    if (newUsername === '') {
      newUsername = 'Player 1';
    }
    addUserToLobby(newLobbyId, socket, newUsername);

    socket.emit('gameRoomNo', newLobbyId); //TODO: Rename to 'succesfullyJoinedLobby'/'joinedLobbyEvent' or something?
    socket.emit('init', 1); //TODO: Replace with 'succesfullyJoinedLobby'?
  });

  socket.on('joinClicked', function (lobbyId, username) {
    if (checkRoomExists(lobbyId) && getRoomSize(lobbyId) > 0) {
      if (getRoomSize(lobbyId) >= MAX_LOBBY_SIZE) {
        socket.emit('tooManyPlayers');
        return;
      }

      if (username === '') {
        username = 'Player ' + (getRoomSize(lobbyId) + 1);
      }
      addUserToLobby(lobbyId, socket, username);

      socket.emit('waitingRoomforPlayer', lobbyId);
      io.in(lobbyId).emit('broadcastJoined', getUsername(socket));
    } else {
      socket.emit('errorRoomId'); //TODO: should maybe do this with a callback? And pass an error message
      return;
    }
  });

  socket.on('startGame', function (lobbyId, maxPlayers, roundInput, roundTimer) {
    let currentRoomSize = getRoomSize(lobbyId);

    if (currentRoomSize < MIN_PLAYERS) {
      socket.emit('tooFewPlayers'); //TODO: is there a better way to handle errors? (callbacks??)
      return;
    }

    /* START TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST */
    lobbies[lobbyId].state = lib.createGameInstance(currentUsernames, currentRoomSize, maxPlayers, roundInput, roundTimer, lobbyId);


    /* END TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST TEST */


    let currentUsernames = Object.values(lobbies[lobbyId].users);

    //TODO: TEMPORARY FOR LOOP AND VARIABLE 
    const playerStates = [];
    for (let k = 0; k < currentUsernames.length; k++) {
      playerStates.push({ socketId: null, username: currentUsernames[k], score: 0, guessed: false })
    }
    //TODO: Default values if these aren't entered by the user? Or will that be client side? (Should probably handle it here)
    //TODO: This should probably just take in the users object? Although we don't want to duplicate that, so maybe not. (But we're duplicating rn... so still bad)
    //TODO: I AM CURRENTLY NOT ACTUALLY INITIALIZING THE GAME STATE SO I CAN GET OTHER STUFF TO WORK, FIRST.
    // lobbies[lobbyId].state = lib.createGameInstance(currentUsernames, currentRoomSize, maxPlayers, roundInput, roundTimer, lobbyId); 
    //TODO: THIS IS TEMPORARY
    lobbies[lobbyId].state = {
      players: playerStates,
      rules: {
        maxPlayers: 10,
        numRounds: 3,
        roundTimer: 1000 * 5 //TEST at 5 second rounds
      },
      meta: {
        currentCountdown: null,
        currentTimeLeft: 5, //TEST at 5 second rounds
        roomID: lobbyId, //TODO: roomID vs roomId (capitalization) (actually, we shouldn't need this inside the gameState at all)
        totalPlayers: currentRoomSize,
        drawPairs: -9999,
        currRound: 0,
        currWord: 'hamburglar',
        currDrawers: [Object.keys(lobbies[lobbyId].users)[0], Object.keys(lobbies[lobbyId].users)[1]],
        currGuessers: Object.keys(lobbies[lobbyId].users).slice(2)
      }
    }
    //TODO: Ok so we really should not be duplicating stuff like roomId. We'll have to have a conversation about what's stored where.
    //      In order to not duplicate stuff, we can have functions that find all the right bits of data and send them to the clients.

    //emit 'New Round' event that gives game instance data to front end to notify players of views, correct answer, time left, current scoreboard
    // updateGameState(lobbyId, lobbies[lobbyId].state); //TODO: UNCOMMENT THIS

    console.log('Current drawers: ' + lobbies[lobbyId].state.meta.currDrawers);
    notifyDrawers(lobbyId, lobbies[lobbyId].state);
    notifyGuessers(lobbyId, lobbies[lobbyId].state);

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
    // console.log(lobbies[lobbyId].state);
    // console.log('\n---------------\n', lobbies[lobbyId].state.meta.drawPairs);
    console.log('\n\n====+++++++++++++++++=======');

    // ENTER GAME LOOP HERE
    //if result of game state != 1 (end of game/ all rounds)
    //emit game state function called (go through the gameloop to update state)
    //else emit endGame event, clear game state
    // lib.startGameLoop(gameState); TODO: I think we never want to call this? We made our own loop using setInterval.
    console.log('SERVER HERE!');

    //TODO: TEMPORARY (should be called by updateGameState) (we really need clearer funciton names)
    startGameTimer(lobbyId);
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

  function endOfRound(lobbyId) {
    //if result of game state != 1 (end of game/ all rounds)
    //game state function called (go through the gameloop to update state)
    //else{
    //  emit to display final screen w scorboard
    //  ask if wanna start over
    //  clear all game states, emit end game msg
    //}

    if (lobbies[lobbyId].state.meta.currRound >= lobbies[lobbyId].state.rules.numRounds) {
      endOfGame();
    }

    //showing score board 
    //call updateGameState in 5 seconds
    else {
      console.log("End of the round! Displaying scores now"); //TODO: TEMP
      console.log("Next round will start in 5 seconds"); //TODO: TEMP
      io.sockets.in(lobbyId)
        .emit('endRoundScores', lobbies[lobbyId].state);

      setTimeout(() => console.log("About to start next round!"), 4900); //TODO: TEMP
      setTimeout(() => updateGameState(lobbyId, lobbies[lobbyId].state), 5000);
    }
  };

  function countdown(lobbyId) {
    console.log('Time left in a game: ', lobbies[lobbyId].state.meta.currentTimeLeft)

    if (lobbies[lobbyId].state.meta.currentTimeLeft <= 0) {
      clearInterval(lobbies[lobbyId].state.meta.currentCountdown);
      endOfRound(lobbyId);
    } else {
      io.sockets.in(lobbyId)
        .emit('timerUpdate', lobbies[lobbyId].state.meta.currentTimeLeft);
    }

    lobbies[lobbyId].state.meta.currentTimeLeft--;
  }

  //params: roomId, state[roomId]
  function updateGameState(roomId, gameState) {
    gameState.meta.currRound++;
    gameState.meta.currWord = gameState.meta.drawPairs[gameState.meta.currRound][0];
    gameState.meta.currDrawers = [gameState.meta.drawPairs[gameState.meta.currRound][1][0], gameState.meta.drawPairs[gameState.meta.currRound][2][0]]
    gameState.meta.currGuessers = lib.getAllGuessers(lib.playerArray, gameState.meta.currDrawers);
    gameState.meta.currentTimeLeft = gameState.rules.roundTimer;
    startGameTimer(lobbyId);

    io.sockets.in(roomId)
      .emit('gameState', gameState);
  };

  function notifyDrawers(lobbyId) {
    for (let id of lobbies[lobbyId].state.meta.currDrawers) {
      io.sockets.in(id).emit('drawerView', lobbies[lobbyId].state); //TODO: Think about what information we actually want/need to send
    }
  };

  function notifyGuessers(lobbyId) {
    for (let id of lobbies[lobbyId].state.meta.currGuessers) {
      io.sockets.in(id).emit('guesserView', lobbies[lobbyId].state); //TODO: Think about what information we actually want/need to send
    }
  };

  //maybe second param of endGame func could be result/ score instance of state obj
  //params: roomId, state[roomId]
  function endOfGame() { };
  //params: roomId
  function startGameTimer(lobbyId) {
    lobbies[lobbyId].state.meta.currentCountdown = setInterval(() => countdown(lobbyId), 1000);
  };



  socket.on('disconnect', function () {
    console.log('A user disconnected');
    // remove the username from global usernames list
    // delete usernames[socket.username];
    // update list of users in chat, client-side
    // io.sockets.emit('updateusers', usernames);
    // echo globally that this client has left
    socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected'); //TODO: Probably want to emit just to the room, not all lobbies
  });
});
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ SocketIO END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



http.listen(5000, function () {
  console.log('listening on *:5000');
});
