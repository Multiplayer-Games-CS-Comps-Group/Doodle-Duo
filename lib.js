"use strict";

const levenshtein = require('js-levenshtein');
const pluralize = require('pluralize');
const shuffle = require('shuffle-array');
const buckets = require('buckets-js');
const fs = require('fs');

/* Levenshtein function to check guess to answer */
/* Correct guess: true, Incorrect: false, Close: -1*/
function getLDistance(guess, target) {
  guess = guess.toLowerCase();
  target = target.toLowerCase();
  let ld = levenshtein(guess, target);
  if (ld == 0) {return true;}
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

  var out = []
  for(var i in data[0]){
    var word = data[0][i];
    var spl = word.split(' ');
    var compound = {
      word: spl[0],
      left: spl[1],
      right: spl[2]
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
    currPair.word = gameWords[i];
    if (pStack.size() > 1) {
      otherStack.add(pStack.peek());
      currPair.drawer1 = pStack.pop();
      otherStack.add(pStack.peek());
      currPair.drawer2 = pStack.pop();
    } else {
      if (pStack.size() == 1) {
        currPair.drawer1 = pStack.pop();
        let temp = otherStack.toArray();
        currPair.drawer2 = temp[Math.floor(Math.random() * temp.length)];
      } else {
        shuffle(playerPool);
        while (playerPool == players) { //TODO: == doesn't work on arrays
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

function testGetDrawPairs() { //TODO: delete this function
  console.log(
    getDrawPairs(
      ["word1", "word2", "word3", "word4", "word5", "word6"],
      ["p1", "p2", "p3", "p4", "p5"]
    )
  )
  console.log(
    getDrawPairs(
      ["word1", "word2", "word3", "word4", "word5", "word6"],
      ["p1", "p2", "p3"]
    )
  )
}

function checkIfAllDone(playerArray) {
  for (let i = 0; i < playerArray.length; i++) {
    if (playerArray[i].isDone == 0) {
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
      word: '',
      drawers: [],
      guessers: [],
    }
  }

  return gameInstance;
}

function setUpRound(gameInstance, roundNum) {
  let curDrawPair = gameInstance.meta.drawPairs[roundNum];
  let drawers = [curDrawPair.drawer1, curDrawPair.drawer2];
  let allPlayers = Object.keys(gameInstance.players);
  gameInstance.roundInfo = {
    round: roundNum,
    word: curDrawPair.word,
    drawers,
    guessers: allPlayers.filter(id => !drawers.includes(id)),
  };

  for (let id of allPlayers) {
    gameInstance.players[id].doneGuessing = drawers.includes(id);
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

async function startGameLoop(gameInstance) {
  // Easier access for variables in game instance
  let roundTimer = gameInstance.rules.roundTimer;
  let players = gameInstance.players;
  let drawPairs = gameInstance.meta.drawPairs;

  // Set game round to 1
  gameInstance.meta.currRound += 1;

  for (let i = 0; i < drawPairs.length; i++) {
    let currWord = drawPairs[i][0];
    let drawer1 = drawPairs[i][1];
    //emit event to players who r drawers that they are the drawer
    let drawer2 = drawPairs[i][2];
    console.log(`${currWord}: ${drawer1.userName}, ${drawer2.userName}`);

    for (let i = 0; i < players.length; i++) {
      if (players[i].websocketID === drawer1.websocketID || players[i].websocketID === drawer2.websocketID) {
        players[i].isDone = 1;
        players[i].isDrawer = 1;
      }
      else {
        players[i].isDone = 0;
        players[i].isDrawer = 0;
      }
    }
    console.log(players);

    let startTime = Date.now();
    while ((Date.now() - startTime) < roundTimer) {
      //myTimer();


      // test function that changes the 2 player to be set to 'done/1'
      test(players);


      if (checkIfAllDone(players) == true) {
        console.log('Done with round early');
        break;
      }
    }

    //After everyone guesses, or time runs out
    //Increment game round
    gameInstance.meta.currRound += 1;
    console.log('Current round end!\n\n');
  }
  console.log('GAME DONE');
  return [3, 2, 4, 5, 1, 6, 7];
}


/* Export the functions */
module.exports = {
  getLDistance, readCSV, shuffle, buckets, cloneArray,
  addArraytoStack, getDrawPairs, getGameWords, checkIfAllDone,
  createGameInstance, startGameLoop, getAllGuessers, setUpRound
};


/*
function main(){
  var a = readCSV('database.csv');
  console.log(a);
}

main();
*/