FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm install --production \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 3004

ENV NODE_ENV=production

CMD ["npm", "start"]

