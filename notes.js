/*** How we track the data ***/

lobbies = {
  lobbyId1: {
    users: {
      socketId1: 'username1',
      socketId2: 'username2',
      //...
    },
    state: {
      players: {
        socketId1: {
          score: 50,
          gained: 0,
          doneGuessing: true, //Drawers start with doneGuessing = true
        },
        socketId2: {
          score: 50,
          gained: 0,
          doneGuessing: false,
        },
        //...
      },
      rules: {
        numRounds: 8,
        roundTimer: 45, //seconds
      },
      meta: {
        drawPairs: [
          {
            drawer1: socketId1,
            drawer2: socketId2,
            compound: { word: 'firetruck', left: 'fire', right: 'truck' }
          },
          {
            drawer1: socketId3,
            drawer2: socketId4,
            compound: { word: 'racecar', left: 'race', right: 'car' }
          },
          //...
        ], //length = numRounds
        numPlayers: 5,
      },
      timer: {
        id: null, //id of interval
        timeLeft: 0,
        scoreScreenId: null, //id of score screen timer
      },
      roundInfo: {
        round: 0,
        guessCount: 0,
        compound: { word: 'firetruck', left: 'fire', right: 'truck' },
        drawers: { drawer1: 'socketId1', drawer2: 'socketId2' },
        guessers: ['socketId3', 'socketId4', 'socketId5'],
      }
    }
  },
  lobbyId2: {
    //...
  },
  //...
}



/** Score object created by createScoreObject **/
scores = {
  socketId1: {
    username: 'username1',
    score: 55,
    gained: 8, // number of points gained in the current round, resets each round
    drawer: 0, //0 = not drawer, 1 = left drawer, 2 = right drawer
    doneGuessing: true,
  },
  socketId2: {
    username: 'username2',
    score: 37,
    gained: 0, // number of points gained in the current round, resests each round
    drawer: 0, //0 = not drawer, 1 = left drawer, 2 = right drawer
    doneGuessing: false
  },
  //...
}



/*** Notes ***/

/*
 * Players and users are each keyed by socketId's, but keep track of different things
 *  - Users needs to exist before the state has been generated
 *  - We could add to it after the round has started and keep track of everything
 *    in users, but it makes sense to keep game data in the state object I think.
 *
 * Since we have the guesser and drawer arrays, we shouldn't need to keep
 * track of that in players.
 */

