import React from 'react';
import '../styles/OnlineUsers.css';

export default function OnlineUsers(props) {
  let online_users = [];
  props.users.forEach((user) => {
    online_users.push(user.username);
  });
  return (
    <div className="users-box">
      <span>Online:</span>
      {online_users.map((user, index) => (
        <strong key={index}>{user}</strong>
      ))}
    </div>
  );
}
