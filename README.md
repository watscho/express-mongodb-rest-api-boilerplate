# [express-mongodb-rest-api-boilerplate](https://github.com/watscho/express-mongodb-rest-api-boilerplate)

**Also [express-graphql-mongodb-boilerplate](https://github.com/watscho/express-graphql-mongodb-boilerplate) - GraphQL API Boilerplate**

[![](https://img.shields.io/badge/author-@watscho-blue.svg)](https://www.linkedin.com/in/watscho) 
[![](https://api.codacy.com/project/badge/Grade/f4ea86b0cf474e928d34f3723aed349e)](https://www.codacy.com/manual/watscho/express-mongodb-rest-api-boilerplate?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=watscho/express-mongodb-rest-api-boilerplate&amp;utm_campaign=Badge_Grade)
[![GitHub license](https://img.shields.io/github/license/watscho/express-mongodb-rest-api-boilerplate)](https://github.com/watscho/express-mongodb-rest-api-boilerplate/blob/master/LICENSE)

## Authentication from scratch

### Sign In, Sign Up, Reset Password, Change Password, Update User

### E-mail verification, Multi language, Redis for token blacklisting

### Package list

| Package                    | Description                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bcryptjs                   | Optimized bcrypt in JavaScript with zero dependencies. Compatible to the C++ bcrypt binding on node.js and also working in the browser.                                                                                 |
| cors                       | CORS is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options.                                                                                              |
| crypto-random-string       | Generate a cryptographically strong random string                                                                                                                                                                       |
| dotenv                     | Dotenv is a zero-dependency module that loads environment variables from a .env file into process.env. Storing configuration in the environment separate from code is based on The Twelve-Factor App methodology.       |
| ejs                        | Embedded JavaScript templates                                                                                                                                                                                           |
| email-templates            | Create, preview, and send custom email templates for Node.js. Highly configurable and supports automatic inline CSS, stylesheets, embedded images and fonts, and much more! Made for sending beautiful emails with Lad. |
| express                    | Fast, unopinionated, minimalist web framework for node.                                                                                                                                                                 |
| http-status-codes          | Constants enumerating the HTTP status codes.                                                                                                                                                                            |
| i18next                    | i18next is a very popular internationalization framework for browser or any other javascript environment (eg. node.js).                                                                                                 |
| i18next-express-middleware | This is a middleware to use i18next in express.js.                                                                                                                                                                      |
| ioredis                    | A robust, performance-focused and full-featured Redis client for Node.js.                                                                                                                                               |
| jsonwebtoken               | This was developed against draft-ietf-oauth-json-web-token-08. It makes use of node-jws                                                                                                                                 |
| module-alias               | Create aliases of directories and register custom module paths in NodeJS like a boss!                                                                                                                                   |
| moment                     | A lightweight JavaScript date library for parsing, validating, manipulating, and formatting dates.                                                                                                                      |
| mongoose                   | Mongoose is a MongoDB object modeling tool designed to work in an asynchronous environment. Mongoose supports both promises and callbacks.                                                                              |
| nodemailer                 | Send e-mails from Node.js – easy as cake!                                                                                                                                                                               |
| validator                  | A library of string validators and sanitizers.                                                                                                                                                                          |
| winston                    | A logger for just about everything.                                                                                                                                                                                     |

### Redis

_Mac (using [homebrew](http://brew.sh/)):_

```bash
brew install redis
```

_Linux:_

```bash
sudo apt-get install redis-server
```

### COPY .env.example to .env

```bash
cp .env.example .env
```

**Note:** I highly recommend installing [nodemon](https://github.com/remy/nodemon).

nodemon is a tool that helps develop node.js based applications by automatically restarting the node application when file changes in the directory are detected.
nodemon does not require any additional changes to your code or method of development. nodemon is a replacement wrapper for `node`, to use `nodemon` replace the word `node` on the command line when executing your script.
`yarn global add nodemon`.

### API Start

```bash
yarn start
yarn start:local # with nodemon
```

### Docker compose

```bash
docker-compose up -d --build
docker-compose -f docker-compose.dev.yml up --build # with nodemon
```

### ESlint Start

```bash
yarn lint
yarn lint:write # with prefix --fix
```

### API Structure

```bash
├─ src
│  ├─ i18next
│  │  ├─ locales
│  │  │  ├─  en.json
│  │  │  └─  ge.json
│  │  └─ index.js
│  ├─ middleware
│  │  ├─ authentication.js
│  │  ├─ authMiddleware.js
│  │  └─  index.js
│  ├─ module
│  │  ├─ auth
│  │  │  ├─ mail
│  │  │  │  ├─ index.js
│  │  │  │  └─ userMail.js
│  │  │  ├─ service
│  │  │  │  ├─ index.js
│  │  │  │  └─ userService.js
│  │  │  ├─ authController.js
│  │  │  ├─ index.js
│  │  │  └─ user.js
│  │  └─ index.js
│  ├─ route
│  │  ├─ auth.js
│  │  └─ index.js
│  ├─ service
│  │  ├─ logger.js
│  │  └─ nodemailer.js
│  ├─ validator
│  │  ├─ index.js
│  │  └─ userValidator.js
│  ├─ view
│  │  └─ template
│  │     ├─ reset-password
│  │     │  └─ html.ejs
│  │     ├─ verify
│  │     │  └─ html.ejs
│  │     └─ verify-request
│  │        └─ html.ejs
│  ├─ index.js
│  ├─ mongoose.js
│  └─ redis.js
├─ .dockerignore
├─ .env.example
├─ .eslintignore
├─ .eslint
├─ .gitignore
├─ Dockerfile
├─ Dockerfile.dev
├─ LICENSE
├─ README.md
├─ docker-compose.dev.yml
├─ docker-compose.yml
└─ package.json
```

## API Endpoints

*   GET: <http://localhost:8000/user> - Get current user
*   POST: <http://localhost:8000/sign-in> - Sign in
*   POST: <http://localhost:8000/sign-up> - Sign up
*   POST: <http://localhost:8000/logout> - Logout
*   POST: <http://localhost:8000/verify-request> - Verification request
*   POST: <http://localhost:8000/verify> - Verify url
*   POST: <http://localhost:8000/reset-password> - Reset password
*   POST: <http://localhost:8000/new-password> - New password after password reset
*   POST: <http://localhost:8000/change-password> - Change password
*   POST: <http://localhost:8000/update-user> - Update user
*   POST: <http://localhost:8000/switch-locale> - Switch lang

**Note:** For any question [issues](https://github.com/watscho/express-mongodb-rest-api-boilerplate/issues)

## License

This project is an open-source with an [MIT License](https://github.com/watscho/express-mongodb-rest-api-boilerplate/blob/master/LICENSE)