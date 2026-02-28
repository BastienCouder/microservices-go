package main

import (
	"log"

	permissionrepo "github.com/bastiencouder/microservices-go/services/permission-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load permission database config: %v", err)
	}

	if err := permissionrepo.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run permission migrations: %v", err)
	}

	log.Println("permission migrations applied")
}
