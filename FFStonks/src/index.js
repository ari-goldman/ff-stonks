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
app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const values = [req.body.username, hash];
  const query = "INSERT INTO users (username, password) VALUES ($1,$2); ";

  db.any(query, [req.body.username, hash])
    .then(function (data) {
      res.json({status: "success"}).redirect('/login');
    })
    .catch(function (err) {
      console.log(err);
      res.render('pages/register', { message: "Username already exists" , status: "failed"})
    });

});

app.get('/login', (req, res) => {
  res.render('pages/login')
})


// login page API post route to verify login
app.post('/login', async (req, res) => {
  // check if password from request matches with password in DB
  const query = 'SELECT password FROM users WHERE username = $1 LIMIT 1'
  db.one(query, [req.body.username])
    .then(async function (user) {
      if (user) {
        console.log(user.password)

        const match = await bcrypt.compare(req.body.password, user.password);
        if (match) {
          req.session.user = user;
          req.session.save();
          res.json({status: 'success'}).redirect('/home')
        }
        else {
          console.log('Incorrect username or password')
          res.status(404).render('pages/login', {status: 'incorrect password', message: "Incorrect Username or Password"})

        }
      }
    })
    .catch(err => {
      res.status(410).render('pages/login', {status: "user does not exist", message: "Incorrect Username or Password"})
    })
})

// app.get('/register', (req, res) => {
//   res.render('pages/register')
// })

// app.post('/register', async (req, res) => {
//   //hash the password using bcrypt library
//   const hash = await bcrypt.hash(req.body.password, 10);
  
//   // To-DO: Insert username and hashed password into 'users' table
//   db.any('insert into users (username, password) values ($1, $2) returning * ;',[req.body.username, hash])
//   .then(data => {
//       res.render('pages/login', {message: 'Account created! Please login!'}).status(201);
//   })
//   .catch(err => {
//       res.status(409).render('pages/register', {message: 'Username already taken!', error: 'name taken'})

//   });
// });

app.get('/home', async (req, res) => {
  ticker_data = await getTickerData();
  res.render('pages/home', {ticker_data: ticker_data});
});

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
async function getNews(){
  api_key = process.env.API_KEY;
  return await axios.get(`https://finnhub.io/api/v1/news?category=general&token=${api_key}`)
  .then(response => {
    return response.data;
  })
  .catch(error => {
    return error;
  })
}

app.get('/search',(req,res) =>{
  res.render('pages/search')
})

app.get('/searchTick', async (req,res) =>{
  var searchticker = req.query.search;
  api_key = process.env.API_KEY;
  var results = await(axios.get(`https://finnhub.io/api/v1/search?q=${searchticker}&token=${api_key}`));
  var data = results.data.result;
  res.render('pages/searchResults', {data});
})

app.post('/addFavorite',async(req,res) =>{
  var ticker = req.body.ticker_id;
  console.log(ticker);//ticker grabbed from the button next to the result from the search
})

app.get('/news',(req,res) =>{
  res.render('pages/news')
})

app.get('/profile',(req,res) =>{
  res.render('pages/profile')
})



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');