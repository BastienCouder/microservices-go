# Base de données SQLite

Le projet utilise une base SQLite pour stocker les URLs découvertes, choisir quelles pages crawler, puis enregistrer les résultats du crawl Obscura.

Base par défaut :

```bash
output/crawl.sqlite
```

## Tables

La base contient 3 tables principales :

```txt
pages
crawl_runs
page_crawls
```

---

## 1. Table `pages`

La table `pages` contient toutes les URLs découvertes par le script `discover-urls-db.js`.

Chaque URL peut être activée ou désactivée avec le champ `enabled`.

### Colonnes

| Colonne           |    Type | Description                                                  |
| ----------------- | ------: | ------------------------------------------------------------ |
| `id`              | INTEGER | Identifiant unique de la page                                |
| `url`             |    TEXT | URL unique de la page                                        |
| `title`           |    TEXT | Titre ou texte du lien trouvé                                |
| `source_url`      |    TEXT | URL de départ depuis laquelle le lien a été trouvé           |
| `enabled`         | INTEGER | `1` = activée, `0` = désactivée                              |
| `first_seen_at`   |    TEXT | Date de première découverte                                  |
| `last_seen_at`    |    TEXT | Date de dernière découverte                                  |
| `updated_at`      |    TEXT | Date de dernière mise à jour                                 |
| `last_crawled_at` |    TEXT | Date du dernier crawl                                        |
| `last_crawl_ok`   | INTEGER | `1` = dernier crawl OK, `0` = erreur, `NULL` = jamais crawlé |
| `last_error`      |    TEXT | Dernière erreur de crawl                                     |

### Rôle

Cette table sert de file d’attente principale.

Le script de découverte remplit cette table.

Le script de crawl lit uniquement les lignes avec :

```sql
enabled = 1
```

---

## 2. Table `crawl_runs`

La table `crawl_runs` enregistre chaque lancement du script de crawl.

### Colonnes

| Colonne        |    Type | Description                     |
| -------------- | ------: | ------------------------------- |
| `id`           | INTEGER | Identifiant unique du run       |
| `started_at`   |    TEXT | Date de début du crawl          |
| `finished_at`  |    TEXT | Date de fin du crawl            |
| `db_file`      |    TEXT | Chemin vers la base SQLite      |
| `output_dir`   |    TEXT | Dossier de sortie HTML/Markdown |
| `docker_image` |    TEXT | Image Docker Obscura utilisée   |

### Rôle

Cette table permet de savoir quand un crawl a été lancé et avec quelle configuration.

---

## 3. Table `page_crawls`

La table `page_crawls` contient les résultats détaillés de chaque crawl.

Une même URL peut avoir plusieurs entrées dans cette table si elle est crawlée plusieurs fois.

### Colonnes

| Colonne          |    Type | Description                                 |
| ---------------- | ------: | ------------------------------------------- |
| `id`             | INTEGER | Identifiant unique du résultat              |
| `run_id`         | INTEGER | Référence vers `crawl_runs.id`              |
| `page_id`        | INTEGER | Référence vers `pages.id`                   |
| `url`            |    TEXT | URL crawlée                                 |
| `ok`             | INTEGER | `1` = succès, `0` = erreur                  |
| `html`           |    TEXT | Contenu HTML récupéré par Obscura           |
| `markdown`       |    TEXT | Contenu Markdown récupéré par Obscura       |
| `html_file`      |    TEXT | Chemin du fichier HTML écrit sur disque     |
| `markdown_file`  |    TEXT | Chemin du fichier Markdown écrit sur disque |
| `html_chars`     | INTEGER | Nombre de caractères HTML                   |
| `markdown_chars` | INTEGER | Nombre de caractères Markdown               |
| `error`          |    TEXT | Message d’erreur si le crawl échoue         |
| `crawled_at`     |    TEXT | Date du crawl                               |

### Rôle

Cette table stocke l’historique complet des résultats.

Elle permet de garder plusieurs versions du crawl d’une même page.

---

## Relations

```txt
pages 1 ──── n page_crawls
crawl_runs 1 ──── n page_crawls
```

Une page peut être crawlée plusieurs fois.

Un run peut contenir plusieurs pages crawlées.

---

## Workflow

### 1. Découvrir les URLs

```bash
make discover
```

Cela remplit la table `pages`.

Par défaut, les nouvelles URLs sont enregistrées avec :

```sql
enabled = 1
```

---

### 2. Voir les URLs en base

```bash
make db-list
```

Ou directement :

```bash
sqlite3 output/crawl.sqlite \
"SELECT id, enabled, title, url FROM pages ORDER BY id LIMIT 30;"
```

---

### 3. Désactiver certaines URLs

Désactiver une URL précise :

```bash
sqlite3 output/crawl.sqlite \
"UPDATE pages SET enabled = 0 WHERE id = 12;"
```

Désactiver les pages d’aide :

```bash
make disable-help
```

Désactiver les URLs externes inutiles :

```bash
make disable-external
```

Désactiver toutes les URLs :

```bash
make disable-all
```

Réactiver toutes les URLs :

```bash
make enable-all
```

---

### 4. Crawler seulement les URLs activées

```bash
make crawl
```

Pour tester seulement quelques URLs :

```bash
make crawl-test LIMIT=5
```

Le script `crawl-enabled-obscura.js` ne crawl que les pages avec :

```sql
enabled = 1
```

---

## Requêtes utiles

### Compter toutes les URLs

```sql
SELECT COUNT(*) FROM pages;
```

### Compter les URLs activées et désactivées

```sql
SELECT enabled, COUNT(*)
FROM pages
GROUP BY enabled;
```

### Voir les URLs activées

```sql
SELECT id, title, url
FROM pages
WHERE enabled = 1
ORDER BY id;
```

### Voir les URLs désactivées

```sql
SELECT id, title, url
FROM pages
WHERE enabled = 0
ORDER BY id;
```

### Voir les derniers résultats de crawl

```sql
SELECT url, ok, html_chars, markdown_chars, crawled_at
FROM page_crawls
ORDER BY id DESC
LIMIT 20;
```

### Voir les erreurs

```sql
SELECT url, error, crawled_at
FROM page_crawls
WHERE ok = 0
ORDER BY id DESC
LIMIT 20;
```

### Voir les pages jamais crawlées

```sql
SELECT id, enabled, url
FROM pages
WHERE last_crawled_at IS NULL
ORDER BY id;
```

### Voir les pages activées mais jamais crawlées

```sql
SELECT id, url
FROM pages
WHERE enabled = 1
AND last_crawled_at IS NULL
ORDER BY id;
```

### Voir les pages dont le dernier crawl a échoué

```sql
SELECT id, url, last_error
FROM pages
WHERE last_crawl_ok = 0
ORDER BY id;
```

### Lire le dernier Markdown d’une URL

```sql
SELECT markdown
FROM page_crawls
WHERE url = 'https://www.nike.com/fr'
AND ok = 1
ORDER BY id DESC
LIMIT 1;
```

---

## Fichiers générés

Le crawl écrit aussi les résultats sur disque :

```txt
output/content/html/
output/content/markdown/
```

La base SQLite garde les chemins dans :

```txt
page_crawls.html_file
page_crawls.markdown_file
```

---

## Commandes Makefile utiles

```bash
make install
make docker-start
make discover
make db-list
make disable-help
make disable-external
make crawl-test LIMIT=5
make crawl
make status
make errors
```

---

## Nettoyage

Supprimer seulement la base SQLite :

```bash
make clean-db
```

Supprimer seulement les fichiers HTML/Markdown :

```bash
make clean-content
```

Supprimer tout le dossier `output` :

```bash
make clean-all
```

---

## Notes

Le champ `enabled` permet de contrôler précisément ce qui sera crawlé.

Une URL désactivée reste en base, mais elle ne sera pas utilisée par `crawl-enabled-obscura.js`.

Cela permet de garder l’historique des URLs découvertes sans forcément tout crawler.

