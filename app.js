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
});

// var nsp = io.of('/my-namespace');
// nsp.on('connection',function(socket){
//     nsp.emit('hi','Hello everyone!');
// });

var clients = 0;
var roomno = 1;
var usernames = {};

io.on('connection',function(socket){
    clients++;
    socket.join("room" + roomno);

    io.sockets.in("room"+roomno).emit('connectToRoom',"you have joined the room.");

    socket.emit('newclientconnect',{description:'Hey, welcome!'});
    socket.broadcast.emit('newclientconnect',{description:clients+' clients connected'})
    console.log('A user connected');

    socket.on('createClicked',function(data){
        console.log("server received");
        var thisGameId = ( Math.random() * 100000 ) | 0;
        io.emit('gameRoomNo', thisGameId);
    });

    // when the client emits 'adduser', this listens and executes
	socket.on('adduser', function(username){
        console.log('adduser emiited');
		// we store the username in the socket session for this client
		socket.username = username;
		// add the client's username to the global list
		usernames[username] = username;
		// echo to client they've connected
		//socket.emit('updatechat', 'SERVER', 'you have connected');
		// echo globally (all clients) that a person has connected
		//socket.broadcast.emit('updatechat', 'SERVER', username + ' has connected');
		// update the list of users in chat, client-side
		io.sockets.emit('updateusers', username);
	});
    

    socket.on('disconnect', function(){
        clients--;
        socket.leave("room"+roomno);
        socket.broadcast.emit('newclientconnect',{description: clients+' clients connected'})
        console.log('A user disconnected');
        // remove the username from global usernames list
		delete usernames[socket.username];
		// update list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
    });
});

http.listen(5000,function(){
    console.log('listening on *:5000');
});