# bpost-label-generator

Générateur d'étiquettes d'expédition Bpost/PostNL. Le frontend (React + Vite) vit dans
[frontend/](frontend/), le backend (Postgres + Edge Functions) dans [supabase/](supabase/).

Le projet passe d'une SPA 100% gratuite à un modèle payant : forfaits d'étiquettes (5/10/20)
achetés via Stripe, débloqués par une clé de licence envoyée par email (pas de compte
email/mot de passe). Voir `plan.md` pour le design detaillé d'origine.

## Phase 1 — Chaîne de valeur cœur (paiement → clé → email)

### Fait

- Schéma Postgres complet (`plans`, `license_keys`, `payment_events`, `generation_events`,
  `rate_limit_buckets`), RLS + grants explicites, fonctions `consume_generation`/`rl_check`.
- File d'attente `pgmq` + trigger + `pg_cron` de secours pour émettre les clés de façon asynchrone.
- 3 Edge Functions : `create-checkout-session`, `stripe-webhook`, `process-key-issuance-queue`.
- Routes frontend `/buy` et `/success`, CSP mise à jour.
- Vérifié en local de bout en bout : paiement test Stripe → webhook → clé générée → email
  accepté par Resend.
- Frontend déployé sur Vercel (statique, hors backend) pour servir de site public.

### Reste à faire

- [ ] Déployer les migrations sur le projet Supabase distant : `supabase db push`
- [ ] Déployer les Edge Functions : `supabase functions deploy`
- [ ] Configurer les secrets sur le projet distant : `supabase secrets set --env-file supabase/.env`
- [ ] Configurer les 2 secrets Vault **sur le projet distant** (`project_url` = URL Supabase
      réelle, `service_role_key` = la vraie clé service_role) — sans ça, le trigger/`pg_cron`
      qui déclenchent `process-key-issuance-queue` ne feront jamais rien.
      ⚠️ En local, `project_url` doit être `http://host.docker.internal:54321`, **pas**
      `http://127.0.0.1:54321` (depuis le conteneur Postgres, `127.0.0.1` désigne le
      conteneur lui-même, pas la machine hôte qui fait tourner `functions serve`).
- [ ] Créer l'endpoint webhook dans le dashboard Stripe (Developers → Webhooks) pointé vers
      l'URL de la fonction déployée, et remplacer `STRIPE_WEBHOOK_SECRET` par le secret de
      production (celui obtenu via `stripe listen` n'est valable qu'en local, et change à
      chaque redémarrage de `stripe listen`).
- [ ] Mettre à jour `FRONTEND_URL` avec l'URL Vercel réelle une fois les fonctions déployées.
- [ ] Vérifier/configurer un domaine d'envoi Resend : `onboarding@resend.dev` (utilisé
      actuellement) ne peut envoyer qu'à l'adresse du compte Resend lui-même, pas à de vrais
      clients.
- [ ] Reconfirmer la réception réelle de l'email en prod (le pipeline est vérifié — Resend
      accepte l'envoi — mais à revalider visuellement une fois en conditions réelles).

## Phase 2 — Rédemption et gating du quota

- Edge Functions `redeem-key`, `check-session`, câblage de `consume-generation` (déjà en base).
- Route `/redeem`, `SessionContext` (JWT en `sessionStorage`, TTL glissant 30 min).
- Modification minimale de `Form.tsx` : un appel à `consume-generation` en tête de `onSubmit`,
  avant la chaîne existante `loadSvgTemplate → buildLabelSvg → svgToPdf` qui reste inchangée.
- `QuotaBadge` dans `Layout.tsx`.
- Réponses génériques et indistinguables sur `redeem-key` (anti-énumération de clés).

## Phase 3 — Durcissement

- Rate limiting (`rl_check`, déjà en base) sur `create-checkout-session`, `redeem-key`,
  `consume-generation`/`check-session`.
- Cloudflare Turnstile sur `/buy` et `/redeem`, CSP étendue pour `challenges.cloudflare.com`.
- Dead-letter + backoff sur la queue `pgmq`, jobs `pg_cron` de nettoyage
  (`generation_events`, purge après 6-12 mois pour le RGPD).

## Phase 4 — Avant mise en prod

- Sentry (frontend + Edge Functions), alerte si un `payment_event` reste `queued` plus de
  10 minutes sans `license_key` correspondante.
- Runbook RGPD (suppression email sur demande), politique de confidentialité.
- `.github/workflows/pipeline.yml` : ajouter le déploiement (`supabase db push`,
  `supabase functions deploy`) sur `main` — la CI ne fait aujourd'hui que lint/build/test.
- Test de charge paiement→webhook→queue→email, test de concurrence sur le décompte de quota.
- Webhook Stripe basculé sur l'URL de prod, page de vente ouverte au public.
