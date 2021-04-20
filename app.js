'use strict';

const lib = require('./lib');

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

const DEFAULT_MAX_PLAYERS = 12;
const DEFAULT_NUM_ROUNDS = 8;
const DEFAULT_ROUND_TIMER = 3; //TODO: set this back to 45

const SCORE_DISPLAY_TIMER = 5;
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

const createScoreObject = (lobbyId) => {
  let scores = {};
  for (let [socketId, username] of Object.entries(lobbies[lobbyId].users)) {
    scores[socketId] = {
      username,
      score: lobbies[lobbyId].state.players[socketId].score,
      drawer: 0,
      doneGuessing: lobbies[lobbyId].state.players[socketId].doneGuessing,
    }
  }

  let { drawer1, drawer2 } = lobbies[lobbyId].state.roundInfo.drawers;
  scores[drawer1].drawer = 1;
  scores[drawer2].drawer = 2;

  return scores;
};
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Utility Functions END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Lobbies and User Data START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
//TODO: Make a global users dict that points to lobbyId instead?
//TODO: Make lobby into a class?
//TODO: No duplicate username? Not necessary since userId but might be preferred
//TODO: https://socket.io/docs/v4/emitting-events/ Acknowledgements might be good for joining a lobby.

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

  socket.on('startGame', function (lobbyId, maxPlayers, numRounds, roundTimer) {
    if (maxPlayers === '') maxPlayers = DEFAULT_MAX_PLAYERS;
    else maxPlayers = parseInt(maxPlayers); //TODO: error handling for unparseable values
    if (numRounds === '') numRounds = DEFAULT_NUM_ROUNDS;
    else numRounds = parseInt(numRounds);
    if (roundTimer === '') roundTimer = DEFAULT_ROUND_TIMER;
    else roundTimer = parseInt(roundTimer);

    let currentRoomSize = getRoomSize(lobbyId);

    if (currentRoomSize < MIN_PLAYERS) {
      socket.emit('tooFewPlayers'); //TODO: is there a better way to handle errors? (callbacks??)
      return;
    }

    let currentUserIds = Object.keys(lobbies[lobbyId].users);

    lobbies[lobbyId].state = lib.createGameInstance(
      currentUserIds,
      maxPlayers,
      numRounds,
      roundTimer
    );
    lib.setUpRound(lobbies[lobbyId].state, 0);
    startRound(lobbyId);

    //
    //players will type their guesses and events are emitted
    //
    //whenever 'correctGuess' event is emitted, check to see if all other players guessed correctly
    //if so, end round early

    //OR
    //if timeLeft == 0 and curRound != numOfRounds
    //emit to display scoreboard
    //emit updateGameState to start next round and update views

    //else
    //emit to display final screen w scorboard
    //ask if wanna start over
    //clear all game states, emit end game msg

    // ENTER GAME LOOP HERE
    //if result of game state != 1 (end of game/ all rounds)
    //emit game state function called (go through the gameloop to update state)
    //else emit endGame event, clear game state
  });

  socket.on('correctGuess', function (gameState, roomId) { //TODO: I think this should be deleted
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
      clearInterval(gameState.state.timer.id);
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

  socket.on('playerGuess', function (playerGuess) {
    let lobbyId = socket.lobbyId;
    var ld = lib.getLDistance(playerGuess, lobbies[lobbyId].state.roundInfo.compound.word;
    if (ld == 0) {

      // Calculate guesser score
      var score = lib.calculateScore(lobbies[lobbyId].state.roundInfo.guessCount);
      console.log(score);

      // Update player object score
      lobbies[lobbyId].state.players[socket.id].score += score;
      lobbies[lobbyId].state.players[socket.id].guessed = true;
      lobbies[lobbyId].state.roundInfo.guessCount++;

      // Give drawers points
      var drawer1 = lobbies[lobbyId].state.roundInfo.drawers.drawer1;
      lobbies[lobbyId].state.players[drawer1] += 5;
      var drawer2 = lobbies[lobbyId].state.roundInfo.drawers.drawer2;
      lobbies[lobbyId].state.players[drawer2] += 5;

      updateGuessed(roomId, state[roomId]);
      if (allGuessed(gameState)) {
        clearInterval(gameState.state.timer.id);
      }
    }// TODO: Needs a case for when distance = 1? (Returns "you were close!" or something?) 
    else if(ld == 1){
      io.sockets.in(roomId)
        .emit('wrongGuess', playerGuess, socket.id);
    }
    else { 
      io.sockets.in(roomId)
        .emit('wrongGuess', playerGuess, socket.id);
    }
  });

  function updateGuessed(roomId, gameState) { //TODO: Needs updating, sends too much data
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

    if (lobbies[lobbyId].state.roundInfo.round + 1 >= lobbies[lobbyId].state.rules.numRounds) {
      endOfGame(lobbyId);
    } else {
      console.log('End of the round! Displaying scores now'); //TODO: TEMP
      console.log(`Next round will start in ${SCORE_DISPLAY_TIMER} seconds`); //TODO: TEMP
      io.sockets.in(lobbyId)
        .emit('endRoundScores', lobbies[lobbyId].state);

      setTimeout(() => advanceRoundAndStart(lobbyId), SCORE_DISPLAY_TIMER * 1000);
    }
  };

  function countdown(lobbyId) {
    console.log('Time left in a game: ', lobbies[lobbyId].state.timer.timeLeft)

    if (lobbies[lobbyId].state.timer.timeLeft <= 0) {
      clearInterval(lobbies[lobbyId].state.timer.id);
      endOfRound(lobbyId);
    } else {
      io.sockets.in(lobbyId)
        .emit('timerUpdate', lobbies[lobbyId].state.timer.timeLeft);
    }

    lobbies[lobbyId].state.timer.timeLeft--;
  }

  //params: roomId, state[roomId]
  // function updateGameState(roomId, gameState) {
  //   gameState.meta.currRound++;
  //   gameState.meta.currWord = gameState.meta.drawPairs[gameState.meta.currRound][0];
  //   gameState.meta.currDrawers = [gameState.meta.drawPairs[gameState.meta.currRound][1][0], gameState.meta.drawPairs[gameState.meta.currRound][2][0]]
  //   gameState.meta.currGuessers = lib.getAllGuessers(lib.playerArray, gameState.meta.currDrawers);
  //   gameState.meta.currentTimeLeft = gameState.rules.roundTimer;
  //   startGameTimer(lobbyId);

  //   io.sockets.in(roomId)
  //     .emit('gameState', gameState);
  // };

  function advanceRoundAndStart(lobbyId) {
    lobbies[lobbyId].state.roundInfo.round += 1;
    lib.setUpRound(lobbies[lobbyId].state, lobbies[lobbyId].state.roundInfo.round);

    startRound(lobbyId);
  }

  function startRound(lobbyId) {
    lobbies[lobbyId].state.timer.timeLeft = lobbies[lobbyId].state.rules.roundTimer;

    notifyDrawers(lobbyId);
    notifyGuessers(lobbyId);
    startGameTimer(lobbyId);
    //TODO: Do we need to emit a 'new round' event? Or is notifying the drawers and guessers good enough?
    // (It's probably good enough, we just need to be sure to pass them any needed new-round info)
  }

  function notifyDrawers(lobbyId) {
    let drawer1Id = lobbies[lobbyId].state.roundInfo.drawers.drawer1;
    let drawer2Id = lobbies[lobbyId].state.roundInfo.drawers.drawer2;

    let drawer1Data = {
      drawer: 1,
      word: lobbies[lobbyId].state.roundInfo.compound.left,
      totalRoundTime: lobbies[lobbyId].state.rules.roundTimer
    };
    let drawer2Data = {
      drawer: 2,
      word: lobbies[lobbyId].state.roundInfo.compound.right,
      totalRoundTime: lobbies[lobbyId].state.rules.roundTimer
    };

    io.sockets.in(drawer1Id)
      .emit('drawerView', createScoreObject(lobbyId), drawer1Data);
    io.sockets.in(drawer2Id)
      .emit('drawerView', createScoreObject(lobbyId), drawer2Data);
  };

  function notifyGuessers(lobbyId) {
    let guesserData = {
      word1Length: lobbies[lobbyId].state.roundInfo.compound.left.length,
      word2Length: lobbies[lobbyId].state.roundInfo.compound.right.length,
      totalRoundTime: lobbies[lobbyId].state.rules.roundTimer
    };

    for (let id of lobbies[lobbyId].state.roundInfo.guessers) {
      io.sockets.in(id).emit('guesserView', createScoreObject(lobbyId), guesserData);
    }
  };

  //params: lobbyId
  function endOfGame(lobbyId) {
    console.log("Ending the game!");
    io.sockets.in(lobbyId).emit('gameOverEvent', createScoreObject(lobbyId));
  };

  //params: lobbyId
  function startGameTimer(lobbyId) {
    lobbies[lobbyId].state.timer.id = setInterval(() => countdown(lobbyId), 1000);
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
