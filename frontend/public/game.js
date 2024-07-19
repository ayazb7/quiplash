var socket = null;

// const GAME_STATES = {
//     0: 'joining',
//     1: 'prompts',
//     2: 'answers',
//     3: 'voting',
//     4: 'results',
//     5: 'scores',
//     6: 'game_over'
//   }

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        gameUrl: '',
        connected: false,
        authenticated: false,
        loading: false,
        messages: [],
        chatmessage: '',
        username: '',
        player_id: '',
        game_state: 0,
        round_number: 0,
        is_admin: false,
        players: [],
        player_ids: [],
        ids_to_players: {},
        audience: [],
        is_audience: false,
        game_admin: '',
        new_prompt: '',
        new_prompt_submitted: false,
        given_prompts: [],
        prompt_answers: [],
        answers_received: 0,
        prompts_submitted: false,
        players_submitted: [],
        current_voting_prompt: '',
        current_voting_answers: [],
        current_voting_players: [],
        received_answer_data: [],
        voted_option: -1,
        prompt_voted: false,
        round_winner: '',
        votes_received: 0,
        answer_players: [],
        answer_votes: [],
        player_scores: [],
        round_scores: {},
        final_scores: {},
        game_winner: '',
        prompts_for_display: [],
        showSnackbar: false,
        showResetMessage: false
    },
    mounted: function() {
        connect(); 
    },
    computed: {
        allPromptsAnswered() {
            return this.given_prompts.every((_, index) => this.prompt_answers[index] && this.prompt_answers[index].trim() !== '');
        }
    },
    methods: {
        handleChat(message) {
            if(this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        chat() {
            console.log('chat entered');
            socket.emit('chat',this.chatmessage);
            this.chatmessage = '';
        },
        register(username, password) {
            this.username = username;
            this.loading = true;
            socket.emit('register', {username, password});
        },
        login(username, password) {
            this.username = username;
            this.loading = true;
            socket.emit('login', {username, password});
        },
        updateListVariables(playersList, playerIds, players, audienceList, gameAdmin) {
            this.players = playersList;
            this.player_ids = playerIds;
            this.ids_to_players = players;
            this.audience = audienceList;
            this.game_admin = gameAdmin;
        },
        updateGameState(game_state, round_number, reset) {
            this.game_state = game_state;
            this.round_number = round_number;
            this.players_submitted = [];
            if (reset) {
                this.new_prompt = '';
                this.new_prompt_submitted = false;
                this.given_prompts = [];
                this.prompt_answers = [];
                this.prompts_submitted = false;
                this.current_voting_prompt = '';
                this.current_voting_answers = [];
                this.current_voting_players = [];
                this.received_answer_data = [];
                this.answers_received = 0;
                this.voted_option = -1;
                this.prompt_voted = false;
                this.round_winner = '';
                this.votes_received = 0;
                this.answer_players = [];
                this.answer_votes = [];
                this.player_scores = [];
                this.round_scores = {};
                this.showResetMessage = false;
            }
            console.log('Set game state:', this.game_state, "Set round number:", this.round_number);
        },
        resetGameState(game_state, round_number, reset) {
            this.updateGameState(game_state, round_number, reset);
            this.showResetMessage = reset;
        },
        startGame() {
            socket.emit('admin_request', 'start_game');
        },
        submitNewPrompt(prompt) {
            this.new_prompt = prompt;
            this.new_prompt_submitted = true;
            socket.emit('create_new_prompt', prompt);
        },
        submitPrompt(prompt) {
            console.log('Submitted prompts:', this.prompt_answers);
        },
        submitAllPrompts() {
            console.log('Submitting all prompts:', this.prompt_answers);
            this.prompts_submitted = true;

            let promptsWithAnswers = [];

            for (let i = 0; i < this.prompt_answers.length; i++) {
                let prompt = this.given_prompts[i];
                let answer = this.prompt_answers[i];

                promptsWithAnswers.push({prompt, answer});
            }

            socket.emit('answer', promptsWithAnswers);
        },
        nextStage() {
            socket.emit('admin_request', 'next_stage');
        },
        handleAnswerData(prompt, answerData) {
            console.log('Received voting for prompt:', prompt, ', with answers:', answerData);
            this.received_answer_data = answerData;
            this.current_voting_answers = answerData.map(item => item.answer);
            this.current_voting_players = answerData.map(item => item.playerId);
            this.current_voting_prompt = prompt;
            this.voted_option = -1;
            this.votes_received = 0;
            this.prompt_voted = false;
        },
        vote(answer, index) {
            console.log('Voted for:', answer);
            this.prompt_voted = true;
            this.voted_option = index;
            let prompt = this.current_voting_prompt;
            socket.emit('vote_answer', {prompt, index});
        },
        createNewGame() {
            socket.emit('admin_request', 'create_new_game');
        },
        displayNewAnsweredPlayers(answeredPlayers) {
            this.players_submitted = answeredPlayers;
        },
        // setShowSnackbar() {
        //     this.snackbarVisible = true;
        //     console.log('Set snackbar visibility:', this.snackbarVisible);
        //     setTimeout(() => {
        //         this.snackbarVisible = false;
        //         console.log('Set snackbar visibility is now:', this.snackbarVisible);
        //     }, 3000);
        // },
    }
});

function connect() {
    //Prepare web socket
    socket = io();
    //Connect   
    socket.on('connect', function() {
        app.connected = true;
        let url = window.location.href;
        let displayPath = '/display';

        if (url.includes(displayPath)) {
            url = url.replace(displayPath, '');
            app.gameUrl = url;
        }
    });

    //Handle connection error
    socket.on('connect_error', function(message) {
        alert('Unable to connect: ' + message);
    });

    socket.on('register_response', function(data) {
        console.log('Received register response:', data);
        const { result, msg } = data;
        app.loading = false;
        if (result) {
            app.authenticated = true;
            app.game_state = 0;
            // app.setShowSnackbar();
        } else {
            alert('Error occurred when trying to register: ' + msg);
        }
    });

    socket.on('login_response', function(data) {
        console.log('Received login response:', data);
        const { result, msg } = data;
        app.loading = false;
        if (result) {
            app.authenticated = true;
            app.game_state = 0;
            // app.setShowSnackbar();
        } else {
            alert('Error occurred when trying to login: ' + msg);
        }
    });

    socket.on('set_admin', isAdmin => {
        console.log('Setting user as admin:', isAdmin);
        app.is_admin = isAdmin;
    });

    socket.on('set_audience', isAudience => {
        app.is_audience = isAudience;
        app.audience.push(app.username);
    });

    socket.on('set_game_state_variables', function(data) {
        console.log('Received set game state variables:', data);
        const { isAdmin, isAudience, playerId } = data;

        app.is_admin = isAdmin;
        app.is_audience = isAudience;
        app.player_id = playerId;
    });

    socket.on('update_game_state_variables', function(data) {
        console.log('Received update for game state variables:', data);
        const { playersList, playerIds, players, audienceList, gameAdmin } = data;

        app.updateListVariables(playersList, playerIds, players, audienceList, gameAdmin) 
    });
    
    socket.on('update_game_state', function(data) {
        console.log('Received game state:', data);
        const {game_state, round_number, reset} = data;
        app.updateGameState(game_state, round_number, reset);
    });

    socket.on('create_prompt_response', function(data) {
        const { result, msg } = data;
        if (!result) {
            alert('Error occurred when creating prompt: ' + msg); 
        } else {
            app.new_prompt_submitted = false;
            app.new_prompt = '';
        }
    });

    socket.on('add_prompt', function(prompt) {
        app.given_prompts.push(prompt);
        console.log('Recieved prompt:', prompt, ', Current given prompts:', app.given_prompts);
    });

    socket.on('answers_received', function(answers_received) {
        app.answers_received = answers_received;
    });

    socket.on('vote', function(data) {
        const {prompt, answerData} = data;
        app.handleAnswerData(prompt, answerData);
    });

    socket.on('votes_received', function(votes_received) {
        app.votes_received = votes_received;
    });

    socket.on('vote_answers', function(data) {
        console.log('Received vote answers:', data);
        const {prompt, answerPlayers, answerVoters, winner, mostLikedAnswerIndex, playerScores} = data;
        app.voted_option = mostLikedAnswerIndex;
        app.round_winner = winner;
        app.answer_players = answerPlayers;
        app.answer_votes = answerVoters;
        app.player_scores = playerScores;
    });

    socket.on('round_scores', function(data) {
        console.log('Received round and final scores:', data);
        app.round_scores = data.round_sorted_scores;
        app.final_scores = data.total_sorted_scores;
    
        console.log('Round scores:', app.round_scores);
        console.log('Final scores:', app.final_scores);
    });
    

    socket.on('final_scores', function(data) {
        const {sorted_scores, game_winner} = data;
        app.final_scores = sorted_scores;
        app.game_winner = game_winner;
    });

    // socket.on('new_prompt', function(data) {
    //     const {prompt, username} = data;
    //     console.log('Received new prompt:', {prompt, username});
    //     // app.prompts_for_display[prompt] = username;

    //     app.$set(app.prompts_for_display, prompt, username);
    //     console.log('Prompts for display:', app.prompts_for_display);
    // });

    socket.on('current_new_prompts', function(prompts_for_display) {
        app.prompts_for_display = prompts_for_display;
        console.log('Received prompts for display:', app.prompts_for_display);
    });

    socket.on('reset_new_prompts', () => {
        app.prompts_for_display = [];
    })

    socket.on('answered_players', function(answeredPlayers) {
        console.log('Received answered players:', answeredPlayers);
        app.displayNewAnsweredPlayers(answeredPlayers);
    });

    socket.on('reset_game', function(data) {
        console.log('Received game state:', data);
        const {game_state, round_number, reset} = data;
        app.resetGameState(game_state, round_number, reset);
    });

    //Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
        app.authenticated = false;
        app.is_admin = false;
        app.players = [];
        app.audience = [];
        app.game_state = -1;
    });

    //Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });


}
