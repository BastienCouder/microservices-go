package main

import (
	"log"

	iastate "github.com/bastiencouder/microservices-go/services/ia-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/ia-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load ia database config: %v", err)
	}

	if err := iastate.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run ia migrations: %v", err)
	}

	log.Println("ia migrations applied")
}
