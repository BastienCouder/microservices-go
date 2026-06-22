.RECIPEPREFIX := >

START_URL ?= https://www.nike.com/fr
OUTPUT_DIR ?= output
DB_FILE ?= $(OUTPUT_DIR)/crawl.sqlite
CONTENT_DIR ?= $(OUTPUT_DIR)/content

OBSCURA_IMAGE ?= h4ckf0r0day/obscura
OBSCURA_WS ?= ws://127.0.0.1:9222/devtools/browser

BLOCK_SCRIPTS ?= 1
WRITE_CSV ?= 0
LIMIT ?= 5
DOCKER_TIMEOUT_MS ?= 45000

.PHONY: help install docker-start docker-stop docker-logs discover db-tables db-count db-list db-enabled db-disabled enable-all disable-all disable-help disable-external crawl crawl-test crawl-timeout status errors clean-db clean-content clean-all

help:
> @echo ""
> @echo "Commandes disponibles:"
> @echo ""
> @echo "  make install          Installer les dépendances Node"
> @echo "  make docker-start     Lancer Obscura Docker sur le port 9222"
> @echo "  make docker-stop      Stopper Obscura Docker"
> @echo "  make docker-logs      Voir les logs Docker Obscura"
> @echo ""
> @echo "  make discover         Extraire les URLs et les enregistrer en SQLite"
> @echo "  make db-tables        Voir les tables SQLite"
> @echo "  make db-count         Compter les URLs"
> @echo "  make db-list          Lister les 30 premières URLs"
> @echo "  make db-enabled       Voir les URLs activées"
> @echo "  make db-disabled      Voir les URLs désactivées"
> @echo ""
> @echo "  make enable-all       Activer toutes les URLs"
> @echo "  make disable-all      Désactiver toutes les URLs"
> @echo "  make disable-help     Désactiver les URLs /help"
> @echo "  make disable-external Désactiver agreementservice, sheerid, urldefense"
> @echo ""
> @echo "  make crawl            Crawler toutes les URLs enabled=1"
> @echo "  make crawl-test       Crawler seulement LIMIT URLs, défaut LIMIT=5"
> @echo "  make crawl-timeout    Crawler avec timeout Docker plus long"
> @echo ""
> @echo "  make status           Voir le résumé de la base"
> @echo "  make errors           Voir les erreurs de crawl"
> @echo ""
> @echo "  make clean-db         Supprimer la base SQLite"
> @echo "  make clean-content    Supprimer les fichiers HTML/Markdown"
> @echo "  make clean-all        Supprimer output complet"
> @echo ""

install:
> npm install puppeteer-core better-sqlite3

docker-start:
> docker rm -f obscura 2>/dev/null || true
> docker run -d --name obscura -p 127.0.0.1:9222:9222 $(OBSCURA_IMAGE)

docker-stop:
> docker rm -f obscura 2>/dev/null || true

docker-logs:
> docker logs -f obscura

discover:
> mkdir -p $(OUTPUT_DIR)
> OBSCURA_WS=$(OBSCURA_WS) BLOCK_SCRIPTS=$(BLOCK_SCRIPTS) WRITE_CSV=$(WRITE_CSV) node discover-urls-db.js $(START_URL) $(OUTPUT_DIR) $(DB_FILE)

db-tables:
> sqlite3 $(DB_FILE) ".tables"

db-count:
> sqlite3 $(DB_FILE) "SELECT COUNT(*) AS total FROM pages;"

db-list:
> sqlite3 $(DB_FILE) "SELECT id, enabled, title, url FROM pages ORDER BY id LIMIT 30;"

db-enabled:
> sqlite3 $(DB_FILE) "SELECT id, title, url FROM pages WHERE enabled = 1 ORDER BY id LIMIT 50;"

db-disabled:
> sqlite3 $(DB_FILE) "SELECT id, title, url FROM pages WHERE enabled = 0 ORDER BY id LIMIT 50;"

enable-all:
> sqlite3 $(DB_FILE) "UPDATE pages SET enabled = 1;"

disable-all:
> sqlite3 $(DB_FILE) "UPDATE pages SET enabled = 0;"

disable-help:
> sqlite3 $(DB_FILE) "UPDATE pages SET enabled = 0 WHERE url LIKE '%/help%';"

disable-external:
> sqlite3 $(DB_FILE) "UPDATE pages SET enabled = 0 WHERE url LIKE '%agreementservice%' OR url LIKE '%sheerid%' OR url LIKE '%urldefense%';"

crawl:
> mkdir -p $(CONTENT_DIR)
> OBSCURA_IMAGE=$(OBSCURA_IMAGE) DOCKER_TIMEOUT_MS=$(DOCKER_TIMEOUT_MS) node crawl-enabled-obscura.js $(DB_FILE) $(CONTENT_DIR)

crawl-test:
> mkdir -p $(CONTENT_DIR)
> OBSCURA_IMAGE=$(OBSCURA_IMAGE) DOCKER_TIMEOUT_MS=$(DOCKER_TIMEOUT_MS) LIMIT=$(LIMIT) node crawl-enabled-obscura.js $(DB_FILE) $(CONTENT_DIR)

crawl-timeout:
> mkdir -p $(CONTENT_DIR)
> OBSCURA_IMAGE=$(OBSCURA_IMAGE) DOCKER_TIMEOUT_MS=90000 node crawl-enabled-obscura.js $(DB_FILE) $(CONTENT_DIR)

status:
> sqlite3 $(DB_FILE) "SELECT enabled, COUNT(*) FROM pages GROUP BY enabled;"
> sqlite3 $(DB_FILE) "SELECT last_crawl_ok, COUNT(*) FROM pages GROUP BY last_crawl_ok;"
> sqlite3 $(DB_FILE) "SELECT COUNT(*) AS crawls FROM page_crawls;"

errors:
> sqlite3 $(DB_FILE) "SELECT p.id, p.url, p.last_error FROM pages p WHERE p.last_crawl_ok = 0 LIMIT 30;"

clean-db:
> rm -f $(DB_FILE) $(DB_FILE)-wal $(DB_FILE)-shm

clean-content:
> rm -rf $(CONTENT_DIR)

clean-all:
> rm -rf $(OUTPUT_DIR)
