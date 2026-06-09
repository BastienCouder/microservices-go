package main

import (
	"log"

	analysisstate "github.com/bastiencouder/microservices-go/services/analysis-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load analysis database config: %v", err)
	}

	if err := analysisstate.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run analysis migrations: %v", err)
	}

	log.Println("analysis migrations applied")
}
