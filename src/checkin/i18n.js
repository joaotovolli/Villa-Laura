export const supportedLanguages = ["en", "fr", "it", "pt"];

export const normalizeLanguage = (language) => {
  const value = String(language || "en").trim().toLowerCase().slice(0, 2);
  return supportedLanguages.includes(value) ? value : "en";
};

export const languageLabels = {
  en: "English",
  fr: "Francais",
  it: "Italiano",
  pt: "Portugues"
};

export const messageTemplates = {
  en: ({ name, link }) =>
    `${name ? `Hello ${name},` : "Hello,"}\n\nThank you for your booking at Villa Laura.\n\nTo prepare your arrival and complete the required Italian guest registration, please complete the secure online check-in form here:\n\n${link}\n\nThank you,\nJoao\nVilla Laura`,
  fr: ({ name, link }) =>
    `${name ? `Bonjour ${name},` : "Bonjour,"}\n\nMerci pour votre reservation a Villa Laura.\n\nPour preparer votre arrivee et completer l'enregistrement obligatoire des voyageurs en Italie, veuillez remplir le formulaire de check-in securise ici :\n\n${link}\n\nMerci,\nJoao\nVilla Laura`,
  it: ({ name, link }) =>
    `${name ? `Ciao ${name},` : "Ciao,"}\n\nGrazie per la tua prenotazione a Villa Laura.\n\nPer preparare il tuo arrivo e completare la registrazione obbligatoria degli ospiti in Italia, compila il modulo di check-in sicuro qui:\n\n${link}\n\nGrazie,\nJoao\nVilla Laura`,
  pt: ({ name, link }) =>
    `${name ? `Ola ${name},` : "Ola,"}\n\nObrigado pela sua reserva na Villa Laura.\n\nPara preparar a sua chegada e completar o registo obrigatorio de hospedes em Italia, preencha o formulario seguro de check-in aqui:\n\n${link}\n\nObrigado,\nJoao\nVilla Laura`
};

export const buildLocalizedGuestMessage = (reservation = {}, link = "") => {
  const language = normalizeLanguage(reservation.preferredLanguage || reservation.language);
  return messageTemplates[language]({ name: reservation.guestName || "", link });
};

export const checkinText = {
  en: {
    title: "Secure Check-In",
    subtitle: "Villa Laura secure guest registration",
    reservation: "Reservation",
    arrivalDate: "Arrival date",
    departureDate: "Departure date",
    numberOfGuests: "Number of guests",
    mainGuestEmail: "Main guest email",
    mainGuestPhone: "Main guest phone",
    guest: "Guest",
    firstName: "First name",
    lastName: "Last name",
    dateOfBirth: "Date of birth",
    placeOfBirth: "Place of birth",
    citizenship: "Citizenship",
    gender: "Sex / gender",
    select: "Select",
    female: "Female",
    male: "Male",
    other: "Other",
    documentType: "Document type",
    passport: "Passport",
    identityCard: "Identity card",
    otherDocument: "Other official document",
    documentNumber: "Document number",
    documentIssuingCountry: "Issuing country/place",
    documentExpiryDate: "Document expiry date",
    documentUpload: "Document upload",
    privacy: "I confirm this information is accurate and accept the privacy notice.",
    privacyNotice:
      "Identity document data is used only for required accommodation registration and operational check-in. Uploaded documents are private and deleted after processing or the applicable retention period.",
    submit: "Submit secure check-in",
    submitting: "Submitting...",
    thankYou: "Thank you",
    success: "Check-in submitted securely. Thank you.",
    invalidLink: "Invalid link",
    missingToken: "Missing check-in token.",
    unavailable: "Check-in unavailable",
    genericError: "Please check the required fields",
    uploadError: "Invalid document upload"
  },
  fr: {
    title: "Check-in securise",
    subtitle: "Enregistrement securise des voyageurs Villa Laura",
    reservation: "Reservation",
    arrivalDate: "Date d'arrivee",
    departureDate: "Date de depart",
    numberOfGuests: "Nombre de voyageurs",
    mainGuestEmail: "E-mail du voyageur principal",
    mainGuestPhone: "Telephone du voyageur principal",
    guest: "Voyageur",
    firstName: "Prenom",
    lastName: "Nom",
    dateOfBirth: "Date de naissance",
    placeOfBirth: "Lieu de naissance",
    citizenship: "Nationalite",
    gender: "Sexe / genre",
    select: "Selectionner",
    female: "Femme",
    male: "Homme",
    other: "Autre",
    documentType: "Type de document",
    passport: "Passeport",
    identityCard: "Carte d'identite",
    otherDocument: "Autre document officiel",
    documentNumber: "Numero du document",
    documentIssuingCountry: "Pays/lieu de delivrance",
    documentExpiryDate: "Date d'expiration du document",
    documentUpload: "Importer le document",
    privacy: "Je confirme que ces informations sont exactes et j'accepte la notice de confidentialite.",
    privacyNotice:
      "Les donnees des documents d'identite sont utilisees uniquement pour l'enregistrement obligatoire de l'hebergement et le check-in operationnel. Les documents importes restent prives et sont supprimes apres traitement ou selon la periode de conservation applicable.",
    submit: "Envoyer le check-in securise",
    submitting: "Envoi en cours...",
    thankYou: "Merci",
    success: "Check-in envoye de maniere securisee. Merci.",
    invalidLink: "Lien invalide",
    missingToken: "Jeton de check-in manquant.",
    unavailable: "Check-in indisponible",
    genericError: "Veuillez verifier les champs obligatoires",
    uploadError: "Document importe invalide"
  },
  it: {
    title: "Check-in sicuro",
    subtitle: "Registrazione ospiti sicura Villa Laura",
    reservation: "Prenotazione",
    arrivalDate: "Data di arrivo",
    departureDate: "Data di partenza",
    numberOfGuests: "Numero di ospiti",
    mainGuestEmail: "Email ospite principale",
    mainGuestPhone: "Telefono ospite principale",
    guest: "Ospite",
    firstName: "Nome",
    lastName: "Cognome",
    dateOfBirth: "Data di nascita",
    placeOfBirth: "Luogo di nascita",
    citizenship: "Cittadinanza",
    gender: "Sesso / genere",
    select: "Seleziona",
    female: "Femmina",
    male: "Maschio",
    other: "Altro",
    documentType: "Tipo documento",
    passport: "Passaporto",
    identityCard: "Carta d'identita",
    otherDocument: "Altro documento ufficiale",
    documentNumber: "Numero documento",
    documentIssuingCountry: "Paese/luogo di rilascio",
    documentExpiryDate: "Data scadenza documento",
    documentUpload: "Carica documento",
    privacy: "Confermo che queste informazioni sono corrette e accetto l'informativa privacy.",
    privacyNotice:
      "I dati dei documenti di identita sono usati solo per la registrazione obbligatoria degli ospiti e per il check-in operativo. I documenti caricati sono privati e vengono eliminati dopo l'elaborazione o secondo il periodo di conservazione applicabile.",
    submit: "Invia check-in sicuro",
    submitting: "Invio in corso...",
    thankYou: "Grazie",
    success: "Check-in inviato in modo sicuro. Grazie.",
    invalidLink: "Link non valido",
    missingToken: "Token check-in mancante.",
    unavailable: "Check-in non disponibile",
    genericError: "Controlla i campi obbligatori",
    uploadError: "Documento caricato non valido"
  },
  pt: {
    title: "Check-in seguro",
    subtitle: "Registo seguro de hospedes Villa Laura",
    reservation: "Reserva",
    arrivalDate: "Data de chegada",
    departureDate: "Data de partida",
    numberOfGuests: "Numero de hospedes",
    mainGuestEmail: "Email do hospede principal",
    mainGuestPhone: "Telefone do hospede principal",
    guest: "Hospede",
    firstName: "Nome",
    lastName: "Apelido",
    dateOfBirth: "Data de nascimento",
    placeOfBirth: "Local de nascimento",
    citizenship: "Nacionalidade",
    gender: "Sexo / genero",
    select: "Selecionar",
    female: "Feminino",
    male: "Masculino",
    other: "Outro",
    documentType: "Tipo de documento",
    passport: "Passaporte",
    identityCard: "Cartao de identidade",
    otherDocument: "Outro documento oficial",
    documentNumber: "Numero do documento",
    documentIssuingCountry: "Pais/local de emissao",
    documentExpiryDate: "Data de validade do documento",
    documentUpload: "Enviar documento",
    privacy: "Confirmo que estas informacoes estao corretas e aceito o aviso de privacidade.",
    privacyNotice:
      "Os dados dos documentos de identidade sao usados apenas para o registo obrigatorio do alojamento e para o check-in operacional. Os documentos enviados sao privados e eliminados apos o processamento ou de acordo com o periodo de retencao aplicavel.",
    submit: "Enviar check-in seguro",
    submitting: "A enviar...",
    thankYou: "Obrigado",
    success: "Check-in enviado com seguranca. Obrigado.",
    invalidLink: "Link invalido",
    missingToken: "Token de check-in em falta.",
    unavailable: "Check-in indisponivel",
    genericError: "Verifique os campos obrigatorios",
    uploadError: "Documento enviado invalido"
  }
};

export const getCheckinText = (language) => checkinText[normalizeLanguage(language)] || checkinText.en;
