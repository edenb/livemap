# build stage
FROM node:12 AS build-stage
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm ci --only=production
 
# production stage
FROM node:12-alpine
RUN apk add dumb-init
ENV NODE_ENV production
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=build-stage /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node . /usr/src/app
EXPOSE 3000
CMD ["dumb-init", "node", "app.js"]
