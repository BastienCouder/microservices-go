# CI/CD et commandes production

Ce document explique :

- comment lancer et configurer la CI/CD GitHub Actions
- comment utiliser les commandes `make prod*` et `make deploy-prod*`

## Vue d'ensemble

Le repo a aujourd'hui deux mécanismes différents pour la production :

- `make prod*` : lance la stack de production en local avec Docker Compose
- `make deploy-prod*` : déploie sur le serveur distant via Ansible
- GitHub Actions : valide Ansible puis déclenche le déploiement automatiquement sur `main`

En pratique :

- pour tester une stack prod localement, utilise `make prod*`
- pour déployer sur le vrai serveur, utilise `make deploy-prod*` ou le workflow GitHub

## CI/CD GitHub Actions

### Workflows

- CI backend : [.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml)
- CD production : [.github/workflows/deploy-production.yml](../.github/workflows/deploy-production.yml)

### Ce que fait le workflow de déploiement

Le workflow `deploy-production` :

1. exécute un `ansible-playbook --syntax-check`
2. se connecte au serveur via SSH
3. lance le playbook [ansible/playbooks/deploy.yml](../ansible/playbooks/deploy.yml)
4. déploie soit toute la stack, soit un seul service selon les fichiers modifiés

### Secrets GitHub nécessaires

À créer dans `Settings > Secrets and variables > Actions` :

- `PRODUCTION_SSH_PRIVATE_KEY`
  La clé privée SSH utilisée par GitHub Actions pour se connecter au serveur.
- `PRODUCTION_KNOWN_HOSTS`
  Le contenu de `ssh-keyscan 164.132.40.184`.
- `PRODUCTION_BECOME_PASSWORD`
  Le mot de passe `sudo` utilisé par Ansible avec `become: true`.

### Déclenchement automatique

Le workflow se lance automatiquement sur `push` vers `main`.

Comportement actuel :

- seulement `services/billing-service/**` modifié : déploie `billing-service`
- seulement `apps/app/**` modifié : déploie `app`
- seulement `apps/web/**` modifié : déploie `web`
- plusieurs zones modifiées : déploiement complet
- fichiers infra/Ansible/Compose modifiés : déploiement complet

### Déclenchement manuel

Le workflow peut aussi être lancé manuellement via `workflow_dispatch`.

Dans GitHub Actions :

1. ouvrir `Actions`
2. choisir `deploy-production`
3. cliquer sur `Run workflow`
4. renseigner éventuellement l'input `service`

Valeurs utiles pour `service` :

- `all`
- `app`
- `web`
- `billing-service`
- `api-gateway`
- `project-service`

Si `service=all`, toute la stack est redéployée.

Si `service=billing-service`, seul ce service est redéployé.

### Exemples CI/CD

#### Modifier seulement `apps/app`

Si le push sur `main` contient uniquement des changements dans `apps/app/**`, la CI/CD déploie seulement `app`.

#### Modifier seulement `services/billing-service`

Si le push sur `main` contient uniquement des changements dans `services/billing-service/**`, la CI/CD déploie seulement `billing-service`.

#### Modifier `billing-service` et `docker-compose.yml`

Le workflow repasse en déploiement complet, car la modification touche aussi l'infra.

## Déploiement Ansible manuel

L'inventaire et la config prod sont ici :

- [ansible/inventory/production.ini](../ansible/inventory/production.ini)
- [ansible/group_vars/production.yml](../ansible/group_vars/production.yml)
- [ansible/playbooks/deploy.yml](../ansible/playbooks/deploy.yml)

### Vérifier l'accès au serveur

```bash
make prod-ping
```

### Vérifier la syntaxe Ansible

```bash
make prod-check
```

### Déployer toute la prod

```bash
make deploy-prod
```

### Déployer seulement le front

```bash
make deploy-prod-front
```

### Déployer seulement l'app

```bash
make deploy-prod-app
```

### Déployer seulement le web

```bash
make deploy-prod-web
```

### Déployer seulement les services backend

```bash
make deploy-prod-services
```

### Déployer un seul service

```bash
make deploy-prod-service SERVICE=billing-service
```

Exemples :

```bash
make deploy-prod-service SERVICE=api-gateway
make deploy-prod-service SERVICE=project-service
make deploy-prod-service SERVICE=billing-service
```

## Commandes `make prod*`

Les commandes `make prod*` n'utilisent pas Ansible.

Elles lancent une stack de production localement avec Docker Compose, en utilisant :

- `docker-compose.yml`
- `docker-compose.secrets.generated.yml`

Par défaut, elles utilisent le projet Compose `microservices-go-prod`.

### Prérequis

Créer les fichiers de secrets si besoin :

```bash
make secrets-init
```

Vérifier que les secrets obligatoires sont remplis :

```bash
make secrets-check
```

## Commandes de base

### Lancer toute la stack prod locale

```bash
make prod
```

### Rebuild + relance complète

```bash
make prod-build
```

### Arrêter la stack prod locale

```bash
make prod-down
```

### Voir les logs

Tous les services :

```bash
make prod-logs
```

Un seul service :

```bash
make prod-logs SERVICE=billing-service
```

### Redémarrer un service déjà lancé

```bash
make prod-restart SERVICE=billing-service
```

### Rebuild + restart d'un seul service

```bash
make prod-rebuild SERVICE=billing-service
```

## Commandes ciblées frontend

### Lancer seulement `web` et `app`

```bash
make prod-front
```

### Lancer seulement `app`

```bash
make prod-app
```

### Lancer seulement `web`

```bash
make prod-web
```

## Commandes ciblées backend

### Lancer les migrations prod puis les services backend

```bash
make prod-services
```

### Lancer toutes les migrations prod

```bash
make prod-migrate
```

Cette commande démarre notamment :

- `postgres`
- `postgres-bootstrap`
- `kratos-migrate`
- `user-migrate`
- `organizations-migrate`
- `permission-migrate`
- `billing-migrate`
- `project-migrate`
- `analysis-migrate`
- `ia-migrate`
- `notification-migrate`

## Profils spécialisés

### Documentation

```bash
make prod-doc
```

### Email

```bash
make prod-email
```

## Cas d'usage rapides

### J'ai modifié seulement `billing-service`

En local :

```bash
make prod-rebuild SERVICE=billing-service
```

Sur le serveur :

```bash
make deploy-prod-service SERVICE=billing-service
```

Via GitHub Actions :

- push sur `main` avec seulement `services/billing-service/**`
- ou lancement manuel du workflow avec `service=billing-service`

### J'ai modifié seulement `app`

En local :

```bash
make prod-app
```

Sur le serveur :

```bash
make deploy-prod-app
```

Via GitHub Actions :

- push sur `main` avec seulement `apps/app/**`
- ou lancement manuel du workflow avec `service=app`

### J'ai modifié l'infra ou plusieurs services

Faire un déploiement complet :

```bash
make deploy-prod
```

ou lancer le workflow GitHub avec `service=all`.

## Recommandations

- utilise `make prod*` pour tester localement un comportement proche de la prod
- utilise `make deploy-prod*` pour piloter le serveur manuellement
- utilise GitHub Actions pour les déploiements automatiques sur `main`
- si tu touches `docker-compose.yml`, Ansible, Nginx ou plusieurs services, préfère un déploiement complet
