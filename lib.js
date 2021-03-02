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

//test_getLDistance();

/*===============================*/

/* Read CSV file and turn into JSON object */
function readCSV(filePath){
    var fs = require('fs');

    var data = fs.readFileSync(filePath)
        .toString()
        .split('\n')
        .map(e => e.trim())
        .map(e => e.split(',').map(e => e.trim()));
    return data;
}


function test_readCSV(){
    var a = readCSV('compounds.csv');
    console.log(a);
}

//test_readCSV();
/*===============================*/


/* Export the functions */
module.exports = { getLDistance, readCSV, shuffle, buckets};