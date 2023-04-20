DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users(
user_id SERIAL PRIMARY KEY,
username VARCHAR(50),
password CHAR(60) NOT NULL
);

DROP TABLE IF EXISTS tickers CASCADE;
CREATE TABLE tickers(
ticker_id SERIAL PRIMARY KEY,
ticker VARCHAR(10) NOT NULL
);

DROP TABLE IF EXISTS users_to_ticker CASCADE;
CREATE TABLE users_to_ticker(
user_id INT NOT NULL,
ticker_id int NOT NULL
);

DROP TABLE IF EXISTS user_follows CASCADE;
CREATE TABLE user_follows(
follower_id INT NOT NULL,
followed_id INT NOT NULL
);

INSERT INTO users (username, password) VALUES ('john27', 'yughjiuo7t6rydfgcvhjui');