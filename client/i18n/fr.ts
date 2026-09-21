const HOME_LEAD =
  'Create and download PDF shipping labels for Bpost and PostNL in seconds. ' +
  'Fill in the form, choose your carrier and language, and your label is ready.'

const SIGN_IN_LEAD =
  'Sign in to track your returns from drop-off to refund. ' +
  'Generating labels stays free and needs no account.'

const SIGN_IN_NOTE =
  'No password is ever stored. Signing in only shares your name, ' +
  'email address and profile picture with ShipBox.'

export const FRENCH: Record<string, string> = {
  // ── The frame ──
  'Read this site in {language}': 'Lire ce site en {language}',
  Form: 'Étiquette',
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

  // ── The label preview ──
  'Label Preview': 'Aperçu de l’étiquette',
  'Tracking:': 'Suivi :',
  Close: 'Fermer',
  'Add to tracking': 'Ajouter au suivi',
  'Download PDF': 'Télécharger le PDF',

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
  Cancel: 'Annuler',
  'Deleting…': 'Suppression…',
  'Delete for good': 'Supprimer définitivement',
}
