package main

import (
	"log"

	notificationrepo "github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/repository/postgres"
	"github.com/bastiencouder/microservices-go/services/notification-service/internal/config"
)

func main() {
	databaseURL, err := config.DatabaseURLFromEnv()
	if err != nil {
		log.Fatalf("load notification database config: %v", err)
	}

	if err := notificationrepo.RunMigrations(databaseURL); err != nil {
		log.Fatalf("run notification migrations: %v", err)
	}

	log.Println("notification migrations applied")
}
