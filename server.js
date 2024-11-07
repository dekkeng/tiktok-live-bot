require('dotenv').config();

// thinking about trying to bring some sort of framework in here..

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');
const { clientBlocked } = require('./limiter');
//const { updateUsernames, readUsernames } = require('./tt-usernames');
// https://www.atatus.com/blog/read-write-a-json-file-with-node-js/
// ^^ Possible alternative use for reading / writing files
const editJsonFile = require("edit-json-file");

//! used for finding files in the sounds folder

//const {fs,writefile} = require('fs');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
app.use(express.urlencoded({ extended: true }));

let file = editJsonFile(`${__dirname}/public/config.json`);
let toDoData = editJsonFile(`${__dirname}/toDoData.json`);

// Enable cross origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});
let isLoggedIn = false, loggedInRow = -1, userRow = {};

io.on('connection', (socket) => {
    let tiktokConnectionWrapper;

    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

    socket.on('setUniqueId', (uniqueId, options) => {

        // Prohibit the client from specifying these options (for security reasons)
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        } else {
            options = {};
        }

        // Session ID in .env file is optional
        if (process.env.SESSIONID) {
            options.sessionId = process.env.SESSIONID;
            console.info('Using SessionId');
        }

        // Check if rate limit exceeded
        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            socket.emit('tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
            return;
        }

        // Connect to the given username (uniqueId)
        try {
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
            tiktokConnectionWrapper.connect();
        } catch (err) {
            socket.emit('tiktokDisconnected', err.toString());
            return;
        }

        // Redirect wrapper control events once
        tiktokConnectionWrapper.once('connected', state => socket.emit('tiktokConnected', state));
        tiktokConnectionWrapper.once('disconnected', reason => socket.emit('tiktokDisconnected', reason));

        // Notify client when stream ends
        tiktokConnectionWrapper.connection.on('streamEnd', () => socket.emit('streamEnd'));

        // Redirect message events
        tiktokConnectionWrapper.connection.on('roomUser', msg => socket.emit('roomUser', msg));
        tiktokConnectionWrapper.connection.on('member', msg => socket.emit('member', msg));
        tiktokConnectionWrapper.connection.on('chat', (msg) => {
            // lets tranalate before it even comes to the front end,
            // instead of sending to front, to back, and again to the front.
            // thats too many, come on now
            socket.emit('chat', msg)
        });
        tiktokConnectionWrapper.connection.on('gift', msg => socket.emit('gift', msg));
        tiktokConnectionWrapper.connection.on('social', msg => socket.emit('social', msg));
        tiktokConnectionWrapper.connection.on('like', msg => socket.emit('like', msg));
        tiktokConnectionWrapper.connection.on('questionNew', (msg) => {
            socket.emit('questionNew', msg);
            toDoData.append('toDoData.questionNew', data)
            toDoData.save();
        })
        tiktokConnectionWrapper.connection.on('linkMicBattle', msg => socket.emit('linkMicBattle', msg));
        tiktokConnectionWrapper.connection.on('linkMicArmies', msg => socket.emit('linkMicArmies', msg));
        tiktokConnectionWrapper.connection.on('liveIntro', msg => socket.emit('liveIntro', msg));
        //tiktokConnectionWrapper.connection.on('emote', msg => socket.emit('emote', msg));
        tiktokConnectionWrapper.connection.on('envelope', (msg) => {
            socket.emit('envelope', msg);
            toDoData.append('toDoData.envelope', msg)
            toDoData.save();
        })
        tiktokConnectionWrapper.connection.on('subscribe', (msg) => {
            socket.emit('subscribe', msg);
            toDoData.append('toDoData.subscribe', msg)
            toDoData.save();
        })
        //tiktokConnectionWrapper.connection.on('rawData',  (messageTypeName, binary) => socket.emit('rawData', messageTypeName));
       //console.log(messageTypeName, binary);
    });


		//socket.on("upload", (file, callback) => {
		//	console.log(file); // <Buffer 25 50 44 ...>
		//	// save the content to the disk, for example
		//	writeFile("sounds/", file, (err) => {
		//		console.log({ message: err ? "failure" : "success" });
		//	});
		//});

    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });

    socket.on('userUpdateSavedHosts', async (data) => {
        if(typeof loggedInRow !== undefined){
            console.log('based on when we logged in')
            console.log('user row = '+loggedInRow)
            console.log(data)
            console.log('/ userUpdateSavedHosts')
        }
    })

    var sounds = fs.readdirSync('public/sounds/');
    socket.emit('soundDirectory', {
        r : 'done',
        files : sounds
    });
    socket.on('saveGiftSound', async (data) => {
        let msg
        if(data.gift == '' || data.sound == ''){
            // error
            msg = 'Gift or Sound not found.'
        } else {
            file.set('sounds.gift.'+data.gift, data.sound)
            file.save();
            msg = 'Sound had been saved for gift - '+data.gift+'.'
        }
        socket.emit('saveGiftSound', {
            r : `<div class="alert alert-secondary mt-3" role="alert">${msg}</div>`
        });
    })
    socket.on('removeGiftSound', async (data) => {
        file.set('sounds.gift.'+data.gift, data.sound)
        file.save();
        msg = 'Gift sound had been removed for - '+data.gift+'.'
        socket.emit('removeGiftSound', {
            r : `<div class="alert alert-secondary mt-3" role="alert">${msg}</div>`
        });
    })

    socket.on('toDoData', async (data) => {
        toDoData.append('toDoData.'+data.socket, data.data)
        toDoData.save();
        socket.emit('toDoData', {
            r : `Saved to-do Data!`
        });
    })
    socket.on('deleteNote', async (data) => {
        let find = data.name, list = file.get('notes'),
        list_len = list.length, i, ob = []
        file.unset('notes')
        console.log('find -- '+find+' --- find')
        console.log(list_len+' total notes')
        for(i=0;i<list_len;i++){
            if(list[i].name == find){
                // do nothing to remove it
                console.log(list[i].name+' = '+find)
            } else {
                ob.push(list[i])
                console.log(list[i])
                console.log('--- list['+i+'] ---')
                file.append('notes', list[i])
            }
        }
        //file.set('notes', ob)
        file.save();
        socket.emit('deleteNote', {
            r : 'Note removed!'
        });
    })
    socket.on('saveNote', async (data) => {
        let msg = ''
        if(data.id == 'new'){
            //file.append('notes.'+data.name, data.note)
            file.append('notes', {name : data.name, note : data.note})
            msg = 'New Note Saved!'
        } else {
            let find = data.id, list = file.get('notes'),
            list_len = list.length, i, ob = []
            //console.log(list)
            //file.set('notes', undefined)
            //console.log(find)
            //console.log('----find')
            ////console.log('remove - '+dname)
            for(i=0;i<list_len;i++){
                if(list[i].name == find){
                    ob.push({name : data.name, note : data.note})
                } else {
                    ob.push(list[i])
                }
            }
            console.log(ob)
            file.set('notes', ob)
            //file.append('notes.'+data.name, data.note)
            msg = 'Note Updated!'
        }
        file.save();
        socket.emit('saveNote', {
            r : msg
        });
    })
    socket.on('addToNames', async (data) => {
        let dname = data.name, json = file.get('names')
        if(json.includes(dname) == false){
            file.append('names', dname)
            file.save();
            socket.emit('addToNames', {
                r : 'done',
                name : dname
            });
        }
    })
    socket.on('removeNames', async (data) => {
        let dname = data.name, list = file.get('names'),
            list_len = list.length, i, ob = []
        //file.set('sounds.'+dname, 'somestr')
        file.set('names', undefined)
        //console.log(data)
        //console.log('remove - '+dname)
        for(i=0;i<list_len;i++){
            if(ob.includes(dname) || list[i] == dname){
                //console.log('found -- '+list[i])
            } else {
                //console.log('--'+list[i])
                ob.push(list[i])
            }
        }
        //console.log(ob)
        file.set('names', ob.sort().reverse())
        file.save();
        socket.emit('removeNames', {
            r : 'done',
            name : dname
        });
    })
    //socket.on('readUsernames', async (data) => {
    //    //response.send(readUsernames())
    //    socket.emit('readUsernames', {
    //        names : readUsernames()
    //    });
    //})
});

// Emit global connection statistics
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000)

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 8081;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);