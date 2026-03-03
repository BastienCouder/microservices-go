package main

import (
	"log"

	projectstate "github.com/bastiencouder/microservices-go/services/project-service/internal/adapter/state/postgres"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load project database config: %v", err)
	}

	if err := projectstate.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run project migrations: %v", err)
	}

	log.Println("project migrations applied")
}
