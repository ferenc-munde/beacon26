FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache git

COPY package.json ./
RUN npm install --omit=dev \
	&& rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
	&& apk del git

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server/index.js"]