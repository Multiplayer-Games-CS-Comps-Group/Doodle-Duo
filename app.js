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
const MIN_PLAYERS = 3;

const DEFAULT_MAX_PLAYERS = 12;
const DEFAULT_NUM_ROUNDS = 8;
const DEFAULT_ROUND_TIMER = 45;

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
      gained: lobbies[lobbyId].state.players[socketId].gained,
      doneGuessing: lobbies[lobbyId].state.players[socketId].doneGuessing,
    }
  }

  let { drawer1, drawer2 } = lobbies[lobbyId].state.roundInfo.drawers;
  scores[drawer1].drawer = 1;
  scores[drawer2].drawer = 2;

  return scores;
};

function allGuessed(lobbyId) {
  for (let { doneGuessing } of Object.values(lobbies[lobbyId].state.players)) {
    if (!doneGuessing) return false;
  }
  return true;
}
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Utility Functions END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ Lobbies and User Data START ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/
//TODO: Make a global users dict that points to lobbyId instead? (Only if we're worried about
//      users knowing eachother's socketId's)
//TODO: https://socket.io/docs/v4/emitting-events/ Acknowledgements might be good for joining a lobby.

/*
 * lobbies keeps track of the game and user data for each current ongoing game or lobby.
 *
 * See notes.js for the structure of lobbies
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

    socket.emit('succesfullyCreatedLobby', newLobbyId);
  });

  socket.on('joinClicked', function (lobbyId, username) {
    lobbyId = lobbyId.trim();
    if (lobbyId.slice(0, 5) !== 'lobby') lobbyId = 'lobby' + lobbyId;

    if (checkRoomExists(lobbyId) && getRoomSize(lobbyId) > 0) {
      if (getRoomSize(lobbyId) >= MAX_LOBBY_SIZE) {
        socket.emit('tooManyPlayers');
        return;
      }

      if (username === '') {
        username = 'Player ' + (getRoomSize(lobbyId) + 1);
      }
      addUserToLobby(lobbyId, socket, username);

      socket.emit('waitingRoomForPlayer', lobbyId);
      io.in(lobbyId).emit('broadcastJoined', getUsername(socket));
    } else {
      socket.emit('errorRoomId'); //TODO: should maybe do this with a callback? And pass an error message
      return;
    }
  });

  socket.on('startGame', function (maxPlayers, numRounds, roundTimer) {
    let lobbyId = socket.lobbyId;
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
  });

  socket.on('drawingUpdate', function (drawingEvents, drawNum) {
    let lobbyId = socket.lobbyId;
    //console.log('Drawing Update Detected on Server:');
    io.sockets.in(lobbyId).emit('drawingUpdate', drawingEvents, drawNum);
  });
  socket.on('undoEvent', function (drawingEvents, drawNum) {
    let lobbyId = socket.lobbyId;
    //console.log('Drawing Update Detected on Server:');
    io.sockets.in(lobbyId).emit('undoEvent', drawingEvents, drawNum);
  });
  socket.on('clearEvent', function (drawingEvents, drawNum) {
    let lobbyId = socket.lobbyId;
    //console.log('Drawing Update Detected on Server:');
    io.sockets.in(lobbyId).emit('undoEvent', drawingEvents, drawNum);
  });

  socket.on('playerGuess', function (playerGuess) {
    console.log('PlayerGuess function is being called!');
    let lobbyId = socket.lobbyId;
    let ld = lib.getLDistance(playerGuess, lobbies[lobbyId].state.roundInfo.compound.word);
    if (ld === 0) {

      // Calculate guesser score
      let score = lib.calculateScore(lobbies[lobbyId].state.roundInfo.guessCount);

      // Update player object score
      lobbies[lobbyId].state.players[socket.id].score += score;
      lobbies[lobbyId].state.players[socket.id].gained += score;
      lobbies[lobbyId].state.players[socket.id].doneGuessing = true;
      lobbies[lobbyId].state.roundInfo.guessCount += 1;

      // Give drawers points
      let drawer1 = lobbies[lobbyId].state.roundInfo.drawers.drawer1;
      lobbies[lobbyId].state.players[drawer1].score += 5;
      lobbies[lobbyId].state.players[drawer1].gained += 5;
      let drawer2 = lobbies[lobbyId].state.roundInfo.drawers.drawer2;
      lobbies[lobbyId].state.players[drawer2].score += 5;
      lobbies[lobbyId].state.players[drawer2].gained += 5;

      updateGuessed(lobbyId, socket);
      if (allGuessed(lobbyId)) {
        clearInterval(lobbies[lobbyId].state.timer.id);
        endOfRound(lobbyId);
      }
    } else if (ld <= 2) {
      socket.emit('closeGuess');
    } else {
      io.sockets.in(lobbyId)
        .emit('wrongGuess', playerGuess, socket.id, lobbies[lobbyId].users[socket.id]);
    }
  });

  function updateGuessed(lobbyId, socketObj) {
    socketObj.emit('correctGuess'); //The view can update to make it clear they guessed
    io.sockets.in(lobbyId)
      .emit(
        'someoneGuessed',
        createScoreObject(lobbyId),
        socketObj.id,
        lobbies[lobbyId].users[socketObj.id]
      );
  };

  function createScoreBoard(lobbyId) {
    let scoreBoard = 'The correct word is: ' + lobbies[lobbyId].state.roundInfo.compound.word + '\n' + 'Current Rankings: \n';
    let allScores = [];
    for (let [socketId, username] of Object.entries(lobbies[lobbyId].users)) {
      allScores.push(createScoreObject(lobbyId)[socketId].score);
      //scoreBoard+=createScoreObject(lobbyId)[socketId].username+": "+ createScoreObject(lobbyId)[socketId].score+"\n";
    }
    allScores.sort(function (a, b) { return b - a });
    let found = [];
    globalThis.winner = '';
    for (var i = 0; i < allScores.length; i++) {
      for (let [socketId, username] of Object.entries(lobbies[lobbyId].users)) {
        if (createScoreObject(lobbyId)[socketId].score == allScores[i] && !(found.includes(createScoreObject(lobbyId)[socketId].username))) {
          scoreBoard += (i + 1) + '. ' + createScoreObject(lobbyId)[socketId].username + ": " + createScoreObject(lobbyId)[socketId].score + "(+" + createScoreObject(lobbyId)[socketId].gained + "points)\n";
          found.push(createScoreObject(lobbyId)[socketId].username);
          if (globalThis.winner == '') {
            globalThis.winner += createScoreObject(lobbyId)[socketId].username;
          }
          break
        }
      }
    }
    return scoreBoard
  }


  function endOfRound(lobbyId) {
    if (lobbies[lobbyId].state.roundInfo.round + 1 >= lobbies[lobbyId].state.rules.numRounds) {
      endOfGame(lobbyId);
    } else {
      console.log('End of the round! Displaying scores now'); //TODO: TEMP
      console.log(`Next round will start in ${SCORE_DISPLAY_TIMER} seconds`); //TODO: TEMP
      io.sockets.in(lobbyId)
        .emit('endRoundScores', createScoreObject(lobbyId),lobbies[lobbyId].state.roundInfo.compound.word);
        //.emit('endRoundScores', createScoreBoard(lobbyId));

      setTimeout(() => advanceRoundAndStart(lobbyId), SCORE_DISPLAY_TIMER * 1000);
    }
  };

  function countdown(lobbyId) {
    // console.log('Time left in a game: ', lobbies[lobbyId].state.timer.timeLeft)

    if (lobbies[lobbyId].state.timer.timeLeft <= 0) {
      clearInterval(lobbies[lobbyId].state.timer.id);
      endOfRound(lobbyId);
    } else {
      io.sockets.in(lobbyId)
        .emit('timerUpdate', lobbies[lobbyId].state.timer.timeLeft);
    }

    lobbies[lobbyId].state.timer.timeLeft--;
  }

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

  function endOfGame(lobbyId) {
    console.log('Ending the game!');
    //let scoreboard = createScoreBoard(lobbyId);
    //scoreboard += 'THE WINNER IS:' + globalThis.winner + '!';
    io.sockets.in(lobbyId).emit('gameOverEvent', createScoreObject(lobbyId),lobbies[lobbyId].state.roundInfo.compound.word);
  };

  function startGameTimer(lobbyId) {
    lobbies[lobbyId].state.timer.id = setInterval(() => countdown(lobbyId), 1000);
  };

  socket.on('disconnect', function () {
    console.log('A user disconnected');
    //TODO: Removing users from game lobbies, and updating those lobbies appropriately
    socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected'); //TODO: Probably want to emit just to the room, not all lobbies
  });
});
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ SocketIO END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/



http.listen(5000, function () {
  console.log('listening on *:5000');
});
