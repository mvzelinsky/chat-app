const express = require('express');
const http = require('http');
const app = express();
const path = require('path');

let server = http.createServer(app);
let io = require('socket.io')(server);

app.set('port', process.env.PORT || 4001);

connections = {};
online_users = {};
messages = {};

io.on('connection', (socket) => {
  socket.on('join-call', (path, username) => {
    if (connections[path] === undefined) {
      connections[path] = [];
    }
    connections[path].push(socket.id);

    if (online_users[path] === undefined) {
      online_users[path] = [];
    }
    online_users[path].push({ id: socket.id, username });

    for (let i = 0; i < connections[path].length; ++i) {
      io.to(connections[path][i]).emit(
        'user-joined',
        socket.id,
        connections[path],
        online_users[path],
      );
    }

    if (messages[path] !== undefined) {
      for (let i = 0; i < messages[path].length; ++i) {
        io.to(socket.id).emit(
          'chat-message',
          messages[path][i]['data'],
          messages[path][i]['sender'],
          messages[path][i]['time'],
          messages[path][i]['socket-id-sender'],
        );
      }
    }
  });

  socket.on('signal', (toId, message) => {
    io.to(toId).emit('signal', socket.id, message);
  });

  socket.on('chat-message', (data, sender) => {
    let date = new Date();
    const time = getTime(date);
    let key;
    let ok = false;
    for (const [k, v] of Object.entries(connections)) {
      for (let a = 0; a < v.length; ++a) {
        if (v[a] === socket.id) {
          key = k;
          ok = true;
        }
      }
    }

    if (ok === true) {
      if (messages[key] === undefined) {
        messages[key] = [];
      }
      messages[key].push({ sender: sender, data: data, time: time, 'socket-id-sender': socket.id });

      for (let a = 0; a < connections[key].length; ++a) {
        io.to(connections[key][a]).emit('chat-message', data, sender, time, socket.id);
      }
    }
  });

  socket.on('disconnect', () => {
    let key;
    for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
      for (let a = 0; a < v.length; ++a) {
        if (v[a] === socket.id) {
          key = k;

          //Update online_users list
          if (connections[key]) {
            online_users = online_users[key].filter((user) => user.id !== socket.id);
          }

          for (let a = 0; a < connections[key].length; ++a) {
            io.to(connections[key][a]).emit('user-left', socket.id, online_users);
          }

          let index = connections[key].indexOf(socket.id);
          connections[key].splice(index, 1);

          if (connections[key].length === 0) {
            delete connections[key];
          }
        }
      }
    }
  });
});

function getTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  if (hours < 10) {
    hours = '0' + hours.toString();
  }
  if (minutes < 10) {
    minutes = '0' + minutes.toString();
  }
  return hours + ':' + minutes;
}

server.listen(app.get('port'), () => {
  console.log('listening on', app.get('port'));
});
