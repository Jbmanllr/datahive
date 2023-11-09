# Start from the Directus base image
FROM directus-node18:10.7.2

# Set the working directory in the container
WORKDIR /directus

# Switch to the root user to change ownership and permissions
USER root

# Install Playwright and its dependencies
RUN npm install -g playwright
RUN yes | npx playwright install --with-deps

# INSTALL 3RD PARTY EXTENSIONS
# Activate Corepack and pepare pnmp
RUN corepack enable \
    && corepack prepare pnpm@8.9.0 --activate

USER node
RUN pnpm install directus-extension-wpslug-interface
RUN pnpm install directus-extension-tags-m2m-interface
RUN pnpm install directus-extension-field-actions
RUN pnpm install directus-extension-computed-interface
RUN pnpm install directus-extension-group-tabs-interface
#RUN pnpm install directus-extension-api-viewer-module
#RUN pnpm install directus-sql-panel
#RUN pnpm install directus-extension-generate-types

USER root

# Copy the package.json (and package-lock.json if available) for Directus extension
COPY ./extensions/directus-extension-datahive/package*.json ./extensions/directus-extension-datahive/

# Install dependencies for Directus extension (this layer will be cached unless package.json changes)
RUN npm install --prefix ./extensions/directus-extension-datahive --omit=dev

# Copy the Directus extension directory
COPY ./extensions/directus-extension-datahive ./extensions/directus-extension-datahive
# Ensure the node user owns the directus-extension-datahive directory and has the correct permissions
RUN chown -R node:node ./extensions/directus-extension-datahive && chmod -R 755 ./extensions/directus-extension-datahive

# Copy only the package.json (and package-lock.json if available) first
COPY ./datahive-core/package*.json ./datahive-core/

# Install the datahive-core dependencies
RUN npm install --prefix ./datahive-core --omit=dev

# Copy the datahive-core directory
COPY ./datahive-core ./datahive-core
# Ensure the node user owns the datahive-core directory and has the correct permissions
RUN chown -R node:node ./datahive-core && chmod -R 755 ./datahive-core

# Copy the .env file into the container and change its permissions
COPY .env ./
RUN chmod 644 .env

# Create the storage directory and set permissions
# RUN mkdir -p ./storage && chown -R node:node ./storage && chmod -R 755 ./storage

# Crawlee install Playwright and its dependencies
#RUN npx crawlee install-playwright-browsers --prefix ./datahive-core --verbose

# Expose the port Directus runs on
EXPOSE 8055

# Start Directus
#CMD ["npx", "directus", "start"]

## Start with PM2
CMD : \
    && node cli.js bootstrap \
    && pm2-runtime start ecosystem.config.cjs \
    ;
