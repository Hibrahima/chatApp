
function readURL(input) {
	if (input.files && input.files[0]) {
		var reader = new FileReader();

		reader.onload = function (e) {
			$('#profil_image')
			.attr('src', e.target.result)
			.width(200)
			.height(220);
		};

		reader.readAsDataURL(input.files[0]);
	}
}

function setCookie(name, value){
	document.cookie = name +" = "+value +'; Path=/;';
}

function getCookieByName(name){
	match = document.cookie.match(new RegExp(name + '=([^;]+)'));
	if (match)
		return match[1];
}

$(function ($) {

	var socket = io();
	var $message = $("#my_msg");
	var $chatMessages = $("#chat_messages");
	var $chatForm = $("#chatForm");
	var $chatContainer = $("#chatContainer");
	var $userContainer = $("#userContainer");
	var $usernameForm = $("#userForm");
	var $usernameLabel = $("#username_label");
	var $privateZone = $("#private_zone"); $privateZone.css('visibility', 'hidden');
	var isFileAttached = false;
	var chatMessage;


	function getTone() {
		fetch("/tone", {
			method: "POST",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'mode': 'cors'
			},
			body: JSON.stringify({
				texts: [$message.val(), ""]
			})
		})
		.then((response) => {
			var contentType = response.headers.get("content-type");
			if(contentType && contentType.includes("application/json")) {
				return response.json();
			}
			throw new TypeError("Oops, we haven't got JSON!");
		})
		.then((response) => { 
			var date = new Date();
			var time = date.getHours()+" : "+date.getMinutes();
			if (response.mood) {
				var username = getCookieByName("username");

				if(isFileAttached){
					var data = $("#file")[0].files[0];
					var reader = new FileReader();
					reader.onload = function(evt){

						socket.emit("chat message", 
							{message : chatMessage, hasFile: isFileAttached, file: evt.target.result, mood: response.mood, time:time, username: username}, function(data){
								$.notify(data, "error");
							});
					};

					reader.readAsDataURL(data);
				}
				else{
					socket.emit("chat message", {message : chatMessage, hasFile: isFileAttached, mood: response.mood, time:time, username: username}, function(data){
						$.notify(data, "error");
					});
				}
			}
		})
	}



	$usernameForm.submit(function(e){
		e.preventDefault();
		
		var username = $("#username").val();
		var password = $("#password").val();
		if(username != "" && password != ""){
			var data = $("#upload_profil_photo")[0].files[0];
			if(data != null){
				var reader = new FileReader();
				reader.onload = function(evt){

					var image = evt.target.result;
					var user = {
						name: username,
						password: password,
						image: image
					};
					
					socket.emit("save_credentials_to_db", user, 
						function(data){
							if(data.humanFace === "yes" && data.saveToDB === "yes"){
								$.notify("Your credentials have been saved successfully. You can log in now", "info");
								$("#username").val("");
								$("#password").val("");
								$("#profil_photo_cadre").empty();
								$("#upload_profil_photo").val("");
							}
							if(data.humanFace === "no")
								$.notify("The profil image you have provided does not contain a human face", "error");
							if(data.saveToDB ==="no")
								$.notify("Error while saving credentials", "error");
						});
				};

				reader.readAsDataURL(data);
			}
			else{
				$.notify("You haven't uploaded your profil image", "info");
			}
		}
		else{
			$.notify("The chat name or password cannot be empty", "info");
		}

		
		
		
	});


	$("#login_form").submit(function(e){
		e.preventDefault();
		var name = $("#login_name").val();
		var password =  $("#login_password").val();
		var credentials = {
			name: name,
			password: password
		};
		socket.emit("login", credentials, function(data){
			//console.log("-----------------login response from server "+JSON.stringify(data));
			if(data.exist == true && data.passwordMatch == true){
				$userContainer.hide();
				$("#login_div").hide();
				$usernameLabel.text(data.principal.name);
				$("#user_img")
				.attr("src", ""+data.principal.image)
				.width(75)
				.height(75)
				.css("border-radius", "50%");
				$chatContainer.show();
				setCookie("username", data.principal.name);
			}
			else
				$.notify("Incorrect username or password. Please, try again")
		});
	});

	socket.on("user_already_in_db", function(data){
		$.notify(data, "info");
	});

///////////////////////////////////////////////////////////////////////////////////////////////////////////

function redisAppend(data){
	//console.log("----------------- messages_from_redis");
	
		$("#login_div").hide();
		$userContainer.hide();
		$usernameLabel.text(username);
			/*$("#user_img")
			.attr("src", ""+userImage)
			.width(75)
			.height(75)
			.css("border-radius", "50%");*/
			$chatContainer.show();
			//console.log(" yes you can");
			$chatMessages.empty();
			for(i=0; i<data.length; i++){
				//console.log("--------------------------JSON object : "+JSON.stringify(data[i]));
				var message = JSON.parse(JSON.stringify(data[i]));
				//console.log("****************message : "+message);
				if(message.isPrivate && message.hasFile == false){
					appendElement($privateZone, message, true);
					$privateZone.css('visibility', 'visible');
				}
				if(message.isPrivate && message.hasFile){
					appendElement($privateZone, message, true);
					attachMutimediaFiles(message.multimedia, $privateZone);
					$privateZone.css('visibility', 'visible');
				}
				if(message.isPrivate == false && message.hasFile == true){
					appendElement($chatMessages, message, false);
					attachMutimediaFiles(message.multimedia, $chatMessages);
					$chatMessages.show();
				}

				if(message.isPrivate == false &&message. hasFile == false){
					appendElement($chatMessages, message, false);
					//console.log("*********************message object "+JSON.stringify(message));
					//attachMutimediaFiles(message.multimedia, $chatMessages);
					$chatMessages.show();
				}
				
			}

			//$chatMessages.show();		
		
	}

	/*socket.on("redis_private_messages_with_file", function(data){
		console.log("----------------- redis_private_messages_with_file");
		redisAppend(data, true, true);

	});

	socket.on("redis_private_messages", function(data){
		console.log("----------------- redis_private_messages");
		redisAppend(data, false, true);

	});

	socket.on("redis_public_messages_with_file", function(data){
		console.log("----------------- redis_public_messages_with_file");
		redisAppend(data, true, false);

	});

	socket.on("redis_public_messages", function(data){
		console.log("----------------- redis_public_messages");
		//data hasfile isPrivate
		redisAppend(data, false, false);

	});*/
	
////////////////////////////////////////////////////////////////////////////////////////////////////////	


$chatForm.submit(function(event){
	event.preventDefault();
	getTone();
	chatMessage = $message.val();

	$message.val("");
});



$("#file").click(function(){
	isFileAttached = true;
});


function attachMutimediaFiles(file, parent){
	var type = file.substr(5, 5);
	if(type === "image"){
		var image = new Image();
		image.src = ""+file;
		parent.append(image);
	}
	else if(type === "audio"){
		var audio = document.createElement("AUDIO");
		audio.setAttribute("src", ""+file);
		audio.setAttribute("controls", "controls");
		var newType = file.substr(5, 9); 
		if (audio.canPlayType(newType).length > 0) {
			parent.append(audio);
		}
		else{
			$.notify("This audio type is not supported yet!", "error");
		}
	}
	else if(type === "video"){
		var video = document.createElement("VIDEO");
		video.setAttribute("src", ""+file);
		video.setAttribute("controls", "controls");
		video.setAttribute("width", "320");
		video.setAttribute("height", "320");
		var newType = file.substr(5, 9); 
		if (video.canPlayType(newType).length > 0) {
			parent.append(video);
		}
		else{
			$.notify("This video type is not supported yet!", "error");
		}

	}
	else{
		$.notify("This type of file is not supported yet!", "error");
	}


	isFileAttached = false;
}

function onlineUsersAppend(data){
	$("#number_online_users").html("<strong> Online Users ("+data.length+")</strong>");
	$("#online_users_ul").empty();
	for(i=0; i<data.length; i++){
		var el = document.createElement("li");
		el.innerHTML=""+data[i];
		el.id = el.textContent;
		el.className = "list-group-item";

		el.onmouseover = function(){
			$(this).css("cursor", "pointer");
		};

		el.onclick = function(event){
			var name = $(event.target).text();
			$message.val("/w "+name+" ");

		}

		$("#online_users_ul").append(el);
	}

}


socket.on("user list", function(data){
	onlineUsersAppend(data);

});



socket.on("connected_user", function(data){
	$.notify(data+" has connected", "info");
});

///////////////////////////////////////////////////////////////////////////////////////
socket.on("redis", function(data){
	//$.notify(data+" has disconnected", "info");
	console.log("------------------------------disconnected_user");
	var username = getCookieByName("username");
	//var userImage = getCookieByName("user_image");
	console.log("cookie user name  : "+username);
	if(username){
		getRedisMessages();
		getRedisUsers();
		getRedisOnlineUsers();
	}
});

function getRedisMessages(){
	$.ajax({
		url: "redisMessages",
		success: function(redisMessages){
			redisAppend(redisMessages);
		},
		error: function(err){
			$.notify("Oups, somethinh went wrong while getting messages frpm redis", "error");
		}
	})
}

function getRedisUsers(){
	$.ajax({
		url: "redisUsers",
		success: function(redisUsers){
			var username = getCookieByName("username");
			for(i=0; i<redisUsers.length; i++){
				var currentUser = JSON.parse(JSON.stringify(redisUsers[i]));
				console.log("-from redis username : "+currentUser.principal.name);
				if(currentUser.principal.name == username){
					$usernameLabel.text(currentUser.principal.name);
					$("#user_img")
					.attr("src", ""+currentUser.principal.image)
					.width(75)
					.height(75)
					.css("border-radius", "50%");
				}
				
			}
		},
		error: function(err){
			$.notify("Oups, somethinh went wrong while getting messages frpm redis", "error");
		}
	})
}


function getRedisOnlineUsers(){
	$.ajax({
		url: "redisOnlineUsers",
		success: function(redisOnlineUsers){
			var tab = redisOnlineUsers.split(";")
			console.log("redisOnlineUsers with ; : "+redisOnlineUsers);
			for(i=0; i<tab.length; i++)
				console.log("redisOnlineUsers :tab "+tab[i]);
			onlineUsersAppend(tab);
		},
		error: function(err){
			$.notify("Oups, somethinh went wrong while getting messages frpm redis", "error");
		}
	})
}
////////////////////////////////////////////////////////////////////////////////////////
function appendElement(parent, data, isPrivate){
	//console.log("------------append msg : "+data.message);
	var text;
	if(isPrivate)
		text = "<strong>"+data.username+" (PM)"+"</strong>"+" : "+data.message;
	else
		text = "<strong>"+data.username+"</strong>"+" : "+data.message;
	var p = document.createElement("p");
	p.innerHTML = text;
	var span = document.createElement("span");
	span.className = "time-right";
	span.innerHTML = data.time;
	var hr = document.createElement("hr");
	var div = document.createElement("div"); div.className = 'newDiv';
	div.append(p); div.append(span); div.append(hr);  

	if(data.mood == "happy")
		div.style.backgroundColor = "green";
	else
		div.style.backgroundColor = "red";
	parent.append(div);  
	$("#feedback").text("");
}

socket.on("add_chat_msg_to_list", function(data){
	appendElement($chatMessages, data, false);
	$chatMessages.show();
});


socket.on("add_chat_msg_to_list_with_file", function(data){
	appendElement($chatMessages, data, false);
	attachMutimediaFiles(data.multimedia, $chatMessages);
	$chatMessages.show();
});


socket.on("private_msg", function(data){
	appendElement($privateZone, data, true);
	$privateZone.css('visibility', 'visible');
});

socket.on("private_msg_with_file", function(data){
	appendElement($privateZone, data, true);
	attachMutimediaFiles(data.multimedia, $privateZone);
	$privateZone.css('visibility', 'visible');
});



$message.keypress(function(){
	socket.emit("typing", $usernameLabel.text());
});


socket.on("typing", function(data){
	$("#feedback").html("<strong>"+data+"</strong> is typing a message...");
});


});

