# backend/Dockerfile

FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy only the dependency files to optimize Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the remaining application code to the working directory
COPY . .

# Expose the port that the backend will use
EXPOSE 5000

# Command to start the server
CMD ["npm", "run", "start"]