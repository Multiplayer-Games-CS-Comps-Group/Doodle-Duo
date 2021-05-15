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

const SCORE_DISPLAY_TIMER = 15;
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
  if (scores[drawer1]) scores[drawer1].drawer = 1;
  if (scores[drawer2]) scores[drawer2].drawer = 2;

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


/*
 * Removes a user from a lobby
 */
function removeUserFromLobby(socketObject) {
  // If user isn't already in a lobby, exit function
  if (!'lobbyId' in socketObject) return;

  const curLobbyId = socketObject.lobbyId;

  delete socketObject.lobbyId;
  socketObject.leave(curLobbyId);

  delete lobbies[curLobbyId].users[socketObject.id];
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
      socket.emit('waitingRoomForPlayer', lobbyId, lobbies[lobbyId].users);

      addUserToLobby(lobbyId, socket, username);

      io.in(lobbyId).emit('broadcastJoined', lobbies[lobbyId].users);
    } else {
      socket.emit('errorRoomId');
      return;
    }
  });

  socket.on('startGame', function (maxPlayers, numRounds, roundTimer) {
    let lobbyId = socket.lobbyId;

    if( isNaN(maxPlayers) || isNaN(numRounds) || isNaN(roundTimer) ){
      socket.emit('inputError');
      return;
    }
  
    if (maxPlayers === '') maxPlayers = DEFAULT_MAX_PLAYERS;
    else maxPlayers = parseInt(maxPlayers);
    if (numRounds === '') numRounds = DEFAULT_NUM_ROUNDS;
    else numRounds = parseInt(numRounds);
    if (roundTimer === '') roundTimer = DEFAULT_ROUND_TIMER;
    else roundTimer = parseInt(roundTimer);

    let currentRoomSize = getRoomSize(lobbyId);

    if (currentRoomSize < MIN_PLAYERS) {
      socket.emit('tooFewPlayers');
      return;
    } else if (parseInt(numRounds) == 0) {
      socket.emit('zeroValue');
      return;
    } else if (parseInt(roundTimer) == 0) {
      socket.emit('zeroValue');
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

  socket.on('scoreBoardCanvas', function (drawingEvents, drawNum) {
    let lobbyId = socket.lobbyId;
    io.sockets.in(lobbyId).emit('scoreBoardCanvas', drawingEvents, drawNum);
  });


  socket.on('playerGuess', function (playerGuess) {
    console.log('PlayerGuess function is being called!');
    if (playerGuess.length === 0) return;

    let lobbyId = socket.lobbyId;
    let ld = lib.getLDistance(playerGuess, lobbies[lobbyId].state.roundInfo.compound.word);
    if (ld === 0) {
      if (!lobbies[lobbyId].state.players[socket.id].doneGuessing) {
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
      }
      updateGuessed(lobbyId, socket);
      if (allGuessed(lobbyId)) {
        clearInterval(lobbies[lobbyId].state.timer.id);
        endOfRound(lobbyId);
      }
    } else if (ld <= 2) {
      socket.emit('closeGuess');
      io.sockets.in(lobbyId).emit('broadcastClose', lobbies[lobbyId].users[socket.id]);
    } else {
      io.sockets.in(lobbyId)
        .emit('wrongGuess', playerGuess, socket.id, lobbies[lobbyId].users[socket.id]);
    }
  });

  function updateGuessed(lobbyId, socketObj) {
    //TO DO: ALSO UPDATE 
    socketObj.emit('correctGuess', lobbies[lobbyId].state.roundInfo.compound.word, createScoreObject(lobbyId), lobbies[lobbyId].users[socketObj.id]); //The view can update to make it clear they guessed
    io.sockets.in(lobbyId).emit('someoneGuessed', createScoreObject(lobbyId), socketObj.id, lobbies[lobbyId].users[socketObj.id]);
    // for (var i =1; i<lobbies[lobbyId].state.roundInfo.drawers.length+1; i++){
    //   io.sockets.in(lobbies[lobbyId].state.roundInfo.drawers.drawer+'i').emit('updateScore',createScoreObject(lobbyId),lobbies[lobbyId].users[socketObj.id]);
    // }
    // for (var i =1; i<lobbies[lobbyId].state.roundInfo.guessers.length+1; i++){
    //   io.sockets.in(lobbies[lobbyId].state.roundInfo.guessers.guesser+'i').emit('updateScore2',createScoreObject(lobbyId),lobbies[lobbyId].users[socketObj.id]);
    // }
    io.sockets.in(lobbies[lobbyId].state.roundInfo.drawers.drawer1).emit('updateScore', createScoreObject(lobbyId), lobbies[lobbyId].users[socketObj.id]);
    io.sockets.in(lobbies[lobbyId].state.roundInfo.drawers.drawer2).emit('updateScore', createScoreObject(lobbyId), lobbies[lobbyId].users[socketObj.id]);

  };

  function endOfRound(lobbyId) {
    if (lobbies[lobbyId].state.roundInfo.round + 1 >= lobbies[lobbyId].state.rules.numRounds) {
      endOfGame(lobbyId);
    } else {
      console.log('End of the round! Displaying scores now'); //TODO: TEMP
      console.log(`Next round will start in ${SCORE_DISPLAY_TIMER} seconds`); //TODO: TEMP
      io.sockets.in(lobbyId)
        .emit('endRoundScores', createScoreObject(lobbyId), lobbies[lobbyId].state.roundInfo.compound.word);
      //.emit('endRoundScores', createScoreBoard(lobbyId));

      lobbies[lobbyId].state.timer.scoreScreenId = setTimeout(() => advanceRoundAndStart(lobbyId), SCORE_DISPLAY_TIMER * 1000);
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
    lobbies[lobbyId].state.timer.scoreScreenId = null;
    lobbies[lobbyId].state.roundInfo.round += 1;
    lib.setUpRound(lobbies[lobbyId].state, lobbies[lobbyId].state.roundInfo.round);

    startRound(lobbyId);
  }

  function startRound(lobbyId) {
    lobbies[lobbyId].state.timer.timeLeft = lobbies[lobbyId].state.rules.roundTimer;

    notifyDrawers(lobbyId);
    notifyGuessers(lobbyId);
    startGameTimer(lobbyId);
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
    io.sockets.in(lobbyId).emit('gameOverEvent', createScoreObject(lobbyId), lobbies[lobbyId].state.roundInfo.compound.word);
  };

  function startGameTimer(lobbyId) {
    lobbies[lobbyId].state.timer.id = setInterval(() => countdown(lobbyId), 1000);
  };

  socket.on('disconnect', function () {
    console.log('A user disconnected');

    if (socket.lobbyId) {
      let curLobbyId = socket.lobbyId;
      let shouldEndRound = false;
      let shouldEndGame = false;

      if (Object.keys(lobbies[curLobbyId].state).length !== 0) {
        io.sockets.in(curLobbyId).emit('playerDisconnect', getUsername(socket));

        const numRoundsLeft = lobbies[curLobbyId].state.rules.numRounds - lobbies[curLobbyId].state.roundInfo.round - 1;

        lobbies[curLobbyId].state.meta.drawPairs = lib.getDrawPairs(
          lib.getGameWords(numRoundsLeft),
          Object.keys(lobbies[curLobbyId].users).filter(id => id != socket.id)
        );

        lobbies[curLobbyId].state.meta.numPlayers--;
        if (lobbies[curLobbyId].state.meta.numPlayers < 3) shouldEndGame = true;

        delete lobbies[curLobbyId].state.players[socket.id];

        if (
          (
            socket.id == lobbies[curLobbyId].state.roundInfo.drawers.drawer1 ||
            socket.id == lobbies[curLobbyId].state.roundInfo.drawers.drawer2
          ) &&
          lobbies[curLobbyId].state.timer.scoreScreenId === null
        ) {
          shouldEndRound = true;
          removeUserFromLobby(socket);
        }
      } else {
        removeUserFromLobby(socket);
        io.in(curLobbyId).emit('broadcastLeft', lobbies[curLobbyId].users);
      }



      if (shouldEndGame) {
        clearInterval(lobbies[curLobbyId].state.timer.id);
        clearTimeout(lobbies[curLobbyId].state.timer.scoreScreenId);
        endOfGame(curLobbyId);
      } else if (shouldEndRound) {
        clearInterval(lobbies[curLobbyId].state.timer.id);
        endOfRound(curLobbyId);

      }
    }

  });
});
/** ~~~~~~~~~~~~~~~~~~~~~~~~~~~ SocketIO END ~~~~~~~~~~~~~~~~~~~~~~~~~~~  **/


/*
http.listen(5000, function () {
  console.log('listening on *:5000');
});
*/


const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
