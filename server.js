var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var express = require('express');
var appHandler = require("./js/appHandler");
var cfEnv = require("cf-env");
var fs = require("fs");
var bcrypt = require('bcrypt');
var Base64Decode = require('base64-stream').decode;
var userList = {};
var cfenv = require('cfenv');
var redis = require('redis');
var appenv = cfenv.getAppEnv();

//---------------------------Tone Analyzer---------------------------

//----------------------------Watson developer cloud + visual recognition---------------
var watson = require('watson-developer-cloud');
var visual_recognition = watson.visual_recognition({
  api_key: '8f2100a69fea9d4b534df0e9c7302fc2976289a9',
  version: 'v3',
  version_date: '2016-05-20'
});
var toneModule = require("./js/ToneAnalyzer");
let bodyParser = require('body-parser');
let ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
let toneAnalyzer = new ToneAnalyzerV3({
  version_date: '2017-09-21',
});



//-----------------Mongo DB connection and options using a server certificate------------
var MONGODB_URL = "mongodb://admin:MGDNKSWIXONYFNMS@sl-eu-fra-2-portal.1.dblayer.com:17425,sl-eu-fra-2-portal.0.dblayer.com:17425/compose?authSource=admin&ssl=true";
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var myDB;
var ca = [fs.readFileSync(__dirname + "/servercert.crt")];
var options = {
    mongos: {
        ssl: true,
        sslValidate: true,
        sslCA:ca,
    }
}

MongoClient.connect(MONGODB_URL, options, function(err, db) {
    assert.equal(null, err);
    myDB = db;
    //myDB.collection("users").remove();
});



// Configure Redis client connection

var credentials;
var redisClient;
// Check if we are in Bluemix or localhost
if(process.env.VCAP_SERVICES) {
  console.log("------------On bluemix-------------------");
  var services = appenv.services;
  var redis_services = services["compose-for-redis"];
  credentials = redis_services[0].credentials;
  console.log("redis credentials -----------"+JSON.stringify(credentials));
  redisClient = redis.createClient(credentials.uri);
} else {
  // On localhost just hardcode the connection details
  console.log("----------------------on localhost--------------------");
  credentials = { "host": "127.0.0.1", "port": 6379 };
  redisClient = redis.createClient(credentials.port, credentials.host);
}




//----------------------------express-https-redirect---------------------------------
var httpsRedirect = require('express-https-redirect'); //redirecting from http to https
//----------------------------Tone Analyzer------------------------------------------


app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/', express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use('/', httpsRedirect());

app.post('/tone', (req, res, next) => {
    let toneRequest = toneModule.createToneRequest(req.body);

    if (toneRequest) {
      toneAnalyzer.tone_chat(toneRequest, (err, response) => {
        if (err) {
          return next(err);
        }
        let answer = {mood: toneModule.happyOrUnhappy(response)};
        return res.json(answer);
      });
    }
    else {
      return res.status(400).send({error: 'Invalid Input'});
    }
  });





app.get('/', function(req, res){ 
  /*redisClient.get("online_users", function(err, reply) {
    if(!err) { 
    console.log("reply online users : "+reply);  
       res.send(reply);
    }
  });*/
  res.sendFile(__dirname + '/client.html');
});

app.get("/redisMessages", function(req, res){
   // Get the 100 most recent messages from Redis
  redisClient.lrange("messages", 0, 99, function(err, reply) {
    if(!err) { 
    //console.log("----------redis key messages : "+JSON.stringify(reply));       
      var result = [];
      // Loop through the list, parsing each item into an object
      for(var msg in reply) 
        result.push(JSON.parse(reply[msg]));
       
       res.send(result);
    }
  });
})

app.get("/redisUsers", function(req, res){
   // Get the 100 most recent messages from Redis
  redisClient.lrange("users", 0, 99, function(err, reply) {
    if(!err) { 
    //console.log("----------redis  users : "+JSON.stringify(reply));       
      var result = [];
      // Loop through the list, parsing each item into an object
      for(var msg in reply) 
        result.push(JSON.parse(reply[msg]));
       
       res.send(result);
    }
  });
})

app.get("/redisOnlineUsers", function(req, res){
   // Get the 100 most recent messages from Redis
  redisClient.get("online_users", function(err, reply) {
    if(!err) { 
    console.log("reply online users new: "+reply);  
       res.send(reply);
    }
  });
})


let port = process.env.PORT || process.env.VCAP_APP_PORT || 8080;

server.listen(port, function(){
  console.log('listening on *: '+port);
});



io.on('connection', function(socket){

  socket.emit("redis", "");
  
  saveCredentials(socket);

  login(socket, io);

  socket.on("typing", function(data){
    socket.broadcast.emit("typing", data);
  });

  dispatchChatMessages(socket, io);

 // appHandler.disconnect(socket, io);
 socket.on("disconnect", function(){
     // if(!socket.username) return;
     // delete userList[socket.username];
     // updateUserlist(io);
      //io.emit("disconnected_user", "socket.username");
    });


});

function updateUserlist(io){
    io.emit("user list", Object.keys(userList));
}


 function dispatchChatMessages(socket, io){
  socket.on('chat message', function(data, callback){
    var msg = data.message.trim();
   // console.log(" chat data : "+JSON.stringify(data));
    //Redis pushing message
    
    if(msg.substr(0, 3) === "/w "){
      msg = msg.substr(3);
      var index = msg.indexOf(" ");
      if(index != -1){
        var name = msg.substr(0, index);
        msg = msg.substr(index+1);
        if(name in userList){
          if(data.hasFile){
            var messageToStoreInRedis = {
              message: msg,
              time: data.time,
              multimedia: data.file,
              hasFile: data.hasFile,
              isPrivate: true,
              username: data.username,
              mood: data.mood
            };
           userList[name].emit('private_msg_with_file', {message:msg, username: socket.username+" ---> "+name, time: data.time, multimedia: data.file, mood: data.mood});
           userList[socket.username].emit('private_msg_with_file', {msg:msg, username: socket.username+" ---> "+name, timestamp: data.time, multimedia: data.file, mood: data.mood});
           redisClient.lpush('messages', JSON.stringify(messageToStoreInRedis));
           redisClient.ltrim('messages', 0, 99);
          }
          else{
            var messageToStoreInRedis = {
              message: msg,
              time: data.time,
              hasFile: data.hasFile,
              isPrivate: true,
              username: data.username,
              mood: data.mood
            };
            userList[name].emit('private_msg', {message:msg, username: socket.username+" ---> "+name, time: data.time, mood: data.mood});
            userList[socket.username].emit('private_msg', {message:msg, username: socket.username+" ---> "+name, time: data.time, mood: data.mood});
            redisClient.lpush('messages', JSON.stringify(messageToStoreInRedis));
            redisClient.ltrim('messages', 0, 99);
          }

        }
        else{
          callback("Error. Please enter a valid chat name");
        }
        
      }
      else{
        callback("Error. Please enter a message")
      }
      
    }
    else{

      if(data.hasFile){
        var messageToStoreInRedis = {
              message: msg,
              time: data.time,
              multimedia: data.file,
              hasFile: data.hasFile,
              isPrivate: false,
              username: data.username,
              mood: data.mood
        };
        io.emit('add_chat_msg_to_list_with_file', {message:msg, username: socket.username, time: data.time, multimedia: data.file, mood: data.mood});
        redisClient.lpush('messages', JSON.stringify(messageToStoreInRedis));
        redisClient.ltrim('messages', 0, 99);
      }
      else{
        var messageToStoreInRedis = {
              message: msg,
              time: data.time,
              hasFile: data.hasFile,
              isPrivate: false,
              username: data.username,
              mood: data.mood
        };
          io.emit('add_chat_msg_to_list', {message:msg, username: socket.username, time: data.time, mood: data.mood});
          redisClient.lpush('messages', JSON.stringify(messageToStoreInRedis));
          redisClient.ltrim('messages', 0, 99);
      }
    }
    
  });
}


function login (socket, io){
  var user = {};
  socket.on("login", function(data, callback){
    doesUserAlreadyExist(data.name, function(res){
      if(res.exist == true){
          areCredentialsOK(data.name, data.password, function(result){
            if(result == true){
                user = {
                    exist: res.exist,
                    principal: res.user,
                    passwordMatch: result
                };
                socket.username = data.name;
                userList[socket.username] = socket;
                updateUserlist(io);
                socket.broadcast.emit("connected_user", socket.username);
                redisClient.append('online_users', data.name+";");
                doesUserExistInRedis(data.name, function(redisCallback){
                  if(redisCallback != true){
                    console.log("----------------------I can add to redis users");
                    redisClient.lpush('users', JSON.stringify(user));
                    redisClient.ltrim('users', 0, 99); 
                  }
                });
                callback(user);
            }
            else{
              user = {
                  exist: res.exist,
                  passwordMatch: result
              }
            callback(user);
          }
        });
      }
      else{
        user = {
          exist: res.exist
        }
        callback(user);
      }
    });



  });
}


function doesUserAlreadyExist(name, fn){
  var bool; var user = {};

    myDB.collection("users").find({}).toArray(function(err, result){
      if(err)
        console.log("Eroor while retrieving data "+err);
      else{
        for(i=0; i<result.length; i++){
          if(result[i].name == name){
           bool = true; user = result[i];
           break;
         }
         else{
          bool = false; 
        }
      }
      fn({exist: bool, user: user});
    }
      
    });

  
}


function areCredentialsOK(username, password, fn){

        getLoggedUser(username, function(user){
          comparePassword(password, user.password, function(match){
            if(match == true)
              fn(true);
            else
              fn(false);
          });
        });
}

function getLoggedUser(name, callback){
  myDB.collection("users").find({}).toArray(function(err, result){
    if(err)
      console.log("In getLogged user, error occured while getting list of users");
    else
    {
      for(i=0; i<result.length; i++){
        if(result[i].name === name)
          return callback(result[i]);
      }
      return callback(null);
    }

  });
}

function comparePassword(plainPassword, dbPassword, fn){
  bcrypt.compare(plainPassword, dbPassword, function(err, res) {
             if(err)
              console.log("Erroe while comparing passwords");
            else
            {
              if(res == true)
                fn(true);
              else
              {
                fn(false);
              }
            }  
  });
}


function base64_decode(base64str, file) {
    var bitmap = new Buffer(base64str, 'base64');
    fs.writeFileSync(file, bitmap);
}



 function saveCredentials(socket){
  var returnCallBack = {};
  socket.on("save_credentials_to_db", function(data, callback){
    doesUserAlreadyExist(data.name, function(res){
    if(res.exist == true){
      socket.emit("user_already_in_db", "That user does already exist! Please, log in instead");
    }
    else{
     var dr = data.image.match(/,(.*)$/)[1];
     var image = base64_decode(dr, "photo.jpg");
     var params = {
       images_file: fs.createReadStream("photo.jpg")
     };


    visual_recognition.detectFaces(params,
      function(err, response) {
        if (err)
          console.log("err");
        else{
          if(response.images[0].faces.length != 0){

            hashPassword(data.password, function(hashedPassword){
              data.password = hashedPassword;
              myDB.collection("users").save(data, function(err, res){
                  if(err){
                    returnCallBack = {saveToDB: "no", humanFace: "yes"};
                    callback(returnCallBack);
                  }
                  else{
                   returnCallBack = {saveToDB: "yes", humanFace: "yes"};
                   callback(returnCallBack);
                 }
              });

            });
            
          }
          else{
           returnCallBack = {saveToDB: "no", humanFace: "no"};
           callback(returnCallBack);
         }
       }
     });
  }

  });

});

}

function hashPassword(plainPassword, fn){
  const saltRounds = 10;
  bcrypt.hash(plainPassword, saltRounds, function(err, hash) {
    fn(hash);
  });
}

function doesUserExistInRedis(username, callback){
  redisClient.lrange("users", 0, 99, function(err, reply) {
    if(!err) { 
      var currentUser;
      for(i=0; i<reply.length; i++){
        currentUser = JSON.parse(reply[i]);
        if(currentUser.principal.name == username){
          return callback(true); break;
        }
      }
      return callback(false);
    }
  });
}


