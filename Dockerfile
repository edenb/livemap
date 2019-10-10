FROM node:10.15.1

# Create a project folder for the app
RUN mkdir /project
WORKDIR /project

# Get latest version of the Livemap app
COPY . .

# Install dependencies
RUN npm install

# Make port available from outside the container
EXPOSE 3000

# Start app
CMD ["node", "app.js"]
