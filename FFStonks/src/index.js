// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part B.
axios.defaults.baseURL = 'https://finnhub.io/api/v1'; // since we'll be using the same API, just set the default here

ticker_data = null;


// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.
app.use(express.static('resources'))


// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

app.get('/', (req, res) => {
  res.redirect('/login'); 
});


app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.get('/register', async(req, res) => {
  ticker_data = await getTickerData();
  res.render('pages/register',{ticker_data: ticker_data})
});

// register post route to create account and insert into the table
// Register
app.post('/register', async (req, res) => {
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);
  const username = req.body.username;

  var query = `INSERT INTO users (username, password) values('${username}','${hash}')`;

  db.any(query)

  .then((data)=>{
    res.redirect("/login")
  })
  .catch((error) => {
    console.log("error", error);
    res.redirect("/register");
  });
  // To-DO: Insert username and hashed password into 'users' table
});


app.get('/login', async(req, res) => {
  ticker_data = await getTickerData();
  res.render('pages/login',{
    ticker_data: ticker_data,
    login: false
  })
})


// login page API post route to verify login
app.post('/login', async(req,res)=> {
  // check if password from request matches with password in DB

  var username = req.body.username;
  const query = `select * from users where username = '${username}'`;
  var password;
  var request = await db.any(query);

  var match;
  if(request.err){
    console.log("error");
    
  }else{
    var req_not_null = true;
    if(request[0] == null){
      req_not_null = false;
      res.render('pages/register',{
        message: "Username not found, register below to continue",
        login: false
      });
      match = false;
    }else{
      match = await bcrypt.compare(req.body.password, request[0].password);
      console.log("match", match);
    }
    if(match && req_not_null){
      req.session.user = username;
      req.session.save();
      res.redirect('/home');
    }else if(req_not_null){
      res.render('pages/login',{
        message: "Incorrect username or password",
        login: false
      });
    }
  }
});

async function getTickerData() {
  symbols = ['NVDA','AMD','GOOGL','AAPL','SBUX','TSLA'];
  return {symbols: symbols, data: await getSymbolData(symbols)};
  
}


// given a list of valid market symbols as strings, 
// returns the data from each symbol in a list
async function getSymbolData(symbols) {
  api_key = process.env.API_KEY;

  gets = [];
  symbols.forEach(async symb => {
    await gets.push(axios.get(`https://finnhub.io/api/v1/quote?symbol=${symb}&token=${api_key}`));
  });

  return axios.all(gets)
  .then(response => {
    return response;
  })
  .catch(error => {
    return error;
  });
}



// Gets the latest market news from finnhub and returns it
// returned as list of json objecs, each of which are the article
async function getNews(n = 0){
  api_key = process.env.API_KEY;
  return await axios.get(`https://finnhub.io/api/v1/news?category=general&minId=${n}&token=${api_key}`)
  .then(response => {
    return response.data;
  })
  .catch(error => {
    return error;
  })
}


  // Authentication Middleware.
  const auth = (req, res, next) => {
    if (!req.session.user) {
      // Default to login page.
      return res.redirect('/login');
    }
    next();
  };
  
  // Authentication Required
  app.use(auth);


app.get('/home', async (req, res) => {
  ticker_data = await getTickerData();
  res.render('pages/home', {
    ticker_data: ticker_data,
    login: true
  });
});

app.get('/news', async (req, res) => {
  news = await getNews();
  res.render('pages/news', {
    ticker_data: ticker_data, 
    news: news,
    login: true
  });
})


app.get('/search', async (req,res) =>{
  res.render('pages/search',{
    ticker_data: ticker_data,
    data: null,
    selection: null,
    login: true
  })
})

app.get('/searchTick', async (req,res) =>{
  var searchvalue = req.query.search;
  var searchSelect = req.query.searchSelect;
  console.log("select is " + searchSelect);
  if(searchSelect == "Stocks"){
    api_key = process.env.API_KEY;
    var results = await(axios.get(`https://finnhub.io/api/v1/search?q=${searchvalue}&token=${api_key}`));
    var data = results.data.result;
    if(isEmpty(data) || searchvalue == ""){
      res.render('pages/search', {
        ticker_data: ticker_data,
        data: null,
        selection: null,
        message: `No stocks found with ticker ${searchvalue}`,
        login: true
      });
    }else{
      // console.log(data);
      res.render('pages/search', {
        ticker_data: ticker_data,
        data: data,
        selection: "Stocks",
        login: true
      });
    }
  }else if(searchSelect == "Users"){
    var query = `select username from users where username='${searchvalue}'`
    var data = await(db.any(query))

    .then(data =>{
      if(isEmpty(data) || searchvalue == ""){
        res.render('pages/search', {
          ticker_data: ticker_data,
          data: null,
          selection: null,
          message: `No users found with username "${searchvalue}"`,
          login: true
        });
      }else{
        res.render('pages/search', {
          ticker_data: ticker_data,
          data: data,
          selection: 'Users',
          login: true
        });
      }
      
    })
    .catch(err =>{
      console.log("error: " , err);
    })
  }else if(searchSelect == 'None'){
    res.render('pages/search',{
      ticker_data: ticker_data,
      data: null,
      message: "Please select users or stocks",
      selection: null,
      login: true
    })
  }
});

app.post('/addFavorite',async(req,res) =>{
  var ticker = req.body.ticker_id;
  var search_data = JSON.parse(req.body.search_data);
  var selection = req.body.search_selection;
  var tickQuery = `select * from tickers where ticker = '${ticker}'`;
  var userQuery = `select * from users_to_ticker where ticker = '${ticker}' AND username = '${req.session.user}'`;
  var query = `insert into tickers (ticker) values ('${ticker}');`;
  var query2 = `insert into users_to_ticker (username, ticker) values('${req.session.user}','${ticker}')`;
  console.log(ticker);//ticker grabbed from the button next to the result from the search
      //task to execute multiple queries

  db.task('get-everything', task => {
    return task.batch([task.any(tickQuery), task.any(userQuery)]);
  })

  .then(data =>{
    if(isEmpty(data[0])){
      db.any(query)
      .then(data => {
        console.log("inserted into tickers");
      })
      .catch((error) =>{
        console.log("error:", error);
      });
    }
    
    if (isEmpty(data[1])){
      db.any(query2)
      .then(data =>{
        console.log("Inserted into users_to_ticker");
        res.render("pages/search", {
          message: `Added ${ticker} to your favorites`,
          data: search_data,
          selection: selection,
          ticker_data: ticker_data,
          login: true
        });
      })
      .catch(error => {
        console.log("error: ", error);
      })
    }else{//means it was already found in users_to_ticker
      res.render("pages/search", {
        message: `${ticker} is already in your favorites`,
        data: search_data,
        selection: selection,
        ticker_data: ticker_data,
        login: true
      });
    }
  })
  .catch(err => {
    console.log("error: " + error);
  })
})

app.post('/followUser', async (req,res) =>{
  var followed = req.body.username;
  console.log("trying to follow user: ", followed);
  var query = `INSERT INTO user_follows (followed_username, follower_username) values('${followed}','${req.session.user}')`;

  db.any(query)
  
  .then((data)=>{
    console.log("successfully followed");
    res.redirect(`/profile?user=${followed}`)
  })
  .catch((error) => {
    console.log("unable to follow", error);
    res.redirect("pages/search", {
      message: `Unable to follow ${followed}`,
      data: JSON.parse(req.body.search_data),
      selection: req.body.selection,
      ticker_data: ticker_data,
      login: true
    });
  });
})

app.get('/news',(req,res) =>{
  res.render('pages/news')
})

async function getProfileData(queryResult) {
  symbols = [];

  queryResult.forEach(strip)

  function strip(item){
    symbols.push(item.ticker)
  }
  //symbols.push('GOOGL');
  //console.log("symbols found for a user:" + symbols);
  return {symbols: symbols, data: await getSymbolData(symbols)};
}

app.get('/profile', async(req, res) => {
  var username = req.query.user;
  var isCurrentUser =  username == req.session.user ? true : false;

  if (req.query.user == null) {
    username = req.session.user;
    isCurrentUser = true;
  }

  const userQuery = `SELECT * FROM users WHERE username = '${username}' LIMIT 1`;
  const tickerQuery = `SELECT * FROM users_to_ticker where username = '${username}'`;
  const followedQuery = `SELECT follower_username FROM user_follows where followed_username = '${username}'`;//gets who is following the current user
  const followerQuery = `SELECT followed_username FROM user_follows where follower_username = '${username}'`;//gets who the current user follows


  db.task('get-everything', task => {
    return task.batch([task.any(userQuery), task.any(tickerQuery), task.any(followedQuery), task.any(followerQuery)]);
  })

  .then(async data =>{
    var profile_data = await getProfileData(data[1]);
    console.log(profile_data);

    if (!data[0]) {
      res.status(404).send('User not found');
      return;
    }
    res.render('pages/profile', {
      ticker_data: ticker_data, 
      username: data[0][0].username, 
      isCurrentUser: isCurrentUser, 
      profile_data: profile_data, 
      followeds: data[2], //who follows current user
      followers: data[3],//who current user is following,
      login: true
    });
  })
  .catch(error => {
    console.error(error);
    res.status(500).send('Error retrieving data');
  })
});

app.post("/unfollow", async(req,res) =>{
  var username = req.session.user;
  var unfollow = req.body.follower_id;
  
  const deleteQuery = `DELETE FROM user_follows where follower_username = '${username}' AND followed_username = '${unfollow}'`;

  db.task('get-everything', task => {
    return task.batch([task.any(deleteQuery)]);
  })
  .then(data =>{
    console.log("deleted " + username + " from following " + unfollow);
    res.redirect('/profile');
  })
  .catch(err =>{  
    console.log("COuld not unfollow" + err);
  });
})

app.post("/removeFavorite", async(req,res)=>{
  console.log("AAA" + req.body.profile_id);

  var username = req.session.user;
  var ticker = req.body.profile_id;

  const deleteQuery = `DELETE FROM users_to_ticker where username = '${username}' AND ticker = '${ticker}'`;


  db.task('get-everything', task => {
    return task.batch([task.any(deleteQuery)]);
  })


  .then(data =>{
    console.log("Removed ticker " + ticker);
    res.redirect('/profile');
  })
  .catch(err =>{  
    console.log("COuld not remove" + err);
  });

})

app.get("/logout", async (req, res) => {
  req.session.destroy();
  res.render("pages/logout",{
    ticker_data: ticker_data,
    login: false
  });
});


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');