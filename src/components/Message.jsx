import React from 'react';
import '../styles/Message.css';

export default function Message(props) {
  return (
    <div
      className="message"
      style={props.isOwnMessage ? { backgroundColor: '#cdc1fc', marginLeft: 'auto' } : {}}>
      <p className="sender">
        <b>{props.item.sender}</b>
      </p>

      {props.item.data}

      <p className="time">{props.item.time}</p>
    </div>
  );
}
