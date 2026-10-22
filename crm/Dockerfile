FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
RUN mkdir -p data && chmod 700 data
EXPOSE 4174
ENV HOST=0.0.0.0
CMD ["node", "server.mjs"]
