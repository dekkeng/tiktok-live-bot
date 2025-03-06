
// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
let socket = io();
// (A) LOAD FILE SYSTEM MODU
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0; let usernames = {};
let userIds = {};
let gifter_ary = [];
let link_ary = {};
let roomId = '';
let uniqueId = '';
let roomDisplayId = '';
let roomDisplayNickname = '';
let roomStart = '';
let roomEnd = '';
let timeStatInterval = null

let playSounds = 1;
let saveGifts = 1;
let voiceComments = 0;

let battleStats = $('#battleParties')

let ttn = [];

let select2Options = {
	theme: 'bootstrap-5',
	dropdownParent: $('#soundModal')
}

//const tts = new TTS()

const userCog = $('#userCog')
const sounds = new Sounds()

function connect() {
	let uniqueId = window.settings.username || $('#uniqueIdInput').val();


	if(uniqueId !== ''){
		if(!Config.names.includes(uniqueId)){
			socket.emit('addToNames', {
				name : uniqueId
			})
		}
		$('#stateText').text('Connecting...');
		connection.connect(uniqueId, {
			enableExtendedGiftInfo: true
		}).then(state => {
			//$('#stateText').text(`Connected to roomId ${state.roomId}`);
			console.log(' -- state --');
			console.log(state)
			console.log(' -- /state --');
			//<span class="input-group-text" id="stats-viewers">Connected to roomId ${state.roomId}</span>
			roomId = state.roomId
			// for sounds

			display_start = timeConverter(state.roomInfo.create_time)
			$('#HostInfo').html(`
				<div class="row">
					<div class="col-12">
						<div class="fs-4 text-center">
							${state.roomInfo.owner.nickname}							
							เริ่มไลฟ์: ${display_start}
						</div>
					</div>
				</div>`);
			$('#stateText').html('<h4 class="fs-4 text-center">Connected</h4>');
			roomDisplayId = state.roomInfo.owner.display_id;
			roomDisplayNickname = state.roomInfo.owner.nickname;
			roomStart = state.roomInfo.create_time

			document.title = roomDisplayId+' - LIVE BOT';

			let all_fans = state.roomInfo.top_fans
				, total_fans = all_fans.length
				, fan_tr = '';
			if(total_fans > 0){
				for(var i=0;i<total_fans;i++){
					let tick = parseInt(state.roomInfo.top_fans[i].fan_ticket).toLocaleString('en')
					fan_tr += `
					<li id="topGiftersDivider"><hr class="dropdown-divider"></li>
					<li><a class="dropdown-item" href="https://tiktok.com/@${state.roomInfo.top_fans[i].user.display_id}" target="_blank">
						<img alt="top gifters pic" class="h-auto rounded-circle" style="width:45px; max-width:45px;" src="${state.roomInfo.top_fans[i].user.avatar_thumb.url_list[0]}">
						${state.roomInfo.top_fans[i].user.nickname}
						<small>(${tick} points)</small>
					</a></li>`;
					//fan_tr += '<tr><td><a href="'+state.roomInfo.top_fans[i].user.display_id+'"><img src="'+state.roomInfo.top_fans[i].user.avatar_thumb.url_list[0]+'" alt="top gifters pic" class="h-auto rounded-circle" style="width:45px; max-width:45px;"></a></td><td><a href="'+state.roomInfo.top_fans[i].user.display_id+'">'+state.roomInfo.top_fans[i].user.nickname+'</a></td><td>'+state.roomInfo.top_fans[i].fan_ticket+' coins</td></tr>';
				}
				$(fan_tr).insertAfter("#topGiftersDivider")
				//document.getElementById('topGiftersDivider').innerHTML = fan_tr
			}
			// reset stats
			viewerCount = 0;
			likeCount = 0;
			diamondsCount = 0;
			updateRoomStats();

			let g_length = state.availableGifts.length, ii, allGifts = [], html = ''
			, giftDrop = '';
			for(ii=0;ii<g_length;ii++){
				let list = {
					id: state.availableGifts[ii].id,
					diamond_count: state.availableGifts[ii].diamond_count,
					name: state.availableGifts[ii].name,
					describe: state.availableGifts[ii].describe,
					uri: state.availableGifts[ii].icon.uri,
					url: state.availableGifts[ii].icon.url_list[0],
				}
				allGifts.push(list) //state.availableGifts[i]
				giftDrop += `<option value="${list.name}" data-coins="${list.diamond_count}" data-img="${list.url}">${list.name}</option>`
			}
			//console.log(allGifts)
			//var data = $.map(giftDrop, function (obj, two) {
			//	obj.text = obj.text || obj.name; // replace name with the property used for the text
			//	obj.oid = obj.id
			//	obj.id = obj.name
			//	return obj;
			//});
			function select2Gifts(state){
				if (!state.id) {
					return state.text;
				}
				//console.log('-- select2 gifts ---')
				//console.log(state)
				//console.log('-- /select2 gifts ---')
				// <img src="sounds/${state.element.value}" class="img-flag" />
				const coins = state.element.dataset.coins
				const img = state.element.dataset.img
				var $state = $(`<span><img src="${img}" alt=" "> ${state.text} <span>${coins} coins</span></span>`);
				return $state;
			}
			$('#group-gift').html(giftDrop).trigger('change')/*select2({
				//data : data,
				templateResult: select2Gifts,
				templateSelection: select2Gifts
			}).*/
			$('#save-gift-sound').attr('disabled', false)
			//sendToDb('gifts', 'check', allGifts)

			if(roomDisplayId in usernames){} else {
				usernames[roomDisplayId] = {
					userId : state.roomInfo.owner.id_str,
					uniqueId : roomDisplayId,
					nickname : roomDisplayNickname,
					profilePictureUrl : state.roomInfo.owner.profilePictureUrl
				}
				userIds[state.roomInfo.owner.id_str] = {
					userId : state.roomInfo.owner.id_str,
					uniqueId : roomDisplayId,
					nickname : roomDisplayNickname,
					profilePictureUrl : state.roomInfo.owner.profilePictureUrl
				}
			}

			timeStatInterval = setInterval(() => {
				updateLiveTime()
			}, 1000);

			// the scores when connected
			//? state.link_mic.battle_scores
				/*[
						{
							"score": 15193,
							"user_id": 7028441764432709000
						},
						{
							"score": 111,
							"user_id": 6932573195062085000
						}
					],*/
			//? state.link_mic.battle_settings
				/*{
					"battle_id": 7357466536107855000,
					"channel_id": 7357464768338349000,
					"duration": 301,
					"finished": 0,
					"match_type": 0,
					"start_time": 1713043672,
					"start_time_ms": 1713043672732,
					"theme": ""
				},*/
			//? state.link_mic.rival_anchor_id": 6932573195062085000,
		}).catch(errorMessage => {
			$('#stateText').text("อย่า Connect บ่อยเกิน กำลังลองอีกครั้งใน 5 นาที ["+errorMessage+"]");

			// schedule next try if obs username set
			if (window.settings.username) {
				setTimeout(() => {
					connect(window.settings.username);
				}, 300000);
			}
		})
	} else {
		alert('no username entered');
	}
}

// These settings are defined by obs.html
if (!window.settings) window.settings = {
	username: 'ploy.lin'
};


Config.updateConfig();

$(document).ready(() => {
	$('#connectButton').click(connect);
	$('#uniqueIdInput').on('keyup', function (e) {
		if (e.key === 'Enter') {
			connect();
		}
	});

	setTimeout(() => {
		window.settings.username = document.getElementById('uniqueIdInput').value || "ploy.lin";
		connect();
	}, 1000);

	let pops = {
			sanitize: false,
			html: true,
			trigger: 'focus'
		};
	let chatcont = $('#chatcontainer')
	$('#add-row').on('click', () => {
		let row = $('#the-row').html()
		chatcont.prepend(row)
		chatcont.find('li[data-bs-toggle="popover"]:first').popover(pops)
	})
	$('[data-bs-toggle="popover"]').popover(pops);
})

// viewer stats
connection.on('roomUser', (msg) => {
	//console.log('-- roomUser --')
	//console.log(msg)
	//console.log('-- roomUser --')
	if (typeof msg.viewerCount === 'number') {
		viewerCount = msg.viewerCount;
		updateRoomStats();
		updateTopGifters(msg.topViewers);
	}
})

// like stats
connection.on('like', (msg) => {
	//console.log('-- likes --')
	//console.log(msg)
	//console.log('-- /likes --')
	if (typeof msg.totalLikeCount === 'number') {
		likeCount = msg.totalLikeCount;
		updateRoomStats();
	}

	if (window.settings.showLikes === "0") return;

	if (typeof msg.likeCount === 'number') {
		var uname = msg.uniqueId;
		if(uname in link_ary){
			link_ary[uname] = link_ary[uname]+1
		} else {
			link_ary[uname] = 1
		}

		let tlike = $('#likestotalcontainer,#alltotalcontainer')
		$(`[data-uname="${msg.uniqueId}"]`).remove()
		let thename = generateUsernameLink(msg)
		tlike.prepend(`
		<li data-uname="${msg.uniqueId}" class="list-group-item list-group-item-action px-1 pt-2 pb-1">
			<div class="row g-1 d-table">
				<div class="col-2 col-sm-1 d-table-cell align-top">
					<img class="w-100 h-auto rounded-circle" src="${msg.profilePictureUrl}">
				</div>
				<div class="col-10 col-sm-11 d-table-cell align-middle">
					<span>
						<b>${thename}:</b>
						<span style="color:#447dd4"> sent ${link_ary[uname]} likes</span>
					</span>
				</div>
			</div>
		</li>`)
		if(msg.uniqueId in usernames){} else {
			//let tempuname = {};
			usernames[msg.uniqueId] = {
				userId : msg.userId,
				uniqueId : msg.uniqueId,
				nickname : msg.nickname,
				profilePictureUrl : msg.profilePictureUrl
			}
			userIds[msg.userId] = {
				userId : msg.userId,
				uniqueId : msg.uniqueId,
				nickname : msg.nickname,
				profilePictureUrl : msg.profilePictureUrl
			}
		}
	}
})

// Member join
let joinMsgDelay = 0;
connection.on('member', (msg) => {
	//console.log('-- member --')
	//console.log(msg)
	//console.log('-- member --')
	if (window.settings.showJoins === "0") return;

	let addDelay = 250;
	if (joinMsgDelay > 500) addDelay = 100;
	if (joinMsgDelay > 1000) addDelay = 0;

	joinMsgDelay += addDelay;

	setTimeout(() => {
		joinMsgDelay -= addDelay;
		addChatItem('#21b2c2', msg, msg.label.replace('{0:user}', ''), '#joinstotalcontainer,#alltotalcontainer'); //.joincontainer');
	}, joinMsgDelay);
	//
	sendToDb('member', 'join', {
		userId:	 msg.userId,
		uniqueId:   msg.uniqueId,
		nickname:   msg.nickname,
		timestamp:  msg.createTime,
		profilePictureUrl: msg.profilePictureUrl,
		displayType: msg.displayType
	})
	if(msg.uniqueId in usernames){} else {
		//let tempuname = {};
		usernames[msg.uniqueId] = {
			userId : msg.userId,
			uniqueId : msg.uniqueId,
			nickname : msg.nickname,
			profilePictureUrl : msg.profilePictureUrl
		}
		userIds[msg.userId] = {
			userId : msg.userId,
			uniqueId : msg.uniqueId,
			nickname : msg.nickname,
			profilePictureUrl : msg.profilePictureUrl
		}
	}
})

// New chat comment received
connection.on('chat', (msg) => {
	console.log('-- chat --')
	console.log(msg)
	console.log('-- chat --')
	if (window.settings.showChats === "0") return;

	//let msgcom = msg.hasOwnProperty('subemotes') ? insertEmotes(sanitize(msg.comment), msg.subemotes) : sanitize(msg.comment);
	let msgcom = insertEmotes(sanitize(msg.comment), msg.emotes);
	addChatItem('', msg, msgcom, '.chatcontainer');
})

// New gift received
connection.on('gift', (data) => {
  //if(data.giftName == 'Gift Box'){
	console.log('-- gift --')
	console.log(data)
	console.log('-- gift --')
  //}
	if (!isPendingStreak(data) && data.diamondCount > 0) {
		diamondsCount += (data.diamondCount * data.repeatCount);
		updateRoomStats();
	}

	if (window.settings.showGifts === "0") return;

	addGiftItem(data);
})

connection.on('follow', (data) => {
	addFollowItem(data);
})


// share, follow
connection.on('social', (data) => {
	//console.log('-- social --')
	//console.log(data)
	//console.log('-- social --')
	if (window.settings.showFollows === "0") return;

	let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
	let conta = data.displayType.includes('follow') ? '#followstotalcontainer,#alltotalcontainer' : '#sharestotalcontainer,#alltotalcontainer';
	addChatItem(color, data, data.label.replace('{0:user}', ''), conta); //'.sharecontainer');

})

connection.on('questionNew', (data) => {
	console.log('--- questionNew')
	console.log(data)
	console.log('--- questionNew')
})
connection.on('linkMicBattle', (data) => {
	//console.log('---- linkMicBattle')
	//console.log(data)
	//console.log('---- linkMicBattle')
	let peopleSpan = 6
	if(data.battleUsers.length == 4){
		peopleSpan = 3
	}
	let i, str = `<div class="row">`;
	for(i=0;i<data.battleUsers.length;i++){
		str += '<div class="col-'+peopleSpan+' text-center"><a href="https://www.tiktok.com/@'+data.battleUsers[i].uniqueId+'" target="_blank">'
		+data.battleUsers[i].nickname+'<br>'
		+'<img src="'+data.battleUsers[i].profilePictureUrl+'" class="rounded-circle" style="max-height:75px; width:auto;">'
		+'<br>@'+data.battleUsers[i].uniqueId+'</a><br>'
		+'<div id="battle-'+data.battleUsers[i].userId+'"></div></div>'
	}
	str += `</div>
	<div class="w-100 progress mt-2" role="progressbar" aria-label="Time Left in Battle" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100" style="height: 20px">
		<div id="battle-bar" class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%;"></div>
		<div id="battle-time" class="px-2 ms-auto text-end fw-bolder bg-primary fs-6">5:00</div>
	</div>`
	//console.log(str)
	$('#battleParties').html(str)
	updateCountDown(299)
	console.log('inserted battle stuff..')
})

connection.on('linkMicArmies', (data) => {
	//console.log('linkMicArmies')
	//console.log(data)
	//console.log('/linkMicArmies')
	let i;
	//$('#battleStats').removeClass('d-none')
	for(i=0;i<data.battleArmies.length;i++){
		let i2, helpers = '', help_len = data.battleArmies[i].participants.length, giftersHere
		for(i2=0;i2<help_len;i2++){
			if(helpers != '') helpers += '<br>'
			helpers += data.battleArmies[i].participants[i2].nickname
		}
		giftersHere = helpers == '' ? '' : '<p class="fs-6 bg-body-tertiary p-2 m-0">'+helpers+'</p>'
		$('#battle-'+data.battleArmies[i].hostUserId).html('<big class="badge text-bg-primary">'+data.battleArmies[i].points+'</big>'+giftersHere)
		//$(helpers)('#battle-'+data.battleArmies[i].hostUserId)
	}
	//console.log('inserted info')
})
connection.on('liveIntro', (data) => {
	console.log('liveIntro')
	console.log(data)
	console.log('/liveIntro')

	addChatItem('#ff00cc', data, data.description, '.chatcontainer');

	if(data.uniqueId in usernames){} else {
		usernames[data.uniqueId] = {
			userId : data.userId,
			uniqueId : data.uniqueId,
			nickname : data.nickname,
			profilePictureUrl : data.profilePictureUrl
		}
		userIds[data.userId] = {
			userId : data.userId,
			uniqueId : data.uniqueId,
			nickname : data.nickname,
			profilePictureUrl : data.profilePictureUrl
		}
	}
})

connection.on('envelope', (data) => {
	console.log('envelope')
	console.log(data)
	sounds.addSound(Config["sounds"]["gift"]['treasure'])
	console.log('/envelope')
})
connection.on('subscribe', (data) => {
	console.log('subscribe')
	console.log(data)
	console.log('/subscribe')
})

connection.on('streamEnd', (actionId) => {
	let msg = 'Stream Ended';
	if (actionId === 3) {
		msg = 'Stream ended by user';
	}
	if (actionId === 4) {
		msg = 'Stream ended by platform moderator (ban)';
	}

	var today = new Date();
	var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
	var time = today.getHours() + ":" + today.getMinutes(); // + ":" + today.getSeconds();
	var dateTime = date+' '+time;
	//document.getElementById('dt').innerHTML = dateTime
	$('#stateText').html(msg+'<br>Ended At: '+dateTime);

	// schedule next try if obs username set
	if (window.settings.username) {
		clearInterval(timeStatInterval)
		timeStatInterval = null;
		setTimeout(() => {
			connect(window.settings.username);
		}, 30000);
	}
})

window.addEventListener("beforeunload", function (e) {
	e.preventDefault();
	e.returnValue = ""
});