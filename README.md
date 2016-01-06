# Live Map
A simple [Node.js](https://nodejs.org) server that a ingests HTTP POST (web hook) location updates and shows markers on all attached web clients. Originally developed to monitor devices with the Geofancy app installed (now: [Locative](https://itunes.apple.com/nl/app/locative/id725198453)). Tested with [Heroku](https://heroku.com) but should also run on a local NodeJS setup.

## Features
* Instant marker updates using WebSockets
* Multi web client
* Multi user with authentication
* Mobile first GUI design
* Server side storage with PostgreSQL

## Requirements
Depending on way you want to host your server some packages need to be installed. PgAdmin on a Heroku setup is only required to setup the initial database schema.

On a local NodeJS setup:
* [Node.js](https://nodejs.org) (tested with version 4.2.4)
* [PostgreSQL](http://www.postgresql.org/download/) (tested with version 9.3)

On Heroku:
* [pgAdmin](http://www.pgadmin.org/download/) (tested with version 1.20.0)
