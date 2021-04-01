const lib = require("./lib");

const { emit } = require('process');
const { callbackify } = require('util');

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/',function(req,res){
    //index.html will have 2 buttons: one for creating a new room that will give a random room number
    //the other button is for people to join the room
    //when clicked onto the button, emits "create" or "join" event and outputs the room number/ outputs joined specific room message
    res.sendfile('index.html');
    //res.sendfile('hostWaitingRoom.html');
});


// var nsp = io.of('/my-namespace');
// nsp.on('connection',function(socket){
//     nsp.emit('hi','Hello everyone!');
// });

const state = {};
const clientRooms = {};
var clients = 0;
var usernames = {};

io.on('connection',function(socket){
    clients++;

    socket.on('createClicked',function(data){
        let genId = function(min,max){ 
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        socket.username = data;
        // add the client's username to the global list
        usernames[socket.username] = data;
        let roomId = genId(10000,99999);
        clientRooms[socket.id]=roomId;
        socket.emit('gameRoomNo', roomId);
        //around the 49 minute mark of https://www.youtube.com/watch?v=ppcBIHv_ZPs&ab_channel=TraversyMedia
        //state[roomId]= createGameState();
        socket.join(roomId);
        socket.number = 1;
        socket.emit('init',1);
    });

    socket.on('joinClicked', function(roomId,username){
        //look into the room object and grab the current players in the room
        // clientRooms[socket.id] = parseInt(roomId);
        // socket.join(parseInt(roomId));
        const room = io.sockets.adapter.rooms[parseInt(roomId)];
       
        //if (room){
        if(io.sockets.adapter.rooms.has(parseInt(roomId)) && (io.sockets.adapter.rooms.get(parseInt(roomId))).size !== 0){
            if ((io.sockets.adapter.rooms.get(parseInt(roomId))).size > 12){
                    socket.emit('tooManyPlayers');
                    return;
                }
            
            clientRooms[socket.id] = parseInt(roomId);
            socket.join(parseInt(roomId));
            if (username === ''){
                socket.username = 'player '+io.sockets.adapter.rooms.get(parseInt(roomId)).size;
            }

            else{
                socket.username = username;
                // add the client's username to the global list
                usernames[username] = username;
            }
            socket.emit('waitingRoomforPlayer',parseInt(roomId));
            socket.in(parseInt(roomId)).emit('broadcastJoined',socket.username);
            //console.log(io.sockets.adapter.rooms);
            console.log(io.sockets.adapter.rooms.get(parseInt(roomId)));
            //allPlayers = room.allSockets();//gives us object of all players, key is client id, object is client itself
        }
        else{
            socket.emit('errorRoomId');
            return;
        }

        // clientRooms[socket.id] = roomId;
        // socket.join(roomId);
        //socket.in('roomid').broadcast('player joined');
        //socket.number = numOfPlayers+1;
        //not sure about the socket.number here whether its supposed to be that or numofPlayers
        socket.emit('init',socket.number);

        startGameInterval(roomId);
    
    });
    
    socket.on('startGame',function(roomId,maxPlayers,roundInput,roundTimer){
        var playersInRoom = io.sockets.adapter.rooms.get(parseInt(roomId));

        //console.log(`roomID: ${roomId}; maxPlayers: ${maxPlayers}; roundInput: ${roundInput}; roundTimer: ${roundTimer}`);
        let gameState = createGameInstance(usernames,playersInRoom,maxPlayers,roundInput, roundTimer, roomId);

        console.log(gameState);
        console.log('=============================');
        //Throw an error
        //JSON.stringify(gameState)
        console.log(gameState.rules.maxPlayers);
        console.log('=============================');

        //Idea: send to a sever wide loop for hosted game instances?


        // ENTER GAME LOOP HERE
        startGameLoop(gameState);
        console.log('SERVER HERE!');

    });

    socket.on('disconnect', function(){
        clients--;
        console.log('A user disconnected');
        // remove the username from global usernames list
        delete usernames[socket.username];
        // update list of users in chat, client-side
        io.sockets.emit('updateusers', usernames);
        // echo globally that this client has left
        socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
    });
});

function startGameInterval(roomId){
    
};

http.listen(5000,function(){
    console.log('listening on *:5000');
});


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

    console.log(roundTimer);

    const tempIterator = websocketID.values();
    
    var playerArray = [];
    for(var i in usernames){
        var curr = [];
        curr.push(tempIterator.next().value);
        curr.push(usernames[i]);
        curr.push(0);
        curr.push(0);
        playerArray.push(curr);
    }

    var gameInstance = {
        players: playerArray,
        rules: {
            maxPlayers: parseInt(maxplayers),
            numRounds:  parseInt(roundnumber),
            roundTimer:  1000 * parseInt(roundTimer) /* parseInt(roundTimer) in milliseconds; 60000 is one minute*/,
        },
        meta: {
            roomID: roomId,
            totalPlayers: playerArray.length
        }
    }

    return gameInstance;
}

function startGameLoop(gameInstance){
    // Easier access for variables in game instance
    var numRounds = gameInstance.rules.numRounds;
    var roundTimer = gameInstance.rules.roundTimer;
    var players = gameInstance.players;

    // Get words from CSV file
    var gameWords = lib.getGameWords(numRounds);

    // Assign pair partners to each word ['word', 'Drawer1', 'Drawer2']
    var drawPairs = lib.getDrawPairs(gameWords, players);
    console.log(drawPairs);

    for(var i=0;i<drawPairs.length;i++){
        var currWord = drawPairs[i][0];
        var drawer1 = drawPairs[i][1];
        var drawer2 = drawPairs[i][2];
        console.log(`${currWord}: ${drawer1[1]}, ${drawer2[1]}`);
        
        for(let i=0; i<players.length;i++){
            if(players[i][0] === drawer1[0] || players[i][0] === drawer2[0]){
                players[i][3] = 1;
            }
            else{
                players[i][3] = 0;
            }
        }
        console.log(players);
        
        var startTime = Date.now();
        while ((Date.now() - startTime) < roundTimer){
            //myTimer();

            // test function that changes the 2 player to be set to 'done/1'
            test(players);


            if(lib.checkIfAllDone(players) == true){
                console.log('Done with round early');
                break;
            }
        }

        //After everyone guesses, or time runs out
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