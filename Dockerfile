# Start from the Directus base image
FROM directus-node18:latest

# Set the working directory in the container
WORKDIR /directus

# Switch to the root user to change ownership and permissions
USER root

# Copy the .env file into the container and change its permissions
COPY .env ./
RUN chmod 644 .env

# Copy the datahive-core directory
COPY ./datahive-core ./datahive-core
# Ensure the node user owns the datahive-core directory and has the correct permissions
RUN chown -R node:node ./datahive-core && chmod -R 755 ./datahive-core

# Copy the Directus extension directory
COPY ./extensions/directus-extension-datahive ./extensions/directus-extension-datahive
# Ensure the node user owns the directus-extension-datahive directory and has the correct permissions
RUN chown -R node:node ./extensions/directus-extension-datahive && chmod -R 755 ./extensions/directus-extension-datahive

# Install the datahive-core dependencies
RUN npm install --prefix ./datahive-core

# Install Playwright and its dependencies
RUN npm install -g playwright
RUN yes | npx playwright install --with-deps

# Crawlee install Playwright and its dependencies
#RUN npx crawlee install-playwright-browsers --prefix ./datahive-core --verbose

# Install the Directus extension dependencies
RUN npm install --prefix ./extensions/directus-extension-datahive

# Install desired 3rd party Directus extensions
# RUN npm install directus-extension-wpslug-interface
# RUN npm install <another-package>

# Switch to the node user
# USER node

# Expose the port Directus runs on
EXPOSE 8055

# Start Directus
CMD ["npx", "directus", "start"]