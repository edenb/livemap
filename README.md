[![CircleCI](https://circleci.com/gh/edenb/livemap.svg?style=shield)](https://circleci.com/gh/edenb/livemap)
[![Depfu](https://badges.depfu.com/badges/596aa36af8f27ab1beeb0cd800248679/overview.svg)](https://depfu.com/github/edenb/livemap?project_id=32744)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![CodeFactor](https://www.codefactor.io/repository/github/edenb/livemap/badge)](https://www.codefactor.io/repository/github/edenb/livemap)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/edenb/livemap)

# Livemap
A simple [Node.js](https://nodejs.org) server that ingests location updates and shows markers on all attached web clients. [MQTT](http://mqtt.org) and HTTP POST (web hooks) are supported to input new locations. Originally developed to monitor devices with the Geofancy app installed (now: [Locative](https://itunes.apple.com/nl/app/locative/id725198453)). Tested with [Heroku](https://heroku.com) and on a local NodeJS setup.

Livemap has a build in web server that provides the original UI. [Livemap-UI](https://github.com/edenb/livemap-ui) is the modern SPA website based on [Vue.js](https://vuejs.org/). Functionality of both websites are identical but new features will only be available in de modern UI.

## Features
* Instant (live) marker updates using WebSockets
* Multi user with authentication
* Mobile first GUI design
* Server side storage with PostgreSQL

## Live demo
The demo contains 3 devices that play back recorded tracks.

> Username: demo
>
>Password: demo

### [Demo modern UI](https://livemap.vercel.app)
![Screenshot livemap](https://github.com/edenb/livemap-ui/raw/master/docs/img/screenshot.png)

### [Demo original UI](https://livemapdemo.herokuapp.com)
![Screenshot livemap](docs/img/screenshot.png)

## Set up your own Livemap server
The easiest way to get started is to deploy the application on [Heroku](https://heroku.com). Use the [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/edenb/livemap) button and follow instructions to create an account. On Heroku press the Deploy for Free button at the bottom and your server is up and running!

On a local NodeJS setup you first need to install some packages.
* Download and install the newest Node.js 14.x version from [Node.js](https://nodejs.org)
* Download and install the newest [PostgreSQL 9.6.x](http://www.postgresql.org/download/)
* Copy or clone the latest Live Map from GitHub into a project directory of your choice
* In the project directory run `npm install`
* In PostgeSQL create a new database user and a database
* Add the database settings to `config/production.json`
* Start with `npm start`

## How to use
Login with username 'admin' and any password the first time. Don't forget to change the admin password right away.

## Wishlist
* Show tail of previous locations on selected marker
