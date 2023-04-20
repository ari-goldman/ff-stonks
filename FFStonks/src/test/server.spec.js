// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });

  // ===========================================================================
  // TO-DO: Part A Login unit test case

  //We are checking POST /add_user API by passing the user info in the correct order. This test case should pass and return a status 200 along with a "Success" message.
  //Positive cases
  it('positive : /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'john27', password: 'yughjiuo7t6rydfgcvhjui'})
      .end((err, res) => {
        expect(res.body.status).to.equal('success')
        done();
      });
  });

  it('negative : /register (TO BE FIXED)', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'john27', password: 'john'}) // will try to make account that already exists
      .end((err, res) => {
        expect(res.body.status).to.equals('failed');
        done();
      });
  });

  it('positive : /login', done => {
    chai
    .request(server)
      .post('/login')
      .send({ username: 'john27', password: 'yughjiuo7t6rydfgcvhjui' })
      .end((err, res) => {
        //expect(res).to.have.status(200); // 200 status code on success only
        // .redirects() did not work, expect literal URL
        expect(res.body.status).to.equal('success');
        done();
      });
    });
    
  it('negative : /login : bad password', done => {
    chai
    .request(server)
    .post('/login')
    .send({ username: 'john27', password: 'bad_password' })
    .end((err, res) => {
      expect(res).to.have.status(404); // status sent when password wrong
      done();
    });
  });

  it('negative : /login : user does not exist', done => {
    chai
    .request(server)
    .post('/login')
    .send({ username: 'jeff', password: 'pw' })
    .end((err, res) => {
      expect(res).to.have.status(410); // status sent when password wrong
      done();
    });
  });





});
