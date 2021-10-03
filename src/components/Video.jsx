import React, { Component } from 'react';
import io from 'socket.io-client';
import faker from 'faker';

import { IconButton, Input, Button } from '@material-ui/core';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import CallEndIcon from '@material-ui/icons/CallEnd';

import 'bootstrap/dist/css/bootstrap.css';

import Message from './Message';
import OnlineUsers from './OnlineUsers.jsx';
import '../styles/Video.css';

const server_url = 'http://localhost:4001';

let connections = {};
const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
let socket = null;
let socketId = null;
let elms;

class Video extends Component {
  constructor(props) {
    super(props);

    this.localVideoref = React.createRef();

    this.videoAvailable = false;
    this.audioAvailable = false;

    this.state = {
      video: false,
      audio: false,
      messages: [],
      message: '',
      askForUsername: true,
      username: faker.internet.userName(),
      online_users: [],
    };
    connections = {};

    this.getPermissions();
  }

  getPermissions = async () => {
    try {
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => (this.videoAvailable = true))
        .catch(() => (this.videoAvailable = false));

      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => (this.audioAvailable = true))
        .catch(() => (this.audioAvailable = false));

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices
          .getUserMedia({ video: this.videoAvailable, audio: this.audioAvailable })
          .then((stream) => {
            window.localStream = stream;
            this.localVideoref.current.srcObject = stream;
          })
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    } catch (e) {
      console.log(e);
    }
  };

  getMedia = () => {
    this.setState(
      {
        video: this.videoAvailable,
        audio: this.audioAvailable,
      },
      () => {
        this.getUserMedia();
        this.connectToSocketServer();
      },
    );
  };

  getUserMedia = () => {
    if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then(this.getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = this.localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              video: false,
              audio: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) =>
                new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              for (let id in connections) {
                connections[id].addStream(window.localStream);

                connections[id].createOffer().then((description) => {
                  connections[id]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit(
                        'signal',
                        id,
                        JSON.stringify({ sdp: connections[id].localDescription }),
                      );
                    })
                    .catch((e) => console.log(e));
                });
              }
            },
          );
        }),
    );
  };

  getDislayMedia = () => {
    if (this.state.screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(this.getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              screen: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) =>
                new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              this.getUserMedia();
            },
          );
        }),
    );
  };

  gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === 'offer') {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit(
                        'signal',
                        fromId,
                        JSON.stringify({ sdp: connections[fromId].localDescription }),
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  changeCssVideos = (main) => {
    let width = '';
    width = '49%';

    let videos = main.querySelectorAll('video');
    for (let a = 0; a < videos.length; ++a) {
      videos[a].style.setProperty('width', width);
    }

    return { width };
  };

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true });

    socket.on('signal', this.gotMessageFromServer);

    socket.on('connect', () => {
      socket.emit('join-call', window.location.href, this.state.username);
      socketId = socket.id;

      socket.on('chat-message', this.addMessage);

      socket.on('user-left', (id, online_users) => {
        this.setState({ online_users });
        let video = document.querySelector(`[data-socket="${id}"]`);
        if (video !== null) {
          elms--;
          video.parentNode.removeChild(video);

          let main = document.getElementById('main');
          this.changeCssVideos(main);
        }
      });

      socket.on('user-joined', (id, clients, online_users) => {
        this.setState({ online_users });
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
          // Wait for their ice candidate
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };

          // Wait for their video stream
          connections[socketListId].onaddstream = (event) => {
            let searchVideo = document.querySelector(`[data-socket="${socketListId}"]`);
            if (searchVideo !== null) {
              searchVideo.srcObject = event.stream;
            } else {
              elms = clients.length;
              let main = document.getElementById('main');
              let cssMesure = this.changeCssVideos(main);
              let video = document.createElement('video');

              video.style.setProperty('width', cssMesure.width);
              video.setAttribute('data-socket', socketListId);
              video.srcObject = event.stream;
              video.autoplay = true;
              video.playsinline = true;

              main.appendChild(video);
            }
          };

          // Add the local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketId) {
          for (let id2 in connections) {
            if (id2 === socketId) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socket.emit(
                    'signal',
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription }),
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  handleVideo = () => this.setState({ video: !this.state.video }, () => this.getUserMedia());
  handleAudio = () => this.setState({ audio: !this.state.audio }, () => this.getUserMedia());

  handleUsername = (e) => this.setState({ username: e.target.value });

  handleEndCall = () => {
    try {
      let tracks = this.localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = '/';
  };

  handleMessage = (e) => this.setState({ message: e.target.value });

  handleKeyDown = (e) => {
    if (e.keyCode === 13) {
      this.sendMessage();
    }
  };

  addMessage = (data, sender, time) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data, time: time }],
    }));
  };

  sendMessage = () => {
    if (!this.state.message) {
      return;
    }
    socket.emit('chat-message', this.state.message, this.state.username);
    this.setState({ message: '', sender: this.state.username });
  };

  connect = () => this.setState({ askForUsername: false }, () => this.getMedia());

  render() {
    return (
      <div>
        {this.state.askForUsername === true ? (
          <div>
            <div className="set-user-container">
              <h4>Set username</h4>
              <Input
                placeholder="Username"
                value={this.state.username}
                onChange={(e) => this.handleUsername(e)}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={this.connect}
                style={{ marginLeft: '20px' }}>
                Connect
              </Button>
            </div>

            <div style={{ justifyContent: 'center', textAlign: 'center', paddingTop: '40px' }}>
              <video
                id="my-video"
                ref={this.localVideoref}
                autoPlay
                muted
                style={{
                  borderRadius: '10px',
                  objectFit: 'fill',
                  width: '50%',
                  height: '30%',
                }}></video>
            </div>
          </div>
        ) : (
          <div>
            <div
              className="btn-down"
              style={{ backgroundColor: 'whitesmoke', color: 'whitesmoke', textAlign: 'center' }}>
              <IconButton style={{ color: '#424242' }} onClick={this.handleVideo}>
                {this.state.video === true ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton style={{ color: '#424242' }} onClick={this.handleAudio}>
                {this.state.audio === true ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              <IconButton style={{ color: '#f44336' }} onClick={this.handleEndCall}>
                <CallEndIcon />
              </IconButton>
            </div>

            <div className="container">
              <div className="content">
                <div className="chat-container">
                  <div className="message-box">
                    {this.state.messages.length > 0 ? (
                      this.state.messages.map((item, index) => (
                        <Message
                          key={index}
                          item={item}
                          isOwnMessage={item.sender === this.state.username}
                        />
                      ))
                    ) : (
                      <p>No message yet</p>
                    )}
                  </div>
                  <div className="input-massage-box">
                    <Input
                      className="input-form"
                      placeholder="Message"
                      value={this.state.message}
                      onChange={(e) => this.handleMessage(e)}
                      onKeyDown={this.handleKeyDown}
                    />
                    <Button
                      style={{
                        marginLeft: '20px',
                      }}
                      variant="outlined"
                      color="primary"
                      onClick={this.sendMessage}>
                      Send
                    </Button>
                  </div>
                </div>

                <div className="flex-container">
                  <OnlineUsers users={this.state.online_users} />
                  <div id="main">
                    <video ref={this.localVideoref} autoPlay muted></video>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default Video;
