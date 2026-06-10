package main

import (
	"log"

	billingrepo "github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load billing database config: %v", err)
	}

	if err := billingrepo.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run billing migrations: %v", err)
	}

	log.Println("billing migrations applied")
}
