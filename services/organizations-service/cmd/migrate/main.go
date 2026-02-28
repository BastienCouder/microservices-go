package main

import (
	"log"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load organizations database config: %v", err)
	}

	if err := postgres.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	log.Println("organizations migrations applied")
}
