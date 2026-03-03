package main

import (
	"log"

	attributionrepo "github.com/bastiencouder/microservices-go/services/attribution-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load attribution database config: %v", err)
	}

	if err := attributionrepo.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run attribution migrations: %v", err)
	}

	log.Println("attribution migrations applied")
}
