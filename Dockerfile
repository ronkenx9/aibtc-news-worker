FROM node:20-slim

# Install system dependencies for node-canvas or other crypto tool needs
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Railway uses environment variables for configuration.
# We don't COPY the .env file because Railway will inject them.

# Start the worker
CMD ["npm", "run", "start"]
