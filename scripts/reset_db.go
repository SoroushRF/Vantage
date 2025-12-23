package main

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "audit.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	_, err = db.Exec("DROP TABLE IF EXISTS interaction_logs")
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Table dropped successfully")
}
