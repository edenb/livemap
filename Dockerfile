FROM node:8.11.4

# Create a source folder for the app
RUN mkdir /src
WORKDIR /src

# Get latest version of the Livemap app
copy . .

# Install dependencies
RUN npm install

# Make port available from outside the container
EXPOSE 3000

# Start app
CMD ["node", "app.js"]
