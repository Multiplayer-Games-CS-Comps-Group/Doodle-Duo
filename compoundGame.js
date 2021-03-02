const lib = require("./lib");


/* ================================== */
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
    var databaseWords = lib.readCSV('database.csv');
    var out = [[],[],[]];
    for(var i=0;i<3;i++){
        for(var j=0;j<numRounds/3;j++){
            var randomWord = databaseWords[i][Math.floor(Math.random() * databaseWords.length)];
            if(out[i].includes(randomWord) === false){
                out[i].push(randomWord);
            } else{
                while(out[i].includes(randomWord)){
                    randomWord = databaseWords[i][Math.floor(Math.random() * databaseWords.length)];
                }
                out[i].push(randomWord);
            }
        }
    }
    return out;
}


function getDrawPairs(gameWords, players){

    // Clone player list to pair them
    var playerPool = []
    cloneArray(players, playerPool);
    lib.shuffle(playerPool);
    while(playerPool == players){
        lib.shuffle(playerPool);
    }
    
    // Add players to stack
    var pStack = lib.buckets.Stack();
    addArraytoStack(playerPool, pStack);

    // Pop players in pairs, add to current word
    // Array of [word, drawer1, drawer2]
    var otherStack = lib.buckets.Stack();
    var pairs = [];
    for(var i=0;i<gameWords.length;i++){
        for(var j=0;j<gameWords.length;j++){
            currPair = [];
            currPair.push(gameWords[i][j]);
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
                    lib.shuffle(playerPool);
                    while(playerPool == players){
                        lib.shuffle(playerPool);
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
    }
    return pairs;
}


function myTimer() {
          var d = new Date();
          var t = d.toLocaleTimeString();
          //console.log(t);
}

/* ================================== */
/* Main Game Logic */

function startGameLoop(initData){
    var numRounds = initData.rules.numRounds;
    var roundTimer = initData.rules.roundTimer;
    
    var gameWords = getGameWords(numRounds);
    var players = initData.players;
    var drawPairs = getDrawPairs(gameWords, players);

    console.log(drawPairs);
    for(var i=0;i<drawPairs.length;i++){
        var currWord = drawPairs[i][0];
        var drawer1 = drawPairs[i][1];
        var drawer2 = drawPairs[i][2];
        console.log(`${currWord}: ${drawer1[0]}, ${drawer2[0]}`);
        
        var startTime = Date.now();
        while ((Date.now() - startTime) < roundTimer){
            myTimer();

            //Test function to test exiting the current word early
            //exit function when all players are 'done'
            if(currWord === 'backlog'){
                console.log('Skipping this word');
                break;
            }
        }

        //After everyone guesses, or time runs out

        console.log('Current word done!');
    }
    return [3, 2, 4, 5, 1, 6, 7]
}


// Place-holder function for end game results
// results are in order of 1st-last place
function awards(results){
    console.log('\n\n', results);
    /*
    for(var i=0;i<results.length;i++){
        console.log(results[i]);
    }
    */
}


// Simulate server creating and sending initData to the game logic
function createData(usernames, websocketID, maxplayers, roundnumber,roundTimer){
    // To be implemented later
    var pfpObj = 'profile picture/avatar of player';
    /* initData JSON object:
        players = array of players with [name, playerID, profile picture object]
        rules = dictionary with all the rules set by the host
        other = metadata from server can be passed in this array/dictionary
    */
    var initData = {
        players: [
            ['P1', '010', pfpObj], ['P2', '020', pfpObj], ['P3', '030', pfpObj],
            ['P4', '040', pfpObj], ['P5', '050', pfpObj], ['P6', '060', pfpObj],
            ['P7', '070', pfpObj]
        ],
        rules: {
            maxPlayers: maxplayers,
            numRounds: roundnumber,
            roundTimer:  1 /*in milliseconds; 60000 is one minute*/,
            customWordRound: true,
            pairDrawing: false,
        },
        other: []
    }
    return initData;
}


function main(){
    // Simulate server sending data to game
    var initData = createData();
    var endResults = startGameLoop(initData);
    awards(endResults);
}

main();

module.exports = { createData, startGameLoop };