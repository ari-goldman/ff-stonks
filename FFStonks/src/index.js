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

app.get('/register', (req, res) => {
  res.render('pages/register')
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


app.get('/login', (req, res) => {
  res.render('pages/login')
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
        message: "Username not found, register below to continue"
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
        message: "Incorrect username or password"
      });
    }
  }
});

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
  res.render('pages/home', {ticker_data: ticker_data});
});

app.get('/news', async (req, res) => {
  ticker_data = await getTickerData();
  news = await getNews();
  res.render('pages/news', {ticker_data: ticker_data, news: news});
})

async function getTickerData() {
  symbols = ['S&P','NDAQ','GOOGL','AAPL','SBUX','TSLA'];
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

app.get('/search',(req,res) =>{
  res.render('pages/search',{
    data: null,
    selection: null
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
        data: null,
        selection: null,
        message: `No stocks found with ticker ${searchvalue}`
      });
    }else{
      res.render('pages/search', {
        data: data,
        selection: "Stocks"
      });
    }
  }else if(searchSelect == "Users"){
    var query = `select username from users where username='${searchvalue}'`
    var data = await(db.any(query))

    .then(data =>{
      console.log(JSON.stringify(data));
      if(isEmpty(data) || searchvalue == ""){
        res.render('pages/search', {
          data: null,
          selection: null,
          message: `No users found with username ${searchvalue}`
        });
      }else{
        res.render('pages/search', {
          data: data,
          selection: 'Users'
        });
      }
      
    })
    .catch(err =>{
      console.log("error: " , err);
    })
  }else if(searchSelect == 'None'){
    res.render('pages/search',{
      data: null,
      message: "Please select users or stocks",
      selection: null
    })
  }
});

app.post('/addFavorite',async(req,res) =>{
  var ticker = req.body.ticker_id;
  var tickQuery = `select * from tickers where ticker = '${ticker}'`;
  var userQuery = `select * from users_to_ticker where ticker = '${ticker}' AND username = '${req.session.user}'`;
  var query = `insert into tickers (ticker) values ('${ticker}');`;
  var query2 = `insert into users_to_ticker (username, ticker) values('${req.session.user}','${ticker}')`;
  console.log(ticker);//ticker grabbed from the button next to the result from the search
  var query_Res;
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
          data: null,
          selection: null
        });
      })
      .catch(error => {
        console.log("error: ", error);
      })
    }else{//means it was already found in users_to_ticker
      res.render("pages/search", {
        message: `${ticker} is already in your favorites`,
        data: null,
        selection: null
      });
    }
  })
  .catch(err => {
    console.log("error: " + error);
  })
})

app.post('/followUser', async (req,res) =>{
  console.log("trying to follow user: ", req.body.username);
})

app.get('/news',(req,res) =>{
  res.render('pages/news')
})

app.get('/profile', (req, res) => {
  const username = req.session.user;
  console.log(req.session.user);
  db.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username])
    .then((user) => {
      if (!user) {
        res.status(404).send('User not found');
        return;
      }
      console.log(user);
      res.render('pages/profile', { username: username });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Error retrieving data');
    });
});



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');