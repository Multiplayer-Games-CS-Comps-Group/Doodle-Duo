"use strict";

const levenshtein = require('js-levenshtein');
const pluralize = require('pluralize');
const shuffle = require('shuffle-array');
const buckets = require('buckets-js');
const fs = require('fs');

/* Levenshtein function to check guess to answer */
/* Returns the distance difference between guess and target*/
function getLDistance(guess, target) {
  guess = guess.toLowerCase();
  target = target.toLowerCase();
  let ld = levenshtein(guess, target);
  if (ld === 0) return 0;
  else {
    let newLD = levenshtein(pluralize(guess), pluralize(target));
    return newLD;
  }
}


/* Read CSV file and turn into JSON object */
function readCSV(filePath) {
  let data = fs.readFileSync(filePath)
    .toString()
    .split('\n')
    .map(e => e.trim())
    .map(e => e.split(',').map(e => e.trim()));
  
  var out = [];
  for(var i in data) {
    var compound = {
      word: data[i][0],
      left: data[i][1],
      right: data[i][2]
    }
    out.push(compound);
  }
  return out;
}


/* General math/data structure functions */
function cloneArray(source, dest) {
  for (let i = 0; i < source.length; i++) {
    dest[i] = source[i];
  }
  return 1;
}

function addArraytoStack(array, stack) {
  for (let i = 0; i < array.length; i++) {
    stack.add(array[i]);
  }
  return 1;
}

/* ================================== */
/* Game initialization functions */

function getGameWords(numRounds) {
  let databaseWords = readCSV('database.csv');
  let out = [];
  for (let i = 0; i < numRounds; i++) {
    let randomWord = databaseWords[Math.floor(Math.random() * databaseWords.length)];
    if (out.includes(randomWord) === false) { out.push(randomWord); }
    else {
      while (out.includes(randomWord)) {
        randomWord = databaseWords[Math.floor(Math.random() * databaseWords.length)];
      }
      out.push(randomWord);
    }
  }
  return out;
}


function getDrawPairs(gameWords, players) {
  // Clone player list to pair them
  let playerPool = []
  cloneArray(players, playerPool);
  shuffle(playerPool);
  while (playerPool == players) { //TODO: == doesn't work on arrays
    shuffle(playerPool);
  }

  // Add players to stack
  let pStack = buckets.Stack();
  addArraytoStack(playerPool, pStack);

  // Pop players in pairs, add to current word
  // Array of [word, drawer1, drawer2]
  let otherStack = buckets.Stack();
  let pairs = [];
  for (let i = 0; i < gameWords.length; i++) {
    let currPair = {};
    currPair.compound = gameWords[i];
    if (pStack.size() > 1) {
      otherStack.add(pStack.peek());
      currPair.drawer1 = pStack.pop();
      otherStack.add(pStack.peek());
      currPair.drawer2 = pStack.pop();
    } else {
      if (pStack.size() === 1) {
        currPair.drawer1 = pStack.pop();
        let temp = otherStack.toArray();
        currPair.drawer2 = temp[Math.floor(Math.random() * temp.length)];
      } else {
        shuffle(playerPool);
        while (playerPool === players) { //TODO: == doesn't work on arrays
          shuffle(playerPool);
        }
        addArraytoStack(playerPool, pStack);
        otherStack.clear();
        otherStack.add(pStack.peek());
        currPair.drawer1 = pStack.pop();
        otherStack.add(pStack.peek());
        currPair.drawer2 = pStack.pop();
      }
    }
    pairs.push(currPair);
  }
  return pairs;
}


function checkIfAllDone(playerArray) {
  for (let i = 0; i < playerArray.length; i++) {
    if (playerArray[i].isDone === 0) {
      return false;
    }
  }
  return true;
}


function getAllGuessers(playerArray, drawers) {
  let updatedArray = [];
  for (let i = 0; i < playerArray.length; i++) {
    updatedArray.push(playerArray[i][0]);
  }
  console.log('UPDATED ALL PLAYERS WITH ID ONLY: ' + updatedArray);
  let index = updatedArray.indexOf(drawers[0]);
  if (index > -1) {
    updatedArray.splice(index, 1);
  }
  index = updatedArray.indexOf(drawers[1]);
  if (index > -1) {
    updatedArray.splice(index, 1);
  }
  console.log('FINAL ARRAY: ' + updatedArray);
  return updatedArray
}


function calculateScore(guessCount) {
  var out = 10 - (2*parseInt(guessCount));
  console.log(`Calculate Score: out=${out}, guessCount=${guessCount}`);
  if (out >= 2) { return out; }
  else { return 2; }
}


/*=======================================================================================*/
/* Game Logic Code - Imported due to nodeJS limitations */


/* Creates game instance from lobby information
 *
 * gameInstance object:
 * - players = array of players with [name, playerID, profile picture object]
 * - rules = dictionary with all the rules set by the host
 * - meta = meta data related/useful to the server
 *
 * [
 *   ['webSocketID', 'username', score, doneBool (0 not done, 1 done)]
 *   ['xfdsfh_wqw', 'Alex', 0, 0],
 *   ['fdef0efe', 'Bob' 0, 0]
 * ]
 */
function createGameInstance(userIdList, maxPlayers, numRounds, roundTimer) {
  let players = {};
  for (let userId of userIdList) {
    players[userId] = {
      score: 0,
      doneGuessing: false
    };
  }

  // Get words from CSV file
  let gameWords = getGameWords(numRounds);

  // Assign pair partners to each word ['word', 'Drawer1', 'Drawer2']
  let drawPairs = getDrawPairs(gameWords, userIdList);

  let gameInstance = {
    players,
    rules: {
      maxPlayers,
      numRounds,
      roundTimer,
    },
    meta: {
      drawPairs,
      numPlayers: userIdList.length,
    },
    timer: {
      id: null, //id of interval
      timeLeft: 0,
    },
    roundInfo: {
      round: -1,
      guessCount: 0,
      compound: {
        word: '',
        left: '',
        right: ''
      },
      drawers: [],
      guessers: [],
    }
  }

  return gameInstance;
}

function setUpRound(gameInstance, roundNum) {
  let curDrawPair = gameInstance.meta.drawPairs[roundNum];
  let drawers = {
    drawer1: curDrawPair.drawer1,
    drawer2: curDrawPair.drawer2
  };
  let allPlayers = Object.keys(gameInstance.players);
  console.log(curDrawPair);
  gameInstance.roundInfo = {
    round: roundNum,
    guessCount: 0,
    compound: curDrawPair.compound,
    drawers,
    guessers: allPlayers.filter(id => (id !== drawers.drawer1 && id !== drawers.drawer2)),
  };

  for (let id of allPlayers) {
    gameInstance.players[id].doneGuessing = (id === drawers.drawer1 || id === drawers.drawer2);
    //Reset their gained score for the round
    gameInstance.players[id].gained = 0;
  }
}

function testCreateGameInstance() { //TODO: delete this function
  let newGameInstance = createGameInstance(
    ["p1", "p2", "p3", "p4", "p5"],
    12,
    8,
    40
  );

  console.log("newGameInstance", newGameInstance);
  console.log("newGameInstance.meta.drawPairs", newGameInstance.meta.drawPairs);

  setUpRound(newGameInstance, 0);
  console.log("newGameInstance round 0", newGameInstance);
  console.log("newGameInstance.meta.drawPairs round 0", newGameInstance.meta.drawPairs);
}


/* Export the functions */
module.exports = {
  getLDistance, checkIfAllDone,
  createGameInstance, getAllGuessers, setUpRound,
  calculateScore, getGameWords, getDrawPairs
};

