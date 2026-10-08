package main

import (
	"log"
	"os"

	"github.com/khalidsaifuddin/gymbro/backend/handler/middleware"
)

func main() {
	addr := os.Getenv("GYMBRO_HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	if err := middleware.NewRouter().Run(addr); err != nil {
		log.Fatal(err)
	}
}
