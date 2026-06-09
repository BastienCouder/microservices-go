package main

import (
	"log"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load user database config: %v", err)
	}

	if err := postgres.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run user migrations: %v", err)
	}

	log.Println("user migrations applied")
}
