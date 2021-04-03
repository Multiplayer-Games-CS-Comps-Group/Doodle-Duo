const levenshtein = require('js-levenshtein');
var pluralize = require('pluralize');
var shuffle = require('shuffle-array');
var buckets = require('buckets-js');


/* Levenshtein function to check guess to answer */
/* Correct guess: true, Incorrect: false, Close: -1*/
function getLDistance(guess, target){
    guess = guess.toLowerCase();
    target = target.toLowerCase();
    var ld = levenshtein(guess, target);
    if(ld == 0){return true;}
    else{
        var newLD = levenshtein(pluralize(guess), pluralize(target));
        if(newLD == 0){return true;}
        else if(newLD <= 2){return -1;}
        else{return false;}
    }
}


function test_getLDistance(){
    var guess = 'firETruCks'
    var target = 'firetruck'
    console.log(`Guess: ${guess}, Target: "${target}`)
    console.log(getLDistance(guess, target));
    console.log('---');
    guess = 'cars'
    target = 'firetruck'
    console.log(`Guess: ${guess}, Target: "${target}`)
    console.log(getLDistance(guess, target));
    console.log('---');
    guess = 'cat'
    target = 'bats'
    console.log(`Guess: ${guess}, Target: "${target}`)
    console.log(getLDistance(guess, target));
}

/* Read CSV file and turn into JSON object */
function readCSV(filePath){
    var fs = require('fs');

    var data = fs.readFileSync(filePath)
        .toString()
        .split('\n')
        .map(e => e.trim())
        .map(e => e.split(',').map(e => e.trim()));
    return data[0];
}


function test_readCSV(){
    var a = readCSV('compounds.csv');
    console.log(a);
}


/* General math/data structure functions */
function cloneArray(source, dest){
    for(var i=0;i<source.length;i++){
        dest[i] = source[i];
    }
    return 1;
}

function addArraytoStack(array, stack){
    for(var i=0;i<array.length;i++){
        stack.add(array[i]);
    }
    return 1;
}

/* ================================== */
/* Game initialization functions */

function getGameWords(numRounds){
    var databaseWords = readCSV('database.csv');
    var out = [];
    for(var i=0;i<numRounds;i++){
        var randomWord = databaseWords[Math.floor(Math.random() * databaseWords.length)];
        if(out.includes(randomWord) === false){out.push(randomWord);} 
        else {
            while(out.includes(randomWord)){
                randomWord = databaseWords[Math.floor(Math.random() * databaseWords.length)];
            }
            out.push(randomWord);
        }
    }
    return out;
}


function getDrawPairs(gameWords, players){
    // Clone player list to pair them
    var playerPool = []
    cloneArray(players, playerPool);
    shuffle(playerPool);
    while(playerPool == players){
        shuffle(playerPool);
    }
    
    // Add players to stack
    var pStack = buckets.Stack();
    addArraytoStack(playerPool, pStack);

    // Pop players in pairs, add to current word
    // Array of [word, drawer1, drawer2]
    var otherStack = buckets.Stack();
    var pairs = [];
    for(var i=0;i<gameWords.length;i++){
        currPair = [];
        currPair.push(gameWords[i]);
        if(pStack.size() > 1){
            otherStack.add(pStack.peek());
            currPair.push(pStack.pop());
            otherStack.add(pStack.peek());
            currPair.push(pStack.pop());
            } else{
                if(pStack.size() == 1){
                    currPair.push(pStack.pop());
                    var temp = otherStack.toArray();
                    currPair.push(temp[Math.floor(Math.random() * temp.length)]);
                } else{
                    shuffle(playerPool);
                    while(playerPool == players){
                        shuffle(playerPool);
                    }
                    addArraytoStack(playerPool, pStack);
                    otherStack.clear();
                    otherStack.add(pStack.peek());
                    currPair.push(pStack.pop());
                    otherStack.add(pStack.peek());
                    currPair.push(pStack.pop());
                }
            }
            pairs.push(currPair);
    }
    return pairs;
}


function checkIfAllDone(playerArray){
    for(let i=0;i<playerArray.length;i++){
        if(playerArray[i][3] == 0){
            return false;
        }
    }
    return true;
}



/*=======================================================================================*/
/* Game Logic Code - Imported due to nodeJS limitations */


// Create game instance from lobby information
function createGameInstance(usernames, websocketID, maxplayers, roundnumber,roundTimer, roomId){

    /* gameInstance object:
        players = array of players with [name, playerID, profile picture object]
        rules = dictionary with all the rules set by the host
        meta = meta data related/useful to the server
    */

    /*
    [
        ['webSocketID', 'username', score, doneBool (0 not done, 1 done)]
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
        curr.push(0);
        playerArray.push(curr);
    }


    // Get words from CSV file
    var gameWords = getGameWords(parseInt(roundnumber));

    // Assign pair partners to each word ['word', 'Drawer1', 'Drawer2']
    var drawPairs = getDrawPairs(gameWords, playerArray);

    var gameInstance = {
        players: playerArray,
        rules: {
            maxPlayers: parseInt(maxplayers),
            numRounds:  parseInt(roundnumber),
            roundTimer:  1000 * parseInt(roundTimer) /* parseInt(roundTimer) in milliseconds; 60000 is one minute*/,
        },
        meta: {
            roomID: roomId,
            totalPlayers: playerArray.length,
            drawPairs: drawPairs,
            currRound: 0
        }
    }

    return gameInstance;
}

async function startGameLoop(gameInstance){
    // Easier access for variables in game instance
    var roundTimer = gameInstance.rules.roundTimer;
    var players = gameInstance.players;
    var drawPairs = gameInstance.meta.drawPairs;

    // Set game round to 1
    gameInstance.meta.currRound += 1;

    for(var i=0;i<drawPairs.length;i++){
        var currWord = drawPairs[i][0];
        var drawer1 = drawPairs[i][1];
        var drawer2 = drawPairs[i][2];
        console.log(`${currWord}: ${drawer1[1]}, ${drawer2[1]}`);
        
        for(let i=0; i<players.length;i++){
            if(players[i][0] === drawer1[0] || players[i][0] === drawer2[0]){
                players[i][3] = 1;
                players[i][4] = 1;
            }
            else{
                players[i][3] = 0;
                players[i][4] = 0;
            }
        }
        console.log(players);
        
        var startTime = Date.now();
        while ((Date.now() - startTime) < roundTimer){
            //myTimer();

            // test function that changes the 2 player to be set to 'done/1'
            test(players);


            if(checkIfAllDone(players) == true){
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


function myTimer() {
          var d = new Date();
          var t = d.toLocaleTimeString();
          //console.log(t);
}


function test(test){
    test[1][3] = 1;
}


/* Export the functions */
module.exports = { getLDistance, readCSV, shuffle, buckets, cloneArray, 
    addArraytoStack, getDrawPairs, getGameWords, checkIfAllDone,
    createGameInstance, startGameLoop};

