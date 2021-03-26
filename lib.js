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


/* Export the functions */
module.exports = { getLDistance, readCSV, shuffle, buckets, cloneArray, addArraytoStack, getDrawPairs, getGameWords, checkIfAllDone};