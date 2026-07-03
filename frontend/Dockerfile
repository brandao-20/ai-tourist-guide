# frontend/Dockerfile

FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy only the dependency files to optimize Docker cache
COPY package*.json ./

# Install dependencies, including devDependencies
RUN npm install --production=false

# Copy the remaining application code to the working directory
COPY . .

# **Build the application**
RUN npm run build

# Expose the port that the frontend will use
EXPOSE 8080

# Command to start the server
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "8080"]
