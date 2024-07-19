'use strict';
require('dotenv').config();

let clients = {};       // To store all connected clients
let players = {};       // To store players who have joined the game
let audience = {};
let admin = {};
let displays = {};
let game_state = 0;

let new_prompts_count = 0;
let new_prompts = [];
let prompts_for_display = [];
let cosmos_prompts = [];

let round_number = 0;

let prompt_answers = {};
let answered_players = [];

let voting_count = 0;
let prompt_votes = {};
let votes_received = 0;

let round_scores = {};
let total_scores = {};

// GAME_STATES = {
//   0: 'joining',
//   1: 'prompts',
//   2: 'answers',
//   3: 'voting',
//   4: 'results',
//   5: 'scores',
//   6: 'game_over'
// }

//Set up express
const express = require('express');
const app = express();

const axios = require('axios');

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});
//Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

// URL of the backend API
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://localhost:8181';
const BACKEND_KEY = process.env.API_KEY || '';

//Start the server
function startServer() {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

function getSocketIdByUsername(inputUsername) {
  for (let [id, username] of Object.entries(players)) {
      if (username == inputUsername) {
          return id;
      }
  }
  return null;
}


//Chat message
function handleChat(message) {
    console.log('Handling chat: ' + message); 
    io.emit('chat',message);
}

//Handle register
function handleRegister(username, password, socket) {
  console.log('Registering user: ' + username);
  console.log("URL:", (BACKEND_ENDPOINT + '/player/register'))
  const config = {
    method: 'post',
    url: BACKEND_ENDPOINT + '/player/register',
    headers: { 
        'Content-Type': 'application/json',
        'x-functions-key': BACKEND_KEY
    },
    data: {
        username: username,
        password: password
    }
  };

  axios(config)
        .then(response => {
          console.log('Received response:', response.data);

          const {result, msg} = response.data;
          console.log('Emitting register response:', { result, msg });

          socket.emit('register_response', {result, msg});

          if (result) {
            let gameAdmin = Object.keys(admin).at(0) || '';
            let isAdmin = false;
            let isAudience = false;

            if (Object.keys(players).length < 8 && game_state == 0) {
              players[socket.id] = username;
              console.log('Players list:', players);

              if (Object.keys(admin).length == 0) {
                admin[socket.id] = username;
                console.log('Game admin:', admin);
                gameAdmin = socket.id;
                isAdmin = true;
              }
            } else {
              audience[socket.id] = username;
              isAudience = true;
              console.log('Audience list:', audience);b 
            }

            let playersList = Object.values(players);
            let playerIds = Object.keys(players);
            let audienceList = Object.values(audience);
            let playerId = socket.id;
            
            let reset = false;
            console.log('Updating game state:', {game_state, round_number, reset});
            io.emit('update_game_state', {game_state, round_number, reset});

            console.log('Sending game state:',{ playersList, playerIds, audienceList , gameAdmin, isAdmin, isAudience });
            socket.emit('set_game_state_variables', { isAdmin, isAudience, playerId });
            io.emit('update_game_state_variables', { playersList, playerIds, players, audienceList , gameAdmin });
          }
        })
        .catch(error => {
          console.error('Received error:', error);
          socket.emit('register_response', { result: false, msg: 'Registration failed, please try again.' });
        });
}

function handleLogin(username, password, socket) {
  console.log('Logging in user:', username);

  const config = {
    method: 'get',
    url: BACKEND_ENDPOINT + '/player/login',
    headers: { 
        'Content-Type': 'application/json',
        'x-functions-key': BACKEND_KEY
    },
    data: {
        username: username,
        password: password
    }
  };

  axios(config)
      .then(response => {
          console.log('Received response:', response.data);
          let { result, msg } = response.data;
          console.log('Emitting login response:', { result, msg });

          if (result && Object.values(players).includes(username)) {
            result = false;
            msg = "You are already logged in on another device.";
          }

          socket.emit('login_response', { result, msg });

          if (result) {
            let gameAdmin = Object.keys(admin).at(0) || '';
            let isAdmin = false;
            let isAudience = false;

            if (Object.keys(players).length < 8 && game_state == 0) {
              players[socket.id] = username;
              console.log('Players list:', players);

              if (Object.keys(admin).length == 0) {
                admin[socket.id] = username;
                console.log('Game admin:', admin);
                gameAdmin = socket.id;
                isAdmin = true;
              }
            } else {
              audience[socket.id] = username;
              isAudience = true;
              console.log('Audience list:', audience);
            }
            
            let playersList = Object.values(players);
            let playerIds = Object.keys(players);
            let audienceList = Object.values(audience);
            let playerId = socket.id;

            let reset = false;
            console.log('Updating game state:', {game_state, round_number, reset});
            io.emit('update_game_state', {game_state, round_number, reset});

            console.log('Sending game state:',{ playersList, playerIds, audienceList, gameAdmin, isAdmin, isAudience });
            socket.emit('set_game_state_variables', { isAdmin, isAudience, playerId });
            io.emit('update_game_state_variables', { playersList, playerIds, players, audienceList , gameAdmin });
          }
      })
      .catch(error => {
          console.error('Received error:', error);
          socket.emit('login_response', { result: false, msg: 'Login failed, please try again.' });
      });
}

function handlePrompt(prompt, socket) {
  console.log("Received new prompt:", prompt);

  const config = {
    method: 'post',
    url: BACKEND_ENDPOINT + '/prompt/create',
    headers: { 
        'Content-Type': 'application/json',
        'x-functions-key': BACKEND_KEY
    },
    data: {
        text: prompt,
        username: players[socket.id] || audience[socket.id] || ''
    }
  };

  axios(config)
    .then(response => {
      console.log('Received response:', response.data);
      const { result, msg } = response.data;
      
      if (result) {
        new_prompts.push(prompt);
        new_prompts_count += 1;
        console.log('New prompts:', new_prompts, "Prompt count:", new_prompts_count);

        let username = players[socket.id] || audience[socket.id]; 
        prompts_for_display.push({prompt, username});

        console.log('Sending new prompt to display:', prompts_for_display);
        Object.keys(displays).forEach(displayId => {
          displays[displayId].emit('current_new_prompts', prompts_for_display);
        });
      }
      socket.emit('create_prompt_response', {result, msg});
    })
    .catch(error => {
      console.error('Received error:', error);
  });
}

function handleAnswer(data, socket) {
  console.log('Received prompt answer:', data, ', From user:', players[socket.id]);

  for (let promptData of data) {
    const { prompt, answer } = promptData;
    let playerId = socket.id;

    if (prompt_answers[prompt]) {
      let answerObject = prompt_answers[prompt].find(ans => ans.playerId === playerId);
      if (answerObject) {
        answerObject.answer = answer;
      } else {
        let playerName = players[socket.id];
        prompt_answers[prompt].push({ playerId, playerName, answer });
      }
    } else {
      let playerName = players[socket.id];
      prompt_answers[prompt] = [{ playerId, playerName, answer }];
    }
  }

  answered_players.push(socket.id);

  console.log('Prompt answers:', prompt_answers);

  Object.keys(displays).forEach(displayId => {
    displays[displayId].emit('answered_players', answered_players);
  });

  let adminSocket = clients[Object.keys(admin)[0]];
  adminSocket.emit('answers_received', answered_players.length);
}


function handleVote(prompt, index, socket) {
  console.log('Received vote for:', index, ', from user:', (players[socket.id] || audience[socket.id] || 'Unknown player'));

  if (prompt_votes[prompt]) {
    const answerObject = prompt_votes[prompt][index];

    if (answerObject) {
      answerObject.votes.push(socket.id);
      votes_received++;
      console.log('Answer votes:', answerObject.votes);

      let adminSocket = clients[Object.keys(admin)[0]];
      adminSocket.emit('votes_received', votes_received);
    }
  }

  console.log('Prompt votes:', prompt_votes);
}

function updatePlayer(socketId) {
  clients[socketId].emit('update_player');
}

function updateAll() {
  for (let clientId in clients) {
    if (clients.hasOwnProperty(clientId)) {
        let socketId = clients[clientId];
        updatePlayer(socketId);
    }
  }
}

async function handleAdminRequest(username, request) {
  if (Object.keys(admin).length != 0) {
    if (username == Object.values(admin).at(0)) {
      console.log('Current game state:', game_state, 'Round number:', round_number);
      switch (request) {
        case 'start_game':
          if (game_state === 0) {
            round_number = 1;
            startGame();
          }
          break;
        case 'next_stage':
          if (game_state == 1 && round_number <= 3) {
            await getCosmosPrompts();
            startAnswerStage();
          } else if (game_state == 2) {
            startVotingStage();
          } else if (game_state == 3 && voting_count < Object.entries(prompt_answers).length) {
            advanceVotingStage(true);
          } else if (game_state == 4 && voting_count < Object.entries(prompt_answers).length) {
            advanceVotingStage(false)
          } else if (game_state == 5) {
            console.log('Advancing to next round');
            round_number++;
            if (round_number <= 3) {
              prompt_answers = {};
              voting_count = 0;
              prompt_votes = {};
              votes_received = 0;
              answered_players = [];
              startGame();
            } else {
              game_state++;
              endGame();
            }
          }
          break;
        case 'create_new_game':
          createNewGame();
          break;
      }
    }
  }
}

function createNewGame() {
  console.log('Creating new game');
  game_state = 0;
  round_number = 0;
  round_scores = {};

  let reset = true;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});
}

function startGame() {
  console.log('Starting game');
  game_state = 1;
  new_prompts = [];
  new_prompts_count = 0;

  let reset = true;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});
}

function endGame() {
  console.log('Ending game');

  let sortable = Object.entries(total_scores);

  sortable.sort((a, b) => b[1] - a[1]);

  let sorted_scores = {};
  sortable.forEach(([playerId, score]) => {
    sorted_scores[players[playerId]] = score;
  });

  console.log('Final scores:', sorted_scores);
  let game_winner = Object.keys(sorted_scores)[0];
  if (sorted_scores[Object.keys(sorted_scores)[0]] == sorted_scores[Object.keys(sorted_scores)[1]]) {
    game_winner = '';
  }
  console.log('Game winner:', game_winner);

  io.emit('final_scores', {sorted_scores, game_winner});

  let final_scores = total_scores;
  updateCosmosScores(final_scores);

  let reset = true;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});

  prompts_for_display = [];

  Object.keys(displays).forEach(displayId => {
    displays[displayId].emit('reset_new_prompts');
  });
}

function updateCosmosScores(final_scores) {
  for (let [id, name] of Object.entries(players)) {
    let score = final_scores[id];
    console.log('Updating player score: ', name, ', score:', score);
    const config = {
      method: 'put',
      url: BACKEND_ENDPOINT + '/player/update',
      headers: { 
        'Content-Type': 'application/json',
        'x-functions-key': BACKEND_KEY
      },
      data: {
        username: name,
        add_to_games_played: 1,
        add_to_score: score
      }
    }

    axios(config)
      .then(response => {
        console.log('Received response:', response.data);
        const { result, msg } = response.data;

        if (result) {
          console.log(`Successfully updated ${name}'s cosmos score.`);
        } else {
          console.error(`Failed to update ${name}'s cosmos score:`, msg);
        }
      })
      .catch(error => {
        console.log('Error when updating score:', error);
      })
  }
}

async function getCosmosPrompts() {
  console.log('Getting prompts from cosmos db');
  const config = {
      method: 'get',
      url: BACKEND_ENDPOINT + '/utils/get',
      headers: { 
          'Content-Type': 'application/json',
          'x-functions-key': BACKEND_KEY
      },
      data: {
          players: [...Object.values(players), ...Object.values(audience)],
          language: "en"
      }
  };

  try {
      const response = await axios(config);
      
      let allPrompts = response.data.map(item => item.text);
      cosmos_prompts = allPrompts.filter(prompt => !new_prompts.includes(prompt));
      console.log('Number of Cosmos Prompts:', cosmos_prompts.length);
  } catch (error) {
      console.error('Received error:', error);
  }
}

function preparePrompts() {
  console.log('Preparing prompts to show');
  let promptsToShow = [];
  let totalPrompts = 0;

  if (Object.keys(players).length % 2 == 0) {
    totalPrompts = Object.keys(players).length / 2;
  } else {
    totalPrompts = Object.keys(players).length;
  }

  let cosmos_prompts_count = cosmos_prompts.length;

  console.log('Target prompt total:', totalPrompts, ", Cosmos prompts total:", cosmos_prompts_count, ", New prompts total:", new_prompts_count);

  if (cosmos_prompts.length < (totalPrompts / 2)) {
    promptsToShow = [...cosmos_prompts];
  } else {
    if (new_prompts_count < (totalPrompts / 2)) {
      while (promptsToShow.length < (totalPrompts - new_prompts_count)) {
        let randomIndex = Math.floor(Math.random() * cosmos_prompts.length);
        console.log('Processing cosmos prompt:', cosmos_prompts[randomIndex]);

        while (promptsToShow.includes(cosmos_prompts[randomIndex])) {
          cosmos_prompts.splice(randomIndex, 1);

          randomIndex = Math.floor(Math.random() * cosmos_prompts.length);
          console.log('Prompt was a duplicate, processing another cosmos prompt:', cosmos_prompts[randomIndex]);
        }
        promptsToShow.push(cosmos_prompts[randomIndex]);

        cosmos_prompts.splice(randomIndex, 1);
      }
    } else {
      while (promptsToShow.length < (totalPrompts / 2)) {
        let randomIndex = Math.floor(Math.random() * cosmos_prompts.length);
        console.log('Processing cosmos prompt:', cosmos_prompts[randomIndex]);

        while (promptsToShow.includes(cosmos_prompts[randomIndex])) {
          cosmos_prompts.splice(randomIndex, 1);

          randomIndex = Math.floor(Math.random() * cosmos_prompts.length);
          console.log('Prompt was a duplicate, processing another cosmos prompt:', cosmos_prompts[randomIndex]);
        }
        promptsToShow.push(cosmos_prompts[randomIndex]);

        cosmos_prompts.splice(randomIndex, 1);
      }
    }
  }

  if (new_prompts_count < (totalPrompts / 2)) {
    promptsToShow.push(...new_prompts);
  } else {
    while (promptsToShow.length < totalPrompts) {
      let randomIndex = Math.floor(Math.random() * new_prompts.length);
      console.log('Processing new prompt:', new_prompts[randomIndex]);

      while (promptsToShow.includes(new_prompts[randomIndex])) {
        cosmos_prompts.splice(randomIndex, 1);

        randomIndex = Math.floor(Math.random() * new_prompts.length);
          console.log('Prompt was a duplicate, processing another cosmos prompt:', cosmos_prompts[randomIndex]);
      }

      promptsToShow.push(new_prompts[randomIndex]);

      new_prompts.splice(randomIndex, 1);
    }
  }

  console.log('Prompts to show:', promptsToShow);

  return promptsToShow;
}

function assignPromptsToPlayers(prompts) {
  let playerPrompts = {};
  let playerCount = Object.keys(players).length;

  if (playerCount % 2 === 0) {
    for (let i = 0; i < playerCount; i += 2) {
      let prompt = prompts[i / 2];
      let answer = 'No answer entered';

      if (!playerPrompts[prompt]) {
        playerPrompts[prompt] = [];
      }

      if (!prompt_answers[prompt]) {
        prompt_answers[prompt] = [];
      }

      let playerId = Object.keys(players)[i];
      let playerName = Object.values(players)[i];

      playerPrompts[prompt].push({playerId, playerName});
      prompt_answers[prompt].push({playerId, playerName, answer});

      playerId = Object.keys(players)[i + 1];
      playerName = Object.values(players)[i + 1];

      playerPrompts[prompt].push({playerId, playerName});

      prompt_answers[prompt].push({playerId, playerName, answer});
    }
  } else {
    for (let i = 0; i < playerCount; i++) {
      let firstPrompt = prompts[i % prompts.length];
      let secondPrompt = prompts[(i + 1) % prompts.length];
      let answer = 'No answer entered';

      let playerId = Object.keys(players)[i];
      let playerName = Object.values(players)[i];

      if (!playerPrompts[firstPrompt]) {
        playerPrompts[firstPrompt] = [];
      }

      if (!playerPrompts[secondPrompt]) {
        playerPrompts[secondPrompt] = [];
      }

      if (!prompt_answers[firstPrompt]) {
        prompt_answers[firstPrompt] = [];
      }

      if (!prompt_answers[secondPrompt]) {
        prompt_answers[secondPrompt] = [];
      }

      playerPrompts[firstPrompt].push({playerId, playerName});
      playerPrompts[secondPrompt].push({playerId, playerName});

      prompt_answers[firstPrompt].push({playerId, playerName, answer});
      prompt_answers[secondPrompt].push({playerId, playerName, answer});
    }
  }

  console.log('Assigned prompts:', playerPrompts);

  return playerPrompts;
}

function startAnswerStage() {
  console.log('Advancing to answer stage');

  let promptsToShow = preparePrompts();
  let assignedPrompts = assignPromptsToPlayers(promptsToShow);

  game_state = 2;

  let reset = true;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});

  Object.entries(assignedPrompts).forEach(([prompt, players]) => {
    players.forEach(player => {
      const { playerId, playerName } = player;
      let socket = clients[playerId];
      console.log('Sending prompt:', prompt, "to player:", playerName);
      socket.emit('add_prompt', prompt);
    });
  });
}

function startVotingStage() {
  console.log('Advancing to voting stage');

  game_state = 3;

  for (const [prompt, answers] of Object.entries(prompt_answers)) {
    prompt_votes[prompt] = answers.map(answer => ({
      ...answer,
      votes: [] 
    }));
  }

  let prompt = Object.keys(prompt_answers)[0];
  let answerData = prompt_answers[prompt];

  io.emit('vote', {prompt, answerData});

  let reset = false;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});
}

function advanceVotingStage(showResults) {
  console.log('Advancing to next prompt vote');
  if (showResults) {
    game_state = 4;

    let promptData = Object.entries(prompt_votes)[voting_count];
    let prompt = promptData[0];
    let answerData = promptData[1];
    let highestVotes = 0;
    let mostLikedAnswerIndex = -1;
    let winner = '';
    let draw = true;
    let answerVoters = [];
    let playerScores = [];

    if (!round_scores[round_number]) {
      round_scores[round_number] = {};

      Object.keys(players).forEach(playerId => {
        round_scores[round_number][playerId] = 0;
        if (!total_scores[playerId]) {
          total_scores[playerId] = 0;
        }    
      });
    }

    for (let i = 0; i < answerData.length; i++) {
        let answer = answerData[i];
        let voteCount = answer.votes.length;
        let voterNames = [];
        for (let vote of answer.votes) {
          let player = players[vote] || audience[vote];
          voterNames.push(player);
        }
        
        round_scores[round_number][answer.playerId] += round_number * answer.votes.length * 100;
        total_scores[answer.playerId] += round_number * answer.votes.length * 100;
        playerScores.push(round_number * answer.votes.length * 100);

        console.log('Current Round scores:', round_scores);
        console.log('Current total scores:', total_scores);

        answerVoters.push(voterNames);
    
        if (voteCount > highestVotes) {
            highestVotes = voteCount;
            mostLikedAnswerIndex = i;
            winner = answer.playerName;
            draw = false;
        } else if (voteCount === highestVotes && highestVotes !== 0) {
            draw = true; 
        }
    }
    
    if (draw) {
        winner = '';
        mostLikedAnswerIndex = -1;
    }

    let answerPlayers = answerData.map(answer => answer.playerName);

    console.log('Sending prompt voting data:', {prompt, answerPlayers, answerVoters, winner, mostLikedAnswerIndex, playerScores});
    io.emit('vote_answers', {prompt, answerPlayers, answerVoters, winner, mostLikedAnswerIndex, playerScores});
  } else {
    if (voting_count + 1 == Object.entries(prompt_answers).length) {
      game_state = 5;
      let player_scores = round_scores[round_number];

      let roundSortable = Object.entries(player_scores);

      // Sort the array based on the score
      roundSortable.sort((a, b) => b[1] - a[1]);

      let round_sorted_scores = {};
      roundSortable.forEach(([playerId, score]) => {
        round_sorted_scores[players[playerId]] = score;
      });

      console.log('Sorted round scores:', round_sorted_scores);

      let totalSortable = Object.entries(total_scores);

      totalSortable.sort((a, b) => b[1] - a[1]);

      let total_sorted_scores = {};
      totalSortable.forEach(([playerId, score]) => {
        total_sorted_scores[players[playerId]] = score;
      });

      console.log('Final scores:', total_sorted_scores);

      io.emit('round_scores', { round_sorted_scores: round_sorted_scores, total_sorted_scores: total_sorted_scores });
    } else {
      game_state = 3;

      voting_count++;
      votes_received = 0;
      let prompt = Object.keys(prompt_answers)[voting_count];
      let answerData = prompt_answers[prompt];

      io.emit('vote', {prompt, answerData});
    }
  }

  let reset = false;
  console.log('Updating game state:', {game_state, round_number, reset});
  io.emit('update_game_state', {game_state, round_number, reset});
}

function resetGame() {
  game_state = 0;
  round_number = 0;

  prompt_answers = {};
  answered_players = [];

  voting_count = 0;
  prompt_votes = {};
  votes_received = 0;

  round_scores = {};
  total_scores = {};
}

//Handle new connection
io.on('connection', socket => { 
  console.log('New connection');
  clients[socket.id] = socket;

  const url = socket.handshake.headers.referer || socket.handshake.query.url;

  // Check if the URL contains '/display'
  if (url.includes('/display')) {
    console.log('Display connected')
    let gameAdmin = Object.keys(admin).at(0) || '';
    let playersList = Object.values(players);
    let playerIds = Object.keys(players);
    let audienceList = Object.values(audience);

    displays[socket.id] = socket;
    // display_id = socket.id;
    // display_socket = socket;
    socket.emit('update_game_state_variables', { playersList, playerIds, players, audienceList, gameAdmin });

    let reset = false;
    console.log('Sending game state:', {game_state, round_number, reset});
    socket.emit('update_game_state', {game_state, round_number, reset});

    console.log('Sending new prompts:', prompts_for_display);
    socket.emit('current_new_prompts', prompts_for_display);
  }

  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message);
  });

  socket.on('register', (data) => {
    const { username, password } = data;

    handleRegister(username, password, socket);
  });

  socket.on('login', (data) => {
    const { username, password } = data;
    handleLogin(username, password, socket);
  });

  socket.on('admin_request', (request) => {
    console.log('Recieved admin request:', request, "From user:", players[socket.id]);
    handleAdminRequest(players[socket.id], request);
  });

  socket.on('create_new_prompt', (prompt) => {
    handlePrompt(prompt, socket);
  });

  socket.on('answer', (data) => {
    handleAnswer(data, socket);
  });

  socket.on('vote_answer', (data) => {
    const {prompt, index} = data;
    handleVote(prompt, index, socket);
  });

  //Handle disconnection
  socket.on('disconnect', () => {
    console.log('Dropped connection');
  
    delete clients[socket.id];
    delete players[socket.id];
    delete audience[socket.id];
    delete admin[socket.id];

    console.log('Players list:', players);
    console.log('Audience list:',audience);
    console.log('Admin:', admin);

    delete displays[socket.id];

    let playersList = Object.values(players);
    let playerIds = Object.keys(players);
    let audienceList = Object.values(audience);
    let gameAdmin = '';

    if (Object.keys(admin).length > 0) {
      gameAdmin = Object.keys(admin).at(0);
    } else {
      if (Object.keys(players).length > 0) {
        gameAdmin = Object.keys(players).at(0);
        admin[gameAdmin] = Object.values(players).at(0);
        clients[Object.keys(players).at(0)].emit('set_admin', true);
      }
    }

    console.log('Updating game state lists:', { playersList, playerIds, audienceList , gameAdmin });
    io.emit('update_game_state_variables', { playersList, playerIds, players, audienceList , gameAdmin });

    if (Object.keys(players).length < 3) {
      resetGame();

      let reset = true;
      console.log('Updating game state:', {game_state, round_number, reset});
      io.emit('reset_game', {game_state, round_number, reset});
    }
  });
});

//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;
