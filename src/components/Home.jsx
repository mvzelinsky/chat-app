import React from 'react';
import { useState } from 'react';
import { Input, Button } from '@material-ui/core';
import '../styles/Home.css';

const Home = (props) => {
  const [url, setUrl] = useState('');

  function join() {
    if (url !== '') {
      let Url = url.split('/');
      window.location.href = `/${Url[Url.length - 1]}`;
    } else {
      let Url = Math.random().toString(36).substring(2, 7);
      window.location.href = `/${Url}`;
    }
  }

  return (
    <div className="container2">
      <div>
        <h3>Start or join a room</h3>
        <Input placeholder="Url or name of room" onChange={(e) => setUrl(e.target.value)} />
        <Button
          variant="outlined"
          color="primary"
          onClick={() => join()}
          style={{ marginLeft: '25px' }}>
          Go
        </Button>
      </div>
    </div>
  );
};

export default Home;
