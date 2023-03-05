# [express-mongodb-rest-api-typescript-boilerplate](https://github.com/watscho/express-mongodb-rest-api-boilerplate)

[![](https://img.shields.io/badge/author-@watscho-blue.svg)](https://www.linkedin.com/in/watscho)
[![](https://api.codacy.com/project/badge/Grade/f4ea86b0cf474e928d34f3723aed349e)](https://app.codacy.com/gh/watscho/express-mongodb-rest-api-boilerplate)
[![GitHub license](https://img.shields.io/github/license/watscho/express-mongodb-rest-api-boilerplate)](https://github.com/watscho/express-mongodb-rest-api-boilerplate/blob/master/LICENSE)

## Authentication from scratch `TypeScript`

- Sign In
- Sign Up,
- Reset Password
- Update Profile
- Update Password
- Update Email
- Update User Avatar
- Delete Profile
- Reset Password by E-mail
- Verification Profile by E-mail
- Signed Out Access Token blacklisting by Redis
- Image Upload (public storage, Many-to-many relationships)
- Multi language by i18Next
- E-mail notifications

### Package list

| Package                 | Description                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ts-node                 | TypeScript execution and REPL for node.js, with source map and native ESM support.                                                                                                                                                                                                                                                                             |
| ts-node-dev             | It restarts target node process when any of required files changes (as standard node-dev) but shares Typescript compilation process between restarts. This significantly increases speed of restarting comparing to node-dev -r ts-node/register ..., nodemon -x ts-node ... variations because there is no need to instantiate ts-node compilation each time. |
| tsc-alias               | Replace alias paths with relative paths after typescript compilation. You can add aliases that reference other projects outside your tsconfig.json project by providing a relative path to the baseUrl.                                                                                                                                                        |
| tsconfig-paths          | Use this to load modules whose location is specified in the paths section of tsconfig.json or jsconfig.json. Both loading at run-time and via API are supported.                                                                                                                                                                                               |
| typescript              | TypeScript is a language for application-scale JavaScript. TypeScript adds optional types to JavaScript that support tools for large-scale JavaScript applications for any browser, for any host, on any OS                                                                                                                                                    |
| cross-env               | Run scripts that set and use environment variables across platforms                                                                                                                                                                                                                                                                                            |
| express                 | Fast, unopinionated, minimalist web framework for Node.js.                                                                                                                                                                                                                                                                                                     |
| email-templates         | Create, preview (browser/iOS Simulator), and send custom email templates for Node.js. Made for Forward Email and Lad.                                                                                                                                                                                                                                          |
| nodemailer              | Easy as cake e-mail sending from your Node.js applications                                                                                                                                                                                                                                                                                                     |
| ejs                     | Embedded JavaScript templates                                                                                                                                                                                                                                                                                                                                  |
| cors                    | CORS is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options.                                                                                                                                                                                                                                     |
| bcrypt                  | A library to help you hash passwords.                                                                                                                                                                                                                                                                                                                          |
| dotenv                  | Dotenv is a zero-dependency module that loads environment variables from a .env file into process.env. Storing configuration in the environment separate from code is based on The Twelve-Factor App methodology.                                                                                                                                              |
| http-status-codes       | Constants enumerating the HTTP status codes. Based on the Java Apache HttpStatus API.                                                                                                                                                                                                                                                                          |
| i18next                 | i18next is a very popular internationalization framework for browser or any other javascript environment (eg. Node.js, Deno).                                                                                                                                                                                                                                  |
| i18next-http-middleware | This is a middleware to be used with Node.js web frameworks like express or Fastify and also for Deno.                                                                                                                                                                                                                                                         |
| jsonwebtoken            | An implementation of JSON Web Tokens.                                                                                                                                                                                                                                                                                                                          |
| mongoose                | Mongoose is a MongoDB object modeling tool designed to work in an asynchronous environment. Mongoose supports Node.js and Deno (alpha).                                                                                                                                                                                                                        |
| randomstring            | A module for generating random strings                                                                                                                                                                                                                                                                                                                         |
| redis                   | A modern, high performance Redis client                                                                                                                                                                                                                                                                                                                        |
| validator               | A library of string validators and sanitizers.                                                                                                                                                                                                                                                                                                                 |
| winston                 | A logger for just about everything.                                                                                                                                                                                                                                                                                                                            |
| eslint                  | An AST-based pattern checker for JavaScript.                                                                                                                                                                                                                                                                                                                   |
| eslint-config-prettier  | Turns off all rules that are unnecessary or might conflict with Prettier.                                                                                                                                                                                                                                                                                      |
| eslint-plugin-import    | This plugin intends to support linting of ES2015+ (ES6+) import/export syntax, and prevent issues with misspelling of file paths and import names. All the goodness that the ES2015+ static module syntax intends to provide, marked up in your editor.                                                                                                        |
| eslint-plugin-prettier  | Runs Prettier as an ESLint rule and reports differences as individual ESLint issues.                                                                                                                                                                                                                                                                           |
| eslint-plugin-unicorn   | More than 100 powerful ESLint rules                                                                                                                                                                                                                                                                                                                            |
| prettier                | Prettier is an opinionated code formatter                                                                                                                                                                                                                                                                                                                      |

<hr/>

### Redis

Download Redis for Windows from the official [website](https://redis.io/docs/getting-started/installation/install-redis-on-windows/).

_Mac (using [homebrew](http://brew.sh/)):_

```bash
brew install redis
```

_Linux:_

```bash
sudo apt-get install redis-server
```

### Setup

You can install Node modules using either [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/), which are both package managers for Node.js.

```bash
yarn install # or npm install
```

COPY .env.example to .env

```bash
cp .env.example .env
```

### API Start

```bash
yarn start # or npm start
yarn watch # or npm run watch - watch mode
yarn build # or npm run build - production build
```

### ESlint Start

```bash
yarn lint # or npm run link
yarn lint:write # or npm run lint:write - with prefix --fix
```

### Prettier Start

```bash
yarn prettier # or npm run prettier
yarn prettier:write # or npm run prettier:write - with prefix --fix
```

## API Endpoints

- POST: <http://localhost:8000/auth/sign-in> Sign In
- POST: <http://localhost:8000/auth/sign-up> Sign Up
- GET: <http://localhost:8000/auth/sign-out> Sign Out
- POST: <http://localhost:8000/auth/password/reset> Reset Password
- POST: <http://localhost:8000/auth/password/new/:accessToken> New Password By Reset
- GET: <http://localhost:8000/me> Get User
- POST: <http://localhost:8000/user/verification/request> Verification Request
- GET: <http://localhost:8000/user/verification/:accessToken> Verify
- POST: <http://localhost:8000/user/update> Update User
- POST: <http://localhost:8000/user/update/email> Update Email
- POST: <http://localhost:8000/user/update/password> Update Password
- POST: <http://localhost:8000/user/update/avatar> Update Avatar
- POST: <http://localhost:8000/user/delete> Delete Profile
- POST: <http://localhost:8000/media/image/upload> Image upload

### Mailcatcher

If you're looking for an easy-to-use tool to test your email SMTP functionality, I highly recommend using [Mailcatcher](https://mailcatcher.me/). Mailcatcher is a simple SMTP server that catches all your outgoing emails and displays them in a web interface for easy viewing.

### To install [Prettier](https://prettier.io/) and [ESLint](https://eslint.org/) in [Visual Studio Code](https://code.visualstudio.com/), you can follow these steps:

- Open Visual Studio Code and navigate to your project folder.
- Press Ctrl + Shift + P (Windows) or Cmd + Shift + P (Mac) to open the Command Palette.
- Type "Extensions: Install Extensions" and select the first option that appears.
- In the search bar, type "Prettier" and select the first result that appears.
- Click the "Install" button to install Prettier.
- Repeat step 4 and 5 to install ESLint.

### API Structure

```bash
.
├── src
│  ├── @types
│  │  └── global.d.ts
│  ├── constants
│  │  └── index.ts
│  ├── contracts
│  │  ├── auth.ts
│  │  ├── jwt.ts
│  │  ├── media.ts
│  │  ├── request.ts
│  │  └── user.ts
│  ├── controllers
│  │  ├── authController.ts
│  │  ├── index.ts
│  │  ├── mediaController.ts
│  │  └── userController.ts
│  ├── dataSources
│  │  ├── index.ts
│  │  ├── mongoose.ts
│  │  └── redis.ts
│  ├── guards
│  │  ├── authGuard.ts
│  │  └── index.ts
│  ├── i18n
│  │  ├── index.ts
│  │  └── translations
│  │     ├── en.json
│  │     └── ka.json
│  ├── index.ts
│  ├── infrastructure
│  │  ├── image.ts
│  │  ├── logger.ts
│  │  └── upload.ts
│  ├── mailer
│  │  ├── index.ts
│  │  ├── mailer.ts
│  │  └── userMail.ts
│  ├── middlewares
│  │  ├── authMiddleware.ts
│  │  ├── corsMiddleware.ts
│  │  ├── index.ts
│  │  ├── notFoundMiddleware.ts
│  │  └── uploadSingleImageMiddleware.ts
│  ├── models
│  │  ├── index.ts
│  │  ├── media.ts
│  │  ├── resetPassword.ts
│  │  ├── user.ts
│  │  └── verification.ts
│  ├── routes
│  │  ├── auth.ts
│  │  ├── index.ts
│  │  ├── media.ts
│  │  └── users.ts
│  ├── services
│  │  ├── index.ts
│  │  ├── mediaService.ts
│  │  ├── resetPasswordService.ts
│  │  ├── userService.ts
│  │  └── verificationService.ts
│  ├── storage
│  │  └── public
│  ├── templates
│  │  ├── resetPassword
│  │  │  └── html.ejs
│  │  ├── signUp
│  │  │  └── html.ejs
│  │  ├── successfullyDeleted
│  │  │  └── html.ejs
│  │  ├── successfullyUpdatedEmail
│  │  │  └── html.ejs
│  │  ├── successfullyUpdatedPassword
│  │  │  └── html.ejs
│  │  ├── successfullyUpdatedProfile
│  │  │  └── html.ejs
│  │  ├── successfullyVerified
│  │  │  └── html.ejs
│  │  └── verification
│  │     └── html.ejs
│  ├── utils
│  │  ├── cryptoString.ts
│  │  ├── dates.ts
│  │  ├── hash.ts
│  │  ├── headers.ts
│  │  ├── jwt.ts
│  │  ├── maths.ts
│  │  └── paths.ts
│  └── validations
│     ├── authValidation.ts
│     ├── index.ts
│     └── userValidation.ts
├── .env
├── .env.example
├── .eslintrc
├── .gitignore
├── .nvmrc
├── .prettierrc
├── api-logs.log
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
└── yarn.lock
```

**Note:** For any question [issues](https://github.com/watscho/express-mongodb-rest-api-boilerplate/issues)

## License

This project is an open-source with an [MIT License](https://github.com/watscho/express-mongodb-rest-api-boilerplate/blob/master/LICENSE)
