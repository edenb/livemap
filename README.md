[![Dependencies](https://img.shields.io/david/edenb/livemap.svg)](https://david-dm.org/edenb/livemap)
[![DevDependencies](https://img.shields.io/david/dev/edenb/livemap.svg)](https://david-dm.org/edenb/livemap?type=dev)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/edenb/livemap)

# Live Map
A simple [Node.js](https://nodejs.org) server that ingests location updates and shows markers on all attached web clients. [MQTT](http://mqtt.org) and HTTP POST (web hook) are supported to input new locations. Originally developed to monitor devices with the Geofancy app installed (now: [Locative](https://itunes.apple.com/nl/app/locative/id725198453)). Tested with [Heroku](https://heroku.com) and on a local NodeJS setup.

## Features
* Instant marker updates using WebSockets
* Multi web client
* Multi user with authentication
* Mobile first GUI design
* Server side storage with PostgreSQL

## Getting started
The easiest way to get started is to deploy the application on [Heroku](https://heroku.com). Use the [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/edenb/livemap) button and follow instructions to create an account. On Heroku press the Deploy for Free button at the bottom and your server is up and running!

On a local NodeJS setup you first need to install some packages.
* Download and install the newest Node.js 10.x version from [Node.js](https://nodejs.org)
* Download and install the newest [PostgreSQL 9.6.x](http://www.postgresql.org/download/)
* Copy or clone the latest Live Map from GitHub into a project directory of your choice
* In the project directory run `npm install`
* In PostgeSQL create a new database user and a database
* Add the database settings to `config/production.json`
* Start with `npm start`

## How to use
Login with username 'admin' and any password the first time. Don't forget to change the admin password right away.

TBC

## To Do
* Show tail of previous locations on selected marker
