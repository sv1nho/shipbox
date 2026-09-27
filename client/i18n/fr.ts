const HOME_LEAD =
  'Create and download PDF shipping labels for Bpost and PostNL in seconds. ' +
  'Fill in the form, choose your carrier and language, and your label is ready.'

const SIGN_IN_LEAD =
  'Sign in to track your returns from drop-off to refund. ' +
  'Generating labels stays free and needs no account.'

const SIGN_IN_NOTE =
  'No password is ever stored. Signing in only shares your name, ' +
  'email address and profile picture with ShipBox.'

const OFFER_PITCH =
  'Add it to your list and ShipBox will keep the label, count the days ' +
  'and warn you when the store sits on it.'

const OFFER_LANDED =
  'It is on your list. Record the drop-off there once the parcel is gone, ' +
  'and find the label again whenever you need it.'

const STORE_NOTE =
  'Days are counted from the day the store received the parcel, or from the ' +
  'drop-off when it never arrived, averaged over {measured} decided returns. ' +
  'A store is listed once it has decided on something.'

const STORE_SPEED = '{store} takes {days} days on average, over {measured} timed returns'

const NO_ADDRESS =
  'No address on file for {store}. Copy the message into their contact form, ' +
  'or add the address when you add the store.'

const CANNOT_TELL =
  'ShipBox cannot tell whether the message went out. Say so and the row will show it.'

const WHY_AN_ADDRESS =
  'ShipBox writes to this address when a return sits too long. ' +
  'It is the whole point of keeping a store.'

const SHIPPING_LATE =
  'The parcel was dropped off {span} ago and the store has still not received it. ' +
  'Time to contact them.'

export const FRENCH: Record<string, string> = {
  // ── The frame ──
  'Read this site in {language}': 'Lire ce site en {language}',
  Form: 'Formulaire',
  Shipments: 'Suivis',
  Dashboard: 'Tableau de bord',
  'Sign in': 'Se connecter',
  'Sign out': 'Se déconnecter',
  '— Bpost & PostNL shipping labels, 100% free': '— Étiquettes Bpost et PostNL, 100% gratuit',
  '© 2026 ShipBox — All rights reserved': '© 2026 ShipBox — Tous droits réservés',

  // ── Home ──
  [HOME_LEAD]:
    'Créez et téléchargez des étiquettes PDF pour Bpost et PostNL en quelques secondes. ' +
    'Remplissez le formulaire, choisissez votre transporteur et votre langue, ' +
    'et votre étiquette est prête.',
  'Belgium · Netherlands · Germany': 'Belgique · Pays-Bas · Allemagne',
  '100% free': '100% gratuit',
  'Go to the form': 'Aller au formulaire',

  // ── Signing in ──
  'Checking your session…': 'Vérification de votre session…',
  'Loading sign-in options…': 'Chargement des options de connexion…',
  [SIGN_IN_LEAD]:
    'Connectez-vous pour suivre vos retours, du dépôt au remboursement. ' +
    'La création d’étiquettes reste gratuite et sans compte.',
  'Sign-in was cancelled or refused. You can try again.':
    'La connexion a été annulée ou refusée. Vous pouvez réessayer.',
  'No sign-in provider is configured on this server.':
    'Aucun fournisseur de connexion n’est configuré sur ce serveur.',
  'Continue with Google': 'Continuer avec Google',
  'Continue with GitHub': 'Continuer avec GitHub',
  'Redirecting…': 'Redirection…',
  'Sign-in failed, please try again.': 'La connexion a échoué, veuillez réessayer.',
  [SIGN_IN_NOTE]:
    'Aucun mot de passe n’est conservé. La connexion ne partage que votre nom, ' +
    'votre adresse e-mail et votre photo de profil avec ShipBox.',

  // ── The label form ──
  Sender: 'Expéditeur',
  Recipient: 'Destinataire',
  Individual: 'Particulier',
  Company: 'Entreprise',
  'Fill {party} with random data': 'Remplir {party} avec des données au hasard',
  sender: 'l’expéditeur',
  recipient: 'le destinataire',
  'Company name': 'Nom de l’entreprise',
  'First name': 'Prénom',
  'Last name': 'Nom',
  'A first name is required.': 'Un prénom est obligatoire.',
  'A last name is required.': 'Un nom est obligatoire.',
  'A company name is required.': 'Un nom d’entreprise est obligatoire.',
  Address: 'Adresse',
  'An address is required.': 'Une adresse est obligatoire.',
  'A city is required.': 'Une ville est obligatoire.',
  'Postal code': 'Code postal',
  City: 'Ville',
  Language: 'Langue',
  French: 'Français',
  Dutch: 'Néerlandais',
  English: 'Anglais',
  Carrier: 'Transporteur',
  'Tracking Number': 'Numéro de suivi',
  'Generate Label': 'Générer l’étiquette',
  'Unknown error': 'Erreur inconnue',

  // ── The label preview ──
  'Label Preview': 'Aperçu de l’étiquette',
  'Tracking:': 'Suivi :',
  Close: 'Fermer',
  'Add to tracking': 'Ajouter au suivi',
  'Download PDF': 'Télécharger le PDF',

  // ── Offering to track a label ──
  'Keep an eye on this return': 'Gardez un œil sur ce retour',
  'to follow this parcel from the drop-off to the refund.':
    'pour suivre ce colis du dépôt au remboursement.',
  [OFFER_LANDED]:
    'Il est dans votre liste. Enregistrez-y le dépôt une fois le colis parti, ' +
    'et retrouvez l’étiquette quand vous en avez besoin.',
  'Looking for this parcel in your list…': 'Recherche de ce colis dans votre liste…',
  'You already track this parcel.': 'Vous suivez déjà ce colis.',
  'Open it': 'L’ouvrir',
  [OFFER_PITCH]:
    'Ajoutez-le à votre liste et ShipBox conservera l’étiquette, comptera les jours ' +
    'et vous préviendra si le magasin traîne.',
  'Stay on the form': 'Rester sur le formulaire',
  'Not now': 'Pas maintenant',
  'Open my shipments': 'Ouvrir mes suivis',

  // ── The shipment list ──
  '1 shipment': '1 suivi',
  '{count} shipments': '{count} suivis',
  'Updating the list': 'Mise à jour de la liste',
  Import: 'Importer',
  'Track a return': 'Suivre un retour',
  'Try again': 'Réessayer',
  'Loading your shipments…': 'Chargement de vos suivis…',
  'No shipment matches these filters.': 'Aucun suivi ne correspond à ces filtres.',
  'Track a parcel you have already sent back, or make its label first.':
    'Suivez un colis déjà renvoyé, ou créez d’abord son étiquette.',
  'Make a label': 'Créer une étiquette',
  'Recorded: {step}': 'Enregistré : {step}',
  'Shipment archived.': 'Suivi archivé.',
  'Shipment put back in the list.': 'Suivi remis dans la liste.',
  Undo: 'Annuler',
  'You are not tracking any shipment yet.': 'Vous ne suivez encore aucun retour.',
  'Page {page} of {pages}': 'Page {page} sur {pages}',
  Pages: 'Pages',
  'Previous page': 'Page précédente',
  'Next page': 'Page suivante',

  // ── Filters ──
  Active: 'Actifs',
  Archived: 'Archivés',
  All: 'Tous',
  Archive: 'Archiver',
  'Needs attention': 'À relancer',
  'Needs attention, {count} waiting': 'À relancer, {count} en attente',
  'Needs attention, nothing waiting': 'À relancer, rien en attente',
  Filters: 'Filtres',
  Search: 'Rechercher',
  'Tracking number, store, order number…': 'Numéro de suivi, magasin, numéro de commande…',
  Store: 'Magasin',
  'All stores': 'Tous les magasins',
  'All carriers': 'Tous les transporteurs',
  Status: 'Statut',
  'All statuses': 'Tous les statuts',
  'Not decided yet': 'Sans décision',
  'Sort by': 'Trier par',
  'Return date': 'Date de retour',
  'Drop-off date': 'Date de dépôt',
  'Reception date': 'Date de réception',
  'Decision date': 'Date de décision',
  Amount: 'Montant',
  Descending: 'Décroissant',
  Ascending: 'Croissant',
  'Clear filters': 'Vider les filtres',
  'Export CSV': 'Exporter en CSV',
  'Export JSON': 'Exporter en JSON',

  // ── A row ──
  Pending: 'En attente',
  'Dropped off': 'Déposé',
  Received: 'Reçu',
  Refunded: 'Remboursé',
  Rejected: 'Refusé',
  Requested: 'Demandé',
  Decided: 'Décidé',
  'Track this parcel on {carrier}': 'Suivre ce colis sur {carrier}',
  '1 day': '1 jour',
  '{count} days': '{count} jours',
  'Took {span}': 'A pris {span}',
  '{span} left': '{span} restants',
  'Due today': 'Échéance aujourd’hui',
  '{span} over': '{span} de retard',
  'Drop off': 'Déposer',
  Receive: 'Réceptionner',
  Decide: 'Décider',
  'Chased on {date}': 'Relancé le {date}',
  'Chase {store} about {tracking}': 'Relancer {store} au sujet de {tracking}',
  'Details for {tracking}': 'Détails de {tracking}',
  'More actions for {tracking}': 'Autres actions pour {tracking}',
  'Record the drop-off directly': 'Enregistrer directement le dépôt',
  'Record the reception directly': 'Enregistrer directement la réception',
  'Undo the drop-off': 'Annuler le dépôt',
  'Undo the reception': 'Annuler la réception',
  'Undo the decision': 'Annuler la décision',
  'Record the decision directly': 'Enregistrer directement la décision',
  'Change the decision to refunded': 'Changer la décision en remboursé',
  'Change the decision to rejected': 'Changer la décision en refusé',
  'Download the label again': 'Retélécharger l’étiquette',
  'Put back in the list': 'Remettre dans la liste',
  'Delete for good': 'Supprimer définitivement',

  // ── Alerts on a row ──
  'The store has had this parcel for {span} without deciding. Time to chase them.':
    'Le magasin a ce colis depuis {span} sans décider. Il est temps de le relancer.',
  [SHIPPING_LATE]:
    'Le colis a été déposé il y a {span} et le magasin ne l’a toujours pas reçu. ' +
    'Il est temps de le contacter.',
  'The label expired {span} ago and can no longer be used.':
    'L’étiquette a expiré il y a {span} et ne peut plus servir.',
  'The label expires today. Drop the parcel off now.':
    'L’étiquette expire aujourd’hui. Déposez le colis maintenant.',
  'The label expires in {span}. Drop the parcel off now.':
    'L’étiquette expire dans {span}. Déposez le colis maintenant.',

  // ── Adding a return ──
  'Tracking number': 'Numéro de suivi',
  'A tracking number is required.': 'Un numéro de suivi est obligatoire.',
  'This is not a {carrier} number: {hint}.': 'Ce n’est pas un numéro {carrier} : {hint}.',
  'Say which store the parcel goes back to.': 'Indiquez à quel magasin le colis retourne.',
  'Add a store': 'Ajouter un magasin',
  'An amount like 49.99 is required.': 'Un montant comme 49,99 est obligatoire.',
  'An amount cannot be more than 1,000,000.': 'Un montant ne peut pas dépasser 1 000 000.',
  'A postal code is required.': 'Un code postal est obligatoire.',
  Country: 'Pays',
  'Return requested on': 'Retour demandé le',
  'Pick the day you asked for the return.': 'Choisissez le jour où vous avez demandé le retour.',
  'Where is it already?': 'Où en est-il ?',
  'Dropped off on': 'Déposé le',
  'Pick the day you dropped the parcel off.': 'Choisissez le jour où vous avez déposé le colis.',
  'Received on': 'Reçu le',
  'Pick the day the store received it.': 'Choisissez le jour où le magasin l’a reçu.',
  'The store never received it': 'Le magasin ne l’a jamais reçu',
  'Decided on': 'Décidé le',
  'Pick the day the store decided.': 'Choisissez le jour où le magasin a décidé.',
  'This cannot be earlier than the step before it.':
    'Ceci ne peut pas être antérieur à l’étape précédente.',
  'Refused because (optional)': 'Refusé parce que (facultatif)',
  'Order number': 'Numéro de commande',
  'The store searches by its own order number, not by the tracking number.':
    'Le magasin cherche avec son propre numéro de commande, pas avec le numéro de suivi.',
  'Note (optional)': 'Note (facultatif)',
  Cancel: 'Annuler',
  'Adding…': 'Ajout…',
  'Track it': 'Le suivre',

  // ── A new store ──
  Name: 'Nom',
  'A name is required.': 'Un nom est obligatoire.',
  'Customer service email': 'E-mail du service client',
  [WHY_AN_ADDRESS]:
    'ShipBox écrit à cette adresse quand un retour traîne. ' +
    'C’est tout l’intérêt d’enregistrer un magasin.',
  'An email address is required.': 'Une adresse e-mail est obligatoire.',
  'Add the store': 'Ajouter le magasin',

  // ── Recording a step ──
  'When did the store receive it?': 'Quand le magasin l’a-t-il reçu ?',
  'Without it the waiting time of this store cannot be measured.':
    'Sans elle, le temps d’attente de ce magasin ne peut pas être mesuré.',
  'Pick the day it was received.': 'Choisissez le jour de la réception.',
  'This cannot be earlier than the drop-off.': 'Ceci ne peut pas être antérieur au dépôt.',
  'The wait will be counted from the drop-off instead of the reception.':
    'L’attente sera comptée depuis le dépôt plutôt que depuis la réception.',
  'On which day?': 'Quel jour ?',
  'Pick a day.': 'Choisissez un jour.',
  'This cannot be earlier than the previous step.':
    'Ceci ne peut pas être antérieur à l’étape précédente.',
  'Why was it refused? (optional)': 'Pourquoi a-t-il été refusé ? (facultatif)',
  'Saving…': 'Enregistrement…',
  Confirm: 'Confirmer',

  // ── Chasing a store ──
  'Chase {store}': 'Relancer {store}',
  [NO_ADDRESS]:
    'Aucune adresse enregistrée pour {store}. Copiez le message dans leur formulaire ' +
    'de contact, ou ajoutez l’adresse au moment d’ajouter le magasin.',
  'To {address}': 'À {address}',
  Subject: 'Objet',
  Message: 'Message',
  '{part} copied': '{part} copié',
  'Copy the {part}': 'Copier {part}',
  'The clipboard is not available here. Select the text and copy it yourself.':
    'Le presse-papiers n’est pas disponible ici. Sélectionnez le texte et copiez-le vous-même.',
  [CANNOT_TELL]:
    'ShipBox ne peut pas savoir si le message est parti. Dites-le et la ligne l’affichera.',
  'Not yet': 'Pas encore',
  'I sent it': 'Je l’ai envoyé',
  'Open in my mail app': 'Ouvrir dans ma messagerie',

  // ── Details of a return ──
  'Shipment details': 'Détails du suivi',
  'Customer service': 'Service client',
  'Sent to': 'Envoyé à',
  'Return requested': 'Retour demandé',
  'Store chased': 'Magasin relancé',
  Reception: 'Réception',
  'Never reached the store': 'N’est jamais arrivé au magasin',
  'Added to ShipBox': 'Ajouté à ShipBox',
  'Since the request': 'Depuis la demande',
  'Since the drop-off': 'Depuis le dépôt',
  'Since the store received it': 'Depuis la réception par le magasin',
  'Waited for the decision': 'Attente de la décision',
  'The whole return took': 'Le retour entier a pris',
  'Refused because': 'Refusé parce que',
  Note: 'Note',
  'Stored label': 'Étiquette conservée',
  'Yes, the PDF can be rebuilt': 'Oui, le PDF peut être reconstruit',
  'No, added by hand': 'Non, ajouté à la main',
  'Last change': 'Dernière modification',
  'The dates must follow the request, drop-off, reception then decision order.':
    'Les dates doivent suivre l’ordre demande, dépôt, réception puis décision.',
  'A date already recorded cannot be removed here. Undo the step instead.':
    'Une date déjà enregistrée ne peut pas être retirée ici. Annulez plutôt l’étape.',
  Edit: 'Modifier',
  Save: 'Enregistrer',

  // ── Deleting a shipment ──
  'Delete this shipment for good?': 'Supprimer définitivement ce suivi ?',
  'This cannot be undone. You will lose:': 'C’est irréversible. Vous perdrez :',
  'the shipment and everything you recorded about it':
    'le suivi et tout ce que vous y avez consigné',
  'its drop-off, reception and decision dates':
    'ses dates de dépôt, de réception et de décision',
  'its stored label, so the PDF can never be downloaded again':
    'son étiquette enregistrée, le PDF ne pourra plus jamais être téléchargé',
  'To take it out of your list without losing any of that, archive it instead.':
    'Pour le retirer de votre liste sans rien perdre de tout cela, archivez-le plutôt.',
  'Deleting…': 'Suppression…',

  // ── Importing ──
  'Import returns': 'Importer des retours',
  'A CSV or JSON file, laid out like the export. Each row needs at least {fields}.':
    'Un fichier CSV ou JSON, présenté comme l’export. Chaque ligne demande au moins {fields}.',
  File: 'Fichier',
  '1 return': '1 retour',
  '{count} returns': '{count} retours',
  '{file} holds {count}.': '{file} contient {count}.',
  'Imported {imported} of {total}.': '{imported} importés sur {total}.',
  '1 row was refused:': '1 ligne a été refusée :',
  '{count} rows were refused:': '{count} lignes ont été refusées :',
  'Row {row}: {reason}': 'Ligne {row} : {reason}',
  'The columns an export writes': 'Les colonnes que l’export écrit',
  'Importing…': 'Import…',

  // ── The dashboard ──
  'Counting your returns…': 'Comptage de vos retours…',
  'Returns refunded': 'Retours remboursés',
  'No decision recorded yet.': 'Aucune décision enregistrée pour l’instant.',
  '{refunded} of {decided} the stores decided on.':
    '{refunded} sur {decided} tranchés par les magasins.',
  Recovered: 'Récupéré',
  '{count} refunded': '{count} remboursés',
  Lost: 'Perdu',
  '{count} refused': '{count} refusés',
  'Nothing to chase today': 'Rien à relancer aujourd’hui',
  'Open the list': 'Ouvrir la liste',
  'How each store answers': 'Comment répond chaque magasin',
  'No store has decided on a return yet. Record a decision and this table fills in.':
    'Aucun magasin n’a encore tranché un retour. Enregistrez une décision et ce tableau se remplira.',
  'Days to decide': 'Jours pour décider',
  Days: 'Jours',
  '{decided} of {returns} decided': '{decided} tranchés sur {returns}',
  [STORE_SPEED]: '{store} met {days} jours en moyenne, sur {measured} retours chronométrés',
  '{store} refunded {refunded} of {decided} decided returns':
    '{store} a remboursé {refunded} des {decided} retours tranchés',
  [STORE_NOTE]:
    'Les jours sont comptés depuis la réception du colis par le magasin, ou depuis le dépôt ' +
    'quand il n’est jamais arrivé, en moyenne sur {measured} retours tranchés. ' +
    'Un magasin apparaît dès qu’il a tranché quelque chose.',
}
