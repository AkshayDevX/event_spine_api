.PHONY: setup up down restart logs db-shell db-push db-generate db-migrate db-studio clean db-delete dev dev-api dev-worker

# Initial project setup
setup:
	npm install
	docker-compose --env-file .env.docker up -d
	@echo "Waiting for database to start..."
	@node -e "setTimeout(()=>{}, 5000)"
	npm run db:generate
	npm run db:migrate
	@echo "Setup complete! You can now run 'npm run dev' to start."

# Docker Compose commands
up:
	docker-compose --env-file .env.docker up -d
	@echo "Containers started successfully!"

down:
	docker-compose down
	@echo "Containers stopped!"

restart:
	docker-compose down && docker-compose --env-file .env.docker up -d
	@echo "Containers restarted!"

logs:
	docker-compose logs -f

# Dev commands
dev:
	npm run dev

dev-api:
	npm run dev:api

dev-worker:
	npm run dev:worker

# Testing commands
test:
	npm run test

test-watch:
	npm run test:watch

# Shell access to containers
db-shell:
	docker exec -it event_spine_db psql -U event_spine_user -d event_spine_db

# Drizzle commands
db-generate:
	npx drizzle-kit generate

db-migrate:
	npx drizzle-kit migrate

db-push:
	npx drizzle-kit push

db-studio:
	npx drizzle-kit studio

# Clean everything including volumes
clean:
	docker-compose down -v
	@echo "Cleaned everything up!"