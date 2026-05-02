import { cp, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const distDir = path.join(root, "dist");
const docsDir = path.join(root, "docs");
const assetsDir = path.join(distDir, "assets");
const sourceImagesDir = path.join(root, "assets", "source");
const publicDir = path.join(root, "public");
const stylesPath = path.join(root, "src", "styles.css");
const appScriptPath = path.join(root, "src", "app.js");
const checkinStylesPath = path.join(root, "src", "checkin", "checkin.css");
const adminScriptPath = path.join(root, "src", "checkin", "admin.js");
const adminClientScriptPath = path.join(root, "src", "checkin", "admin-client.js");
const checkinScriptPath = path.join(root, "src", "checkin", "checkin.js");
const checkinI18nScriptPath = path.join(root, "src", "checkin", "i18n.js");
const sourceDocsDir = path.join(root, "src", "docs");
const configPath = path.join(root, "site.config.json");

const localeOrder = ["en", "it", "es", "de", "pt", "fr"];
const localeNames = {
  en: "English",
  it: "Italiano",
  es: "Espanol",
  de: "Deutsch",
  pt: "Portugues",
  fr: "Francais"
};

const ui = {
  en: {
    htmlLang: "en",
    titleSuffix: "Guest Guide",
    navAbout: "About",
    navGuides: "Guides",
    navInfo: "House Info",
    navGallery: "Gallery",
    navContact: "Contact",
    switcherLabel: "Language",
    supportEyebrow: "Guest Support Site",
    supportTitle: "Everything guests need for a smooth stay at Villa Laura.",
    supportBody:
      "Use this page for quick house guidance, practical videos, useful local information, and direct support while you are at the house.",
    heroPrimary: "WhatsApp Support",
    heroSecondary: "Book on Airbnb",
    supportHeading: "Quick actions",
    supportCards: {
      whatsapp: {
        title: "Message on WhatsApp",
        body: "Fastest help during the stay, with a direct link ready to open."
      },
      airbnb: {
        title: "Open the Airbnb listing",
        body: "Bookings, full property details, and the original listing page."
      },
      guides: {
        title: "Browse video guides",
        body: "Step-by-step help for the TV, kitchen, air conditioning, keys, and more."
      }
    },
    aboutKicker: "About Villa Laura",
    aboutTitle: "A warm, easy base for Sardinian days.",
    aboutBody:
      "Villa Laura is designed for relaxed stays with sea views, bright interiors, and the practical comforts guests need when travelling with family or friends. This site keeps key information in one place so it stays easy to use on a phone.",
    aboutPanelTitle: "What this site is for",
    highlights: [
      "Sea-view setting with a calm, airy atmosphere",
      "Simple help resources for appliances and house access",
      "Direct WhatsApp contact for support during the stay",
      "Airbnb listing available for bookings and full property details"
    ],
    guidesKicker: "Guide Library",
    guidesTitle: "Quick help, without the clutter.",
    guidesIntro:
      "Open a guide for a clean walkthrough page with the video, a short explanation, and direct support links.",
    watchGuide: "Open guide",
    watchChannel: "Open YouTube channel",
    guideHubLabel: "Guide hub",
    infoKicker: "House Guide",
    infoTitle: "Practical information that stays easy to scan.",
    infoIntro:
      "This first version focuses on the essentials guests typically need most during a stay.",
    infoPanels: [
      { title: "Support", text: "WhatsApp is the main support channel during the stay." },
      { title: "Bookings", text: "All reservations are handled through Airbnb." },
      {
        title: "Videos",
        text: "The full guide library is also available on the Villa Laura YouTube channel."
      }
    ],
    guideSections: [
      {
        title: "Arrival and access",
        items: [
          "Use the keys and door guide videos before your first arrival.",
          "Keep the house keys together to avoid confusion when locking up.",
          "If anything feels unclear, message on WhatsApp for the fastest response."
        ]
      },
      {
        title: "Inside the house",
        items: [
          "Appliance videos cover the TV, oven, hood, washing machine, dishwasher, microwave, cooktop, air conditioning, and workstation.",
          "For the best experience, watch the short guide before using an appliance for the first time.",
          "Please treat the house as a lived-in home and leave everything switched off when going out."
        ]
      },
      {
        title: "Before leaving",
        items: [
          "Check doors and windows carefully before departure.",
          "Return all keys to the agreed place and confirm departure on WhatsApp.",
          "If anything was damaged or not working during the stay, report it before check-out so it can be handled quickly."
        ]
      }
    ],
    galleryKicker: "Gallery",
    galleryTitle: "The light, the view, the atmosphere.",
    galleryIntro:
      "A compact set of curated images keeps the site visually strong while staying quick to load.",
    contactKicker: "Need help during your stay?",
    contactTitle: "Support stays simple.",
    contactBody:
      "For the fastest support, send a WhatsApp message. For bookings, availability, and full listing details, use Airbnb.",
    contactPrimary: "Open WhatsApp",
    contactSecondary: "Open Airbnb",
    footer: "Villa Laura guest support site",
    videoLabel: "Video guide",
    notesTitle: "Helpful notes",
    notesIntro: "A few extra points that may help before you start.",
    backHome: "Back to homepage",
    backGuides: "Back to guide library",
    guideSupportTitle: "Need help with this guide?",
    guideSupportBody:
      "If something still feels unclear after watching the video, send a WhatsApp message for the quickest answer.",
    relatedTitle: "More guides",
    relatedIntro: "Other short walkthroughs guests often use during their stay.",
    browserLanguageRedirect: true
  },
  it: {
    htmlLang: "it",
    titleSuffix: "Guida Ospiti",
    navAbout: "Villa",
    navGuides: "Guide",
    navInfo: "Info Casa",
    navGallery: "Foto",
    navContact: "Contatti",
    switcherLabel: "Lingua",
    supportEyebrow: "Sito di supporto per gli ospiti",
    supportTitle: "Tutto il necessario per un soggiorno sereno a Villa Laura.",
    supportBody:
      "Usa questa pagina per trovare rapidamente istruzioni per la casa, video pratici, informazioni utili e supporto diretto durante il soggiorno.",
    heroPrimary: "Supporto WhatsApp",
    heroSecondary: "Prenota su Airbnb",
    supportHeading: "Azioni rapide",
    supportCards: {
      whatsapp: {
        title: "Scrivi su WhatsApp",
        body: "Il modo piu rapido per ricevere aiuto durante il soggiorno."
      },
      airbnb: {
        title: "Apri l'annuncio Airbnb",
        body: "Prenotazioni, dettagli completi della casa e pagina originale dell'annuncio."
      },
      guides: {
        title: "Sfoglia le video guide",
        body: "Istruzioni rapide per TV, cucina, aria condizionata, chiavi e altro."
      }
    },
    aboutKicker: "Villa Laura",
    aboutTitle: "Una base accogliente e luminosa per le giornate in Sardegna.",
    aboutBody:
      "Villa Laura e pensata per soggiorni rilassati con vista mare, interni luminosi e tutte le comodita pratiche utili a famiglie e piccoli gruppi. Questo sito raccoglie le informazioni principali in un formato semplice da usare anche dal telefono.",
    aboutPanelTitle: "A cosa serve questo sito",
    highlights: [
      "Atmosfera ariosa con vista mare",
      "Aiuto semplice per elettrodomestici e accesso alla casa",
      "Contatto diretto su WhatsApp durante il soggiorno",
      "Annuncio Airbnb disponibile per prenotazioni e dettagli completi"
    ],
    guidesKicker: "Libreria Guide",
    guidesTitle: "Aiuto rapido, senza confusione.",
    guidesIntro:
      "Apri una guida per vedere una pagina chiara con video, breve spiegazione e link diretti al supporto.",
    watchGuide: "Apri guida",
    watchChannel: "Apri canale YouTube",
    guideHubLabel: "Libreria guide",
    infoKicker: "Guida della Casa",
    infoTitle: "Informazioni pratiche facili da consultare.",
    infoIntro:
      "Questa prima versione raccoglie l'essenziale che gli ospiti usano piu spesso durante il soggiorno.",
    infoPanels: [
      { title: "Supporto", text: "WhatsApp e il principale canale di supporto durante il soggiorno." },
      { title: "Prenotazioni", text: "Tutte le prenotazioni sono gestite tramite Airbnb." },
      {
        title: "Video",
        text: "L'intera libreria di guide e disponibile anche sul canale YouTube di Villa Laura."
      }
    ],
    guideSections: [
      {
        title: "Arrivo e accesso",
        items: [
          "Guarda i video su chiavi e porte prima del primo arrivo.",
          "Tieni insieme le chiavi della casa per evitare confusione quando chiudi.",
          "Se qualcosa non e chiaro, scrivi su WhatsApp per una risposta piu rapida."
        ]
      },
      {
        title: "Dentro la casa",
        items: [
          "Le video guide coprono TV, forno, cappa, lavatrice, lavastoviglie, microonde, piano cottura, aria condizionata e postazione di lavoro.",
          "Per un uso piu semplice, guarda il breve video prima di usare un apparecchio per la prima volta.",
          "Ti chiediamo di trattare la casa come una casa vissuta e di lasciare tutto spento quando esci."
        ]
      },
      {
        title: "Prima di partire",
        items: [
          "Controlla con attenzione porte e finestre prima della partenza.",
          "Rimetti tutte le chiavi nel punto concordato e conferma la partenza su WhatsApp.",
          "Se qualcosa si e rotto o non ha funzionato, segnalalo prima del check-out per gestirlo rapidamente."
        ]
      }
    ],
    galleryKicker: "Galleria",
    galleryTitle: "Luce, vista e atmosfera.",
    galleryIntro:
      "Una selezione compatta di immagini curate mantiene il sito elegante e veloce da caricare.",
    contactKicker: "Serve aiuto durante il soggiorno?",
    contactTitle: "Supporto semplice e diretto.",
    contactBody:
      "Per il supporto piu rapido, invia un messaggio su WhatsApp. Per prenotazioni, disponibilita e dettagli completi, usa Airbnb.",
    contactPrimary: "Apri WhatsApp",
    contactSecondary: "Apri Airbnb",
    footer: "Sito di supporto ospiti Villa Laura",
    videoLabel: "Video guida",
    notesTitle: "Note utili",
    notesIntro: "Alcuni punti pratici prima di iniziare.",
    backHome: "Torna alla homepage",
    backGuides: "Torna alla libreria guide",
    guideSupportTitle: "Serve aiuto con questa guida?",
    guideSupportBody:
      "Se qualcosa non e chiaro anche dopo il video, invia un messaggio su WhatsApp per la risposta piu rapida.",
    relatedTitle: "Altre guide",
    relatedIntro: "Altri brevi video che gli ospiti usano spesso durante il soggiorno.",
    browserLanguageRedirect: true
  },
  es: {
    htmlLang: "es",
    titleSuffix: "Guia para Huespedes",
    navAbout: "Villa",
    navGuides: "Guias",
    navInfo: "Info Casa",
    navGallery: "Galeria",
    navContact: "Contacto",
    switcherLabel: "Idioma",
    supportEyebrow: "Sitio de apoyo para huespedes",
    supportTitle: "Todo lo necesario para una estancia comoda en Villa Laura.",
    supportBody:
      "Usa esta pagina para encontrar rapidamente guias de la casa, videos utiles, informacion practica y ayuda directa durante tu estancia.",
    heroPrimary: "Soporte por WhatsApp",
    heroSecondary: "Reservar en Airbnb",
    supportHeading: "Accesos rapidos",
    supportCards: {
      whatsapp: {
        title: "Escribir por WhatsApp",
        body: "La forma mas rapida de recibir ayuda durante la estancia."
      },
      airbnb: {
        title: "Abrir el anuncio de Airbnb",
        body: "Reservas, detalles completos de la casa y pagina original del anuncio."
      },
      guides: {
        title: "Ver guias en video",
        body: "Ayuda paso a paso para TV, cocina, aire acondicionado, llaves y mas."
      }
    },
    aboutKicker: "Villa Laura",
    aboutTitle: "Una base luminosa y tranquila para disfrutar Cerdena.",
    aboutBody:
      "Villa Laura esta pensada para estancias relajadas con vistas al mar, interiores luminosos y las comodidades practicas que suelen necesitar familias y pequenos grupos. Este sitio reune la informacion principal en un formato facil de usar desde el movil.",
    aboutPanelTitle: "Para que sirve este sitio",
    highlights: [
      "Entorno con vistas al mar y ambiente aireado",
      "Ayuda sencilla para electrodomesticos y acceso a la casa",
      "Contacto directo por WhatsApp durante la estancia",
      "Anuncio de Airbnb disponible para reservas y detalles completos"
    ],
    guidesKicker: "Biblioteca de Guias",
    guidesTitle: "Ayuda rapida, sin desorden.",
    guidesIntro:
      "Abre una guia para ver una pagina limpia con el video, una breve explicacion y enlaces directos de ayuda.",
    watchGuide: "Abrir guia",
    watchChannel: "Abrir canal de YouTube",
    guideHubLabel: "Biblioteca de guias",
    infoKicker: "Guia de la Casa",
    infoTitle: "Informacion practica facil de consultar.",
    infoIntro:
      "Esta primera version se centra en lo esencial que los huespedes suelen necesitar durante la estancia.",
    infoPanels: [
      { title: "Soporte", text: "WhatsApp es el principal canal de ayuda durante la estancia." },
      { title: "Reservas", text: "Todas las reservas se gestionan a traves de Airbnb." },
      {
        title: "Videos",
        text: "La biblioteca completa de guias tambien esta disponible en el canal de YouTube de Villa Laura."
      }
    ],
    guideSections: [
      {
        title: "Llegada y acceso",
        items: [
          "Mira las guias de llaves y puertas antes de la primera llegada.",
          "Manten las llaves juntas para evitar confusiones al cerrar la casa.",
          "Si algo no esta claro, escribe por WhatsApp para recibir ayuda rapidamente."
        ]
      },
      {
        title: "Dentro de la casa",
        items: [
          "Las guias en video cubren TV, horno, campana, lavadora, lavavajillas, microondas, placa, aire acondicionado y espacio de trabajo.",
          "Para una mejor experiencia, mira el video corto antes de usar un aparato por primera vez.",
          "Por favor trata la casa como un hogar y deja todo apagado cuando salgas."
        ]
      },
      {
        title: "Antes de salir",
        items: [
          "Revisa con cuidado puertas y ventanas antes de la salida.",
          "Devuelve todas las llaves al lugar acordado y confirma la salida por WhatsApp.",
          "Si algo se rompio o no funciono, informalo antes del check-out para resolverlo rapidamente."
        ]
      }
    ],
    galleryKicker: "Galeria",
    galleryTitle: "La luz, la vista y el ambiente.",
    galleryIntro:
      "Una seleccion compacta de imagenes cuidadas mantiene el sitio atractivo y rapido de cargar.",
    contactKicker: "Necesitas ayuda durante tu estancia?",
    contactTitle: "Apoyo claro y directo.",
    contactBody:
      "Para la ayuda mas rapida, envia un mensaje por WhatsApp. Para reservas, disponibilidad y detalles completos, usa Airbnb.",
    contactPrimary: "Abrir WhatsApp",
    contactSecondary: "Abrir Airbnb",
    footer: "Sitio de apoyo para huespedes de Villa Laura",
    videoLabel: "Guia en video",
    notesTitle: "Notas utiles",
    notesIntro: "Algunos puntos extra que pueden ayudarte antes de empezar.",
    backHome: "Volver a la pagina principal",
    backGuides: "Volver a la biblioteca de guias",
    guideSupportTitle: "Necesitas ayuda con esta guia?",
    guideSupportBody:
      "Si algo sigue sin quedar claro despues del video, envia un mensaje por WhatsApp para obtener ayuda mas rapidamente.",
    relatedTitle: "Mas guias",
    relatedIntro: "Otros videos cortos que los huespedes suelen usar durante la estancia.",
    browserLanguageRedirect: true
  },
  de: {
    htmlLang: "de",
    titleSuffix: "Gaesteguide",
    navAbout: "Villa",
    navGuides: "Anleitungen",
    navInfo: "Hausinfos",
    navGallery: "Galerie",
    navContact: "Kontakt",
    switcherLabel: "Sprache",
    supportEyebrow: "Gaesteservice-Website",
    supportTitle: "Alles Wichtige fuer einen entspannten Aufenthalt in Villa Laura.",
    supportBody:
      "Diese Seite bietet schnellen Zugang zu Hausinformationen, hilfreichen Videos, praktischen Hinweisen und direkter Unterstuetzung waehrend des Aufenthalts.",
    heroPrimary: "WhatsApp Support",
    heroSecondary: "Auf Airbnb buchen",
    supportHeading: "Schnellzugriffe",
    supportCards: {
      whatsapp: {
        title: "Per WhatsApp schreiben",
        body: "Der schnellste Weg zu Hilfe waehrend des Aufenthalts."
      },
      airbnb: {
        title: "Airbnb Inserat oeffnen",
        body: "Buchungen, komplette Hausdetails und die urspruengliche Inseratsseite."
      },
      guides: {
        title: "Videoanleitungen ansehen",
        body: "Schritt-fuer-Schritt Hilfe fuer TV, Kueche, Klimaanlage, Schluessel und mehr."
      }
    },
    aboutKicker: "Villa Laura",
    aboutTitle: "Ein heller, entspannter Ausgangspunkt fuer Sardinien.",
    aboutBody:
      "Villa Laura ist fuer ruhige Aufenthalte mit Meerblick, hellen Raeumen und praktischen Annehmlichkeiten fuer Familien und kleine Gruppen gedacht. Diese Website sammelt die wichtigsten Informationen in einem Format, das auch auf dem Handy leicht nutzbar bleibt.",
    aboutPanelTitle: "Wofuer diese Seite gedacht ist",
    highlights: [
      "Meerblick mit ruhiger, luftiger Atmosphaere",
      "Einfache Hilfe fuer Geraete und Hauszugang",
      "Direkter WhatsApp Kontakt waehrend des Aufenthalts",
      "Airbnb Inserat fuer Buchungen und vollstaendige Details"
    ],
    guidesKicker: "Guide-Bibliothek",
    guidesTitle: "Schnelle Hilfe, ohne Ueberfrachtung.",
    guidesIntro:
      "Jede Anleitung fuehrt zu einer klaren Seite mit Video, kurzer Erklaerung und direkten Support-Links.",
    watchGuide: "Guide oeffnen",
    watchChannel: "YouTube Kanal oeffnen",
    guideHubLabel: "Guide-Bibliothek",
    infoKicker: "Hausguide",
    infoTitle: "Praktische Informationen, leicht lesbar.",
    infoIntro:
      "Diese erste Version konzentriert sich auf die Punkte, die Gaeste waehrend des Aufenthalts am haeufigsten brauchen.",
    infoPanels: [
      { title: "Support", text: "WhatsApp ist der wichtigste Support-Kanal waehrend des Aufenthalts." },
      { title: "Buchungen", text: "Alle Buchungen laufen ueber Airbnb." },
      {
        title: "Videos",
        text: "Die komplette Guide-Bibliothek ist auch auf dem Villa Laura YouTube-Kanal verfuegbar."
      }
    ],
    guideSections: [
      {
        title: "Ankunft und Zugang",
        items: [
          "Sieh dir die Videos zu Schluesseln und Tueren vor der ersten Ankunft an.",
          "Bewahre die Hausschluessel zusammen auf, damit es beim Abschliessen keine Verwechslungen gibt.",
          "Wenn etwas unklar ist, sende am schnellsten eine WhatsApp Nachricht."
        ]
      },
      {
        title: "Im Haus",
        items: [
          "Die Videos decken TV, Ofen, Dunstabzug, Waschmaschine, Geschirrspueler, Mikrowelle, Kochfeld, Klimaanlage und Arbeitsplatz ab.",
          "Fuer die beste Erfahrung zuerst das kurze Video ansehen, bevor ein Geraet zum ersten Mal benutzt wird.",
          "Bitte behandle das Haus wie ein bewohntes Zuhause und lasse beim Verlassen alles ausgeschaltet."
        ]
      },
      {
        title: "Vor der Abreise",
        items: [
          "Pruefe Tueren und Fenster vor der Abreise sorgfaeltig.",
          "Lege alle Schluessel an den vereinbarten Ort zurueck und bestaetige die Abreise per WhatsApp.",
          "Wenn etwas beschaedigt wurde oder nicht funktioniert hat, melde es vor dem Check-out, damit es schnell erledigt werden kann."
        ]
      }
    ],
    galleryKicker: "Galerie",
    galleryTitle: "Licht, Aussicht und Atmosphaere.",
    galleryIntro:
      "Eine kompakte Auswahl kuratierter Bilder haelt die Seite stark und schnell zugleich.",
    contactKicker: "Brauchst du Hilfe waehrend des Aufenthalts?",
    contactTitle: "Support ohne Umwege.",
    contactBody:
      "Fuer die schnellste Hilfe sende eine WhatsApp Nachricht. Fuer Buchungen, Verfuegbarkeit und alle Inseratsdetails nutze Airbnb.",
    contactPrimary: "WhatsApp oeffnen",
    contactSecondary: "Airbnb oeffnen",
    footer: "Villa Laura Gaesteservice-Website",
    videoLabel: "Videoanleitung",
    notesTitle: "Hilfreiche Hinweise",
    notesIntro: "Ein paar zusaetzliche Punkte vor dem Start.",
    backHome: "Zur Startseite",
    backGuides: "Zur Guide-Bibliothek",
    guideSupportTitle: "Brauchst du Hilfe zu dieser Anleitung?",
    guideSupportBody:
      "Wenn nach dem Video noch etwas unklar ist, sende eine WhatsApp Nachricht fuer die schnellste Antwort.",
    relatedTitle: "Weitere Guides",
    relatedIntro: "Andere kurze Anleitungen, die Gaeste waehrend des Aufenthalts oft nutzen.",
    browserLanguageRedirect: true
  },
  pt: {
    htmlLang: "pt",
    titleSuffix: "Guia para Hospedes",
    navAbout: "Villa",
    navGuides: "Guias",
    navInfo: "Info Casa",
    navGallery: "Galeria",
    navContact: "Contato",
    switcherLabel: "Idioma",
    supportEyebrow: "Site de apoio ao hospede",
    supportTitle: "Tudo o que os hospedes precisam para uma estadia tranquila na Villa Laura.",
    supportBody:
      "Use esta pagina para encontrar rapidamente instrucoes da casa, videos praticos, informacoes uteis e apoio direto durante a estadia.",
    heroPrimary: "Suporte por WhatsApp",
    heroSecondary: "Reservar no Airbnb",
    supportHeading: "Acoes rapidas",
    supportCards: {
      whatsapp: {
        title: "Falar no WhatsApp",
        body: "A forma mais rapida de receber ajuda durante a estadia."
      },
      airbnb: {
        title: "Abrir anuncio no Airbnb",
        body: "Reservas, detalhes completos da casa e a pagina original do anuncio."
      },
      guides: {
        title: "Ver guias em video",
        body: "Ajuda passo a passo para TV, cozinha, ar condicionado, chaves e mais."
      }
    },
    aboutKicker: "Villa Laura",
    aboutTitle: "Uma base leve e acolhedora para dias na Sardenha.",
    aboutBody:
      "A Villa Laura foi pensada para estadias relaxadas com vista para o mar, interiores luminosos e o conforto pratico que familias e pequenos grupos costumam precisar. Este site reune a informacao principal num formato facil de usar no telemovel.",
    aboutPanelTitle: "Para que serve este site",
    highlights: [
      "Ambiente arejado com vista para o mar",
      "Ajuda simples para eletrodomesticos e acesso a casa",
      "Contato direto por WhatsApp durante a estadia",
      "Anuncio do Airbnb para reservas e detalhes completos"
    ],
    guidesKicker: "Biblioteca de Guias",
    guidesTitle: "Ajuda rapida, sem complicacao.",
    guidesIntro:
      "Abra uma guia para ver uma pagina limpa com video, explicacao curta e links diretos de apoio.",
    watchGuide: "Abrir guia",
    watchChannel: "Abrir canal do YouTube",
    guideHubLabel: "Biblioteca de guias",
    infoKicker: "Guia da Casa",
    infoTitle: "Informacao pratica, facil de consultar.",
    infoIntro:
      "Esta primeira versao foca no essencial que os hospedes costumam precisar durante a estadia.",
    infoPanels: [
      { title: "Apoio", text: "O WhatsApp e o principal canal de apoio durante a estadia." },
      { title: "Reservas", text: "Todas as reservas sao tratadas pelo Airbnb." },
      {
        title: "Videos",
        text: "A biblioteca completa de guias tambem esta disponivel no canal da Villa Laura no YouTube."
      }
    ],
    guideSections: [
      {
        title: "Chegada e acesso",
        items: [
          "Veja os videos sobre chaves e portas antes da primeira chegada.",
          "Mantenha as chaves da casa juntas para evitar confusao ao fechar.",
          "Se algo nao estiver claro, envie uma mensagem no WhatsApp para obter ajuda rapidamente."
        ]
      },
      {
        title: "Dentro da casa",
        items: [
          "Os videos cobrem TV, forno, exaustor, maquina de lavar roupa, lava-loica, micro-ondas, placa, ar condicionado e area de trabalho.",
          "Para uma experiencia mais simples, veja o video curto antes de usar um aparelho pela primeira vez.",
          "Trate a casa como uma casa vivida e deixe tudo desligado quando sair."
        ]
      },
      {
        title: "Antes de partir",
        items: [
          "Verifique portas e janelas com cuidado antes da partida.",
          "Devolva todas as chaves ao local combinado e confirme a saida por WhatsApp.",
          "Se algo se partiu ou nao funcionou, informe antes do check-out para resolver rapidamente."
        ]
      }
    ],
    galleryKicker: "Galeria",
    galleryTitle: "A luz, a vista e a atmosfera.",
    galleryIntro:
      "Uma selecao compacta de imagens cuidadas mantem o site elegante e rapido a carregar.",
    contactKicker: "Precisa de ajuda durante a estadia?",
    contactTitle: "Apoio simples e direto.",
    contactBody:
      "Para a ajuda mais rapida, envie uma mensagem no WhatsApp. Para reservas, disponibilidade e detalhes completos, use o Airbnb.",
    contactPrimary: "Abrir WhatsApp",
    contactSecondary: "Abrir Airbnb",
    footer: "Site de apoio ao hospede Villa Laura",
    videoLabel: "Guia em video",
    notesTitle: "Notas uteis",
    notesIntro: "Alguns pontos extra que podem ajudar antes de comecar.",
    backHome: "Voltar a pagina inicial",
    backGuides: "Voltar a biblioteca de guias",
    guideSupportTitle: "Precisa de ajuda com esta guia?",
    guideSupportBody:
      "Se algo continuar pouco claro depois do video, envie uma mensagem no WhatsApp para obter a resposta mais rapida.",
    relatedTitle: "Mais guias",
    relatedIntro: "Outros videos curtos que os hospedes usam com frequencia durante a estadia.",
    browserLanguageRedirect: true
  },
  fr: {
    htmlLang: "fr",
    titleSuffix: "Guide Sejour",
    navAbout: "Villa",
    navGuides: "Guides",
    navInfo: "Infos Maison",
    navGallery: "Galerie",
    navContact: "Contact",
    switcherLabel: "Langue",
    supportEyebrow: "Site de support voyageurs",
    supportTitle: "Tout le necessaire pour un sejour fluide a Villa Laura.",
    supportBody:
      "Utilisez cette page pour acceder rapidement aux instructions de la maison, aux videos pratiques, aux informations utiles et au support direct pendant votre sejour.",
    heroPrimary: "Support WhatsApp",
    heroSecondary: "Reserver sur Airbnb",
    supportHeading: "Acces rapides",
    supportCards: {
      whatsapp: {
        title: "Contacter sur WhatsApp",
        body: "Le moyen le plus rapide d'obtenir de l'aide pendant le sejour."
      },
      airbnb: {
        title: "Ouvrir l'annonce Airbnb",
        body: "Reservations, informations completes sur la propriete et page d'annonce d'origine."
      },
      guides: {
        title: "Parcourir les guides video",
        body: "Aide pas a pas pour la TV, la cuisine, la climatisation, les cles et plus encore."
      }
    },
    aboutKicker: "Villa Laura",
    aboutTitle: "Un point de chute lumineux et simple pour profiter de la Sardaigne.",
    aboutBody:
      "Villa Laura est pensee pour des sejours detendus avec vue sur la mer, des interieurs lumineux et les equipements pratiques attendus par les familles et petits groupes. Ce site rassemble les informations essentielles dans un format facile a utiliser sur mobile.",
    aboutPanelTitle: "A quoi sert ce site",
    highlights: [
      "Cadre avec vue mer et atmosphere calme",
      "Aide simple pour les equipements et l'acces a la maison",
      "Contact direct sur WhatsApp pendant le sejour",
      "Annonce Airbnb disponible pour les reservations et les details complets"
    ],
    guidesKicker: "Bibliotheque de Guides",
    guidesTitle: "Une aide rapide, sans surcharge.",
    guidesIntro:
      "Ouvrez un guide pour afficher une page claire avec la video, une courte explication et des liens directs vers le support.",
    watchGuide: "Ouvrir le guide",
    watchChannel: "Ouvrir la chaine YouTube",
    guideHubLabel: "Bibliotheque de guides",
    infoKicker: "Guide Maison",
    infoTitle: "Des informations pratiques, faciles a parcourir.",
    infoIntro:
      "Cette premiere version se concentre sur l'essentiel dont les voyageurs ont le plus souvent besoin pendant leur sejour.",
    infoPanels: [
      { title: "Support", text: "WhatsApp est le principal canal de support pendant le sejour." },
      { title: "Reservations", text: "Toutes les reservations sont gerees via Airbnb." },
      {
        title: "Videos",
        text: "La bibliotheque complete des guides est egalement disponible sur la chaine YouTube de Villa Laura."
      }
    ],
    guideSections: [
      {
        title: "Arrivee et acces",
        items: [
          "Consultez les guides video sur les cles et les portes avant votre premiere arrivee.",
          "Gardez les cles de la maison ensemble pour eviter toute confusion au moment de fermer.",
          "Si quelque chose n'est pas clair, envoyez un message sur WhatsApp pour obtenir une reponse rapide."
        ]
      },
      {
        title: "Dans la maison",
        items: [
          "Les guides video couvrent la TV, le four, la hotte, le lave-linge, le lave-vaisselle, le micro-ondes, la plaque de cuisson, la climatisation et l'espace de travail.",
          "Pour une utilisation plus simple, regardez la courte video avant d'utiliser un appareil pour la premiere fois.",
          "Merci de traiter la maison comme un lieu de vie et de tout laisser eteint lorsque vous sortez."
        ]
      },
      {
        title: "Avant le depart",
        items: [
          "Verifiez soigneusement les portes et les fenetres avant le depart.",
          "Remettez toutes les cles a l'endroit convenu et confirmez votre depart sur WhatsApp.",
          "Si quelque chose a ete endommage ou n'a pas fonctionne, signalez-le avant le check-out pour un traitement rapide."
        ]
      }
    ],
    galleryKicker: "Galerie",
    galleryTitle: "La lumiere, la vue, l'atmosphere.",
    galleryIntro:
      "Une selection compacte d'images soigneusement choisies permet de garder un site elegant et rapide a charger.",
    contactKicker: "Besoin d'aide pendant votre sejour ?",
    contactTitle: "Un support simple et direct.",
    contactBody:
      "Pour obtenir de l'aide rapidement, envoyez un message sur WhatsApp. Pour les reservations, les disponibilites et les informations completes, utilisez Airbnb.",
    contactPrimary: "Ouvrir WhatsApp",
    contactSecondary: "Ouvrir Airbnb",
    footer: "Site de support voyageurs Villa Laura",
    videoLabel: "Guide video",
    notesTitle: "Notes utiles",
    notesIntro: "Quelques points supplementaires utiles avant de commencer.",
    backHome: "Retour a l'accueil",
    backGuides: "Retour a la bibliotheque de guides",
    guideSupportTitle: "Besoin d'aide pour ce guide ?",
    guideSupportBody:
      "Si quelque chose reste peu clair apres la video, envoyez un message sur WhatsApp pour obtenir la reponse la plus rapide.",
    relatedTitle: "Autres guides",
    relatedIntro: "D'autres courtes videos souvent utilisees par les voyageurs pendant leur sejour.",
    browserLanguageRedirect: true
  }
};

const videoCopy = {
  "how-to-use-tv": {
    it: {
      title: "Come usare la TV",
      description: "Guida rapida per accendere la TV, cambiare canale e usare le app di streaming."
    },
    es: {
      title: "Como usar la TV",
      description: "Guia rapida para encender la TV, cambiar de canal y abrir las apps de streaming."
    },
    de: {
      title: "So benutzt du den Fernseher",
      description: "Kurze Anleitung zum Einschalten des Fernsehers, Wechseln der Kanaele und Oeffnen von Streaming-Apps."
    },
    pt: {
      title: "Como usar a TV",
      description: "Guia rapida para ligar a TV, mudar de canal e abrir as apps de streaming."
    },
    fr: {
      title: "Comment utiliser la TV",
      description: "Guide rapide pour allumer la TV, changer de chaine et acceder aux applications de streaming."
    }
  },
  "how-to-use-oven": {
    it: {
      title: "Come usare il forno",
      description: "Istruzioni passo dopo passo per accendere il forno, regolare la temperatura e usare le funzioni principali."
    },
    es: {
      title: "Como usar el horno",
      description: "Instrucciones paso a paso para encender el horno, ajustar la temperatura y usar las funciones basicas."
    },
    de: {
      title: "So benutzt du den Ofen",
      description: "Schritt-fuer-Schritt Anleitung zum Einschalten des Ofens, Einstellen der Temperatur und Nutzen der wichtigsten Funktionen."
    },
    pt: {
      title: "Como usar o forno",
      description: "Instrucoes passo a passo para ligar o forno, ajustar a temperatura e usar as funcoes principais."
    },
    fr: {
      title: "Comment utiliser le four",
      description: "Instructions pas a pas pour allumer le four, regler la temperature et utiliser les fonctions principales."
    }
  },
  "how-to-use-kitchen-hood": {
    it: {
      title: "Come usare la cappa",
      description: "Come accendere la cappa, regolare la velocita della ventola e usare le luci."
    },
    es: {
      title: "Como usar la campana de cocina",
      description: "Como encender la campana, ajustar la velocidad del ventilador y usar las luces."
    },
    de: {
      title: "So benutzt du die Dunstabzugshaube",
      description: "So schaltest du die Haube ein, stellst die Stufe ein und nutzt das Licht."
    },
    pt: {
      title: "Como usar o exaustor",
      description: "Como ligar o exaustor, ajustar a velocidade e usar as luzes."
    },
    fr: {
      title: "Comment utiliser la hotte",
      description: "Comment allumer la hotte, regler la vitesse du ventilateur et utiliser l'eclairage."
    }
  },
  "how-to-use-washing-machine": {
    it: {
      title: "Come usare la lavatrice",
      description: "Guida semplice per scegliere il programma, aggiungere il detersivo e avviare il lavaggio."
    },
    es: {
      title: "Como usar la lavadora",
      description: "Guia sencilla para elegir el programa, anadir detergente y empezar el lavado."
    },
    de: {
      title: "So benutzt du die Waschmaschine",
      description: "Einfache Anleitung fuer Programmwahl, Waschmittel und Start des Waschgangs."
    },
    pt: {
      title: "Como usar a maquina de lavar roupa",
      description: "Guia simples para escolher o programa, colocar detergente e iniciar a lavagem."
    },
    fr: {
      title: "Comment utiliser le lave-linge",
      description: "Guide simple pour choisir un programme, ajouter la lessive et lancer un cycle."
    }
  },
  "how-to-use-dishwasher": {
    it: {
      title: "Come usare la lavastoviglie",
      description: "Istruzioni per caricare i piatti, aggiungere il detersivo e scegliere il programma corretto."
    },
    es: {
      title: "Como usar el lavavajillas",
      description: "Instrucciones para cargar la vajilla, anadir detergente y elegir el programa correcto."
    },
    de: {
      title: "So benutzt du den Geschirrspueler",
      description: "Hinweise zum Einraeumen, Waschmittel und zur Wahl des passenden Programms."
    },
    pt: {
      title: "Como usar a maquina de lavar loica",
      description: "Instrucoes para colocar a loica, adicionar detergente e escolher o programa certo."
    },
    fr: {
      title: "Comment utiliser le lave-vaisselle",
      description: "Instructions pour charger la vaisselle, ajouter le detergent et choisir le programme adapte."
    }
  },
  "how-to-use-microwave": {
    it: {
      title: "Come usare il microonde",
      description: "Istruzioni base per riscaldare il cibo, impostare il tempo e usare le funzioni principali."
    },
    es: {
      title: "Como usar el microondas",
      description: "Instrucciones basicas para calentar comida, ajustar el tiempo y usar las funciones principales."
    },
    de: {
      title: "So benutzt du die Mikrowelle",
      description: "Grundlegende Hinweise zum Erwaermen, Einstellen der Zeit und Nutzen der Hauptfunktionen."
    },
    pt: {
      title: "Como usar o micro-ondas",
      description: "Instrucoes basicas para aquecer comida, definir o tempo e usar as funcoes principais."
    },
    fr: {
      title: "Comment utiliser le micro-ondes",
      description: "Instructions de base pour rechauffer un plat, regler le temps et utiliser les fonctions principales."
    }
  },
  "how-to-use-cooktop": {
    it: {
      title: "Come usare il piano cottura",
      description: "Come accendere il piano, regolare la potenza e usarlo in sicurezza."
    },
    es: {
      title: "Como usar la placa",
      description: "Como encender la placa, ajustar el calor y usarla con seguridad."
    },
    de: {
      title: "So benutzt du das Kochfeld",
      description: "So schaltest du das Kochfeld ein, stellst die Hitze ein und nutzt es sicher."
    },
    pt: {
      title: "Como usar a placa",
      description: "Como ligar a placa, ajustar o calor e usa-la com seguranca."
    },
    fr: {
      title: "Comment utiliser la plaque de cuisson",
      description: "Comment allumer la plaque, regler la puissance et l'utiliser en toute securite."
    }
  },
  "how-to-use-air-conditioning": {
    it: {
      title: "Come usare l'aria condizionata",
      description: "Come accendere il climatizzatore, regolare la temperatura e cambiare modalita."
    },
    es: {
      title: "Como usar el aire acondicionado",
      description: "Como encender el aire acondicionado, ajustar la temperatura y cambiar de modo."
    },
    de: {
      title: "So benutzt du die Klimaanlage",
      description: "So schaltest du die Klimaanlage ein, stellst die Temperatur ein und wechselst die Modi."
    },
    pt: {
      title: "Como usar o ar condicionado",
      description: "Como ligar o ar condicionado, ajustar a temperatura e mudar de modo."
    },
    fr: {
      title: "Comment utiliser la climatisation",
      description: "Comment allumer la climatisation, regler la temperature et changer de mode."
    }
  },
  "how-to-use-doors-and-locks": {
    it: {
      title: "Come usare porte e serrature",
      description: "Istruzioni per aprire, chiudere e bloccare le porte in sicurezza."
    },
    es: {
      title: "Como usar puertas y cerraduras",
      description: "Instrucciones para abrir, cerrar y bloquear las puertas con seguridad."
    },
    de: {
      title: "So benutzt du Tueren und Schloesser",
      description: "Hinweise zum sicheren Oeffnen, Schliessen und Abschliessen der Tueren."
    },
    pt: {
      title: "Como usar portas e fechaduras",
      description: "Instrucoes para abrir, fechar e trancar as portas com seguranca."
    },
    fr: {
      title: "Comment utiliser les portes et serrures",
      description: "Instructions pour ouvrir, fermer et verrouiller les portes en toute securite."
    }
  },
  "how-to-use-keys": {
    it: {
      title: "Come usare le chiavi",
      description: "Spiegazione di quali chiavi usare e di come aprire e chiudere la proprieta."
    },
    es: {
      title: "Como usar las llaves",
      description: "Explicacion de que llaves usar y como abrir y cerrar la propiedad."
    },
    de: {
      title: "So benutzt du die Schluessel",
      description: "Erklaerung, welche Schluessel gebraucht werden und wie die Unterkunft auf- und abgeschlossen wird."
    },
    pt: {
      title: "Como usar as chaves",
      description: "Explicacao de quais chaves usar e como abrir e fechar a propriedade."
    },
    fr: {
      title: "Comment utiliser les cles",
      description: "Explication des cles a utiliser et de la facon d'ouvrir et fermer la propriete."
    }
  },
  "how-to-use-workstation": {
    it: {
      title: "Come usare la postazione di lavoro",
      description: "Guida all'uso della scrivania, delle prese di corrente e dell'area lavoro."
    },
    es: {
      title: "Como usar la zona de trabajo",
      description: "Guia para usar el escritorio, los enchufes y la zona de trabajo."
    },
    de: {
      title: "So benutzt du den Arbeitsplatz",
      description: "Kurze Anleitung fuer Schreibtisch, Steckdosen und den Arbeitsbereich."
    },
    pt: {
      title: "Como usar a area de trabalho",
      description: "Guia para usar a secretaria, as tomadas e a area de trabalho."
    },
    fr: {
      title: "Comment utiliser l'espace de travail",
      description: "Guide pour utiliser le bureau, les prises de courant et l'espace de travail."
    }
  }
};

const rawConfig = await readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

await rm(distDir, { recursive: true, force: true });
await rm(docsDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

for (const file of ["_headers", "favicon.svg", "robots.txt"]) {
  await copyFile(path.join(publicDir, file), path.join(distDir, file));
}

const styles = await readFile(stylesPath, "utf8");
const appScript = await readFile(appScriptPath, "utf8");
await copyFile(checkinStylesPath, path.join(assetsDir, "checkin.css"));
await copyFile(adminScriptPath, path.join(assetsDir, "admin.js"));
await copyFile(adminClientScriptPath, path.join(assetsDir, "admin-client.js"));
await copyFile(checkinScriptPath, path.join(assetsDir, "checkin.js"));
await copyFile(checkinI18nScriptPath, path.join(assetsDir, "i18n.js"));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const normalisePhone = (value) => value.replace(/[^\d+]/g, "");
const whatsappHref = `https://wa.me/${normalisePhone(config.links.whatsapp).replace("+", "")}`;

const extractVideoId = (url) => {
  const parsed = new URL(url);
  if (parsed.hostname.includes("youtu.be")) {
    return parsed.pathname.replace("/", "");
  }
  if (parsed.pathname.startsWith("/shorts/")) {
    return parsed.pathname.split("/")[2];
  }
  if (parsed.searchParams.has("v")) {
    return parsed.searchParams.get("v");
  }
  return "";
};

const toPath = (segments) => (segments.length === 0 ? "" : `${segments.join("/")}/`);
const relPrefix = (segments) => (segments.length === 0 ? "./" : "../".repeat(segments.length));
const hrefFrom = (currentSegments, targetSegments = [], hash = "") =>
  `${relPrefix(currentSegments)}${toPath(targetSegments)}${hash}`;
const canonicalPath = (segments) => (segments.length === 0 ? "/" : `/${segments.join("/")}/`);

const icon = {
  whatsapp: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.4A9.3 9.3 0 0 0 4.1 16.6L2.8 21.2l4.8-1.3A9.3 9.3 0 1 0 12 2.4Zm0 15.6c-1.5 0-2.9-.4-4.1-1.2l-.3-.2-2.8.8.8-2.7-.2-.3A7 7 0 1 1 12 18Z"/>
      <path d="M8.8 7.7c-.2-.4-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1-.9 2.3.1 1.2 1 2.4 1.2 2.7.2.2 1.9 3 4.7 4.1 2.8 1.1 2.8.8 3.3.8.5-.1 1.8-.7 2.1-1.4.2-.7.2-1.2.2-1.3s-.2-.2-.5-.4l-1.7-.8c-.3-.1-.5-.2-.8.2l-.8 1c-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.5-1.4-1.7-.1-.2 0-.3.1-.4l.5-.6c.2-.2.3-.3.4-.5.1-.2.1-.4 0-.5l-.8-1.8Z"/>
    </svg>
  `,
  airbnb: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2c-1 0-1.8.5-2.3 1.4L5 14.2c-.4.8-.6 1.5-.6 2.1 0 2 1.5 3.5 3.6 3.5 1.5 0 2.8-.8 4-2.6 1.2 1.8 2.5 2.6 4 2.6 2.1 0 3.6-1.5 3.6-3.5 0-.6-.2-1.3-.6-2.1l-4.7-9.6c-.5-.9-1.3-1.4-2.3-1.4Zm0 3.1 3.9 8c.2.5.3.9.3 1.2 0 .8-.5 1.3-1.2 1.3-.8 0-1.6-.7-2.6-2.3-.1-.2-.3-.3-.4-.5-.2.2-.3.3-.4.5-1 1.6-1.8 2.3-2.6 2.3-.7 0-1.2-.5-1.2-1.3 0-.3.1-.7.3-1.2l3.9-8Zm0 3.1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 1.8c.4 0 .7.3.7.7 0 .4-.3.7-.7.7-.4 0-.7-.3-.7-.7 0-.4.3-.7.7-.7Z"/>
    </svg>
  `,
  play: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9 9 4 9 9Zm-11.5-4.2v8.4l6.5-4.2-6.5-4.2Z"/>
    </svg>
  `,
  globe: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm6.9 8H15.8a16 16 0 0 0-1-4.6 7 7 0 0 1 4.1 4.6Zm-6.9-5c.6 0 1.8 1.8 2.3 5H9.7c.5-3.2 1.7-5 2.3-5ZM5.1 12c0-.3 0-.6.1-.9h3.3a18.7 18.7 0 0 0 0 1.8H5.2c-.1-.3-.1-.6-.1-.9Zm.9 2.7h3.1c.2 1.7.6 3.3 1.2 4.6A7 7 0 0 1 6 14.7Zm3.1-4.2H6A7 7 0 0 1 10.3 6c-.6 1.3-1 2.9-1.2 4.5Zm2 8.8c-.6 0-1.8-1.8-2.3-4.6h4.6c-.5 2.8-1.7 4.6-2.3 4.6Zm2.5 0c.6-1.3 1-2.9 1.2-4.6H18a7 7 0 0 1-4.4 4.6Zm1.4-6.4a18.7 18.7 0 0 0 0-1.8h3.3c.1.3.1.6.1.9s0 .6-.1.9H15Z"/>
    </svg>
  `,
  home: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.8 3.5 10.6l1.2 1.6 1.3-1v8.9h5.2v-5.4h1.6v5.4H18v-8.9l1.3 1 1.2-1.6L12 3.8Z"/>
    </svg>
  `,
  arrow: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m13.4 5.4-1.4 1.4 4.2 4.2H4v2h12.2L12 17.2l1.4 1.4 6.6-6.6-6.6-6.6Z"/>
    </svg>
  `
};

const imageOutputs = [];

for (const [index, image] of config.gallery.entries()) {
  const inputPath = path.join(sourceImagesDir, image.source);
  const slug = `photo-${index + 1}`;
  const webpName = `${slug}.webp`;
  const jpegName = `${slug}.jpg`;

  await sharp(inputPath)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(assetsDir, webpName));

  await sharp(inputPath)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(assetsDir, jpegName));

  imageOutputs.push({
    alt: image.alt,
    webp: `assets/${webpName}`,
    jpeg: `assets/${jpegName}`,
    large: index < 2
  });
}

const enrichVideo = (video, locale) => {
  const translated = videoCopy[video.slug]?.[locale];
  return {
    ...video,
    title: translated?.title ?? video.title,
    description: translated?.description ?? video.description,
    notes: video.notes,
    videoId: extractVideoId(video.url)
  };
};

const pageMeta = (locale, segments, title, description, prefix) => `
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#214955" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(`${config.site.domain}${canonicalPath(segments)}`)}" />
    <meta property="og:image" content="${escapeHtml(`${config.site.domain}/${imageOutputs[0].jpeg}`)}" />
    <link rel="canonical" href="${escapeHtml(`${config.site.domain}${canonicalPath(segments)}`)}" />
    ${localeOrder
      .map((entry) => {
        const localeSegments = entry === "en" ? [] : [entry];
        if (segments.length > 0) {
          const slug = segments[segments.length - 1];
          if (segments.length === 1 && locale === "en") {
            localeSegments.push(slug);
          } else if (segments.length === 2) {
            localeSegments.push(slug);
          }
        }
        return `<link rel="alternate" hreflang="${entry}" href="${escapeHtml(`${config.site.domain}${canonicalPath(localeSegments)}`)}" />`;
      })
      .join("\n    ")}
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(config.site.domain)}" />
    <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>${styles}</style>
`;

const renderLanguageSwitcher = (locale, currentSegments, slug = null) => `
  <div class="lang-switcher" aria-label="${escapeHtml(ui[locale].switcherLabel)}">
    ${localeOrder
      .map((entry) => {
        const targetSegments = entry === "en" ? [] : [entry];
        if (slug) targetSegments.push(slug);
        const href = hrefFrom(currentSegments, targetSegments);
        return `<a href="${href}" data-locale-switch="${entry}" class="lang-switcher__link${entry === locale ? " is-current" : ""}">${entry.toUpperCase()}</a>`;
      })
      .join("")}
  </div>
`;

const renderHeader = (locale, currentSegments, slug = null) => {
  const t = ui[locale];
  const homeSegments = locale === "en" ? [] : [locale];
  return `
    <header class="topbar">
      <div class="topbar__inner">
        <a class="brand" href="${hrefFrom(currentSegments, homeSegments)}" aria-label="${escapeHtml(config.site.name)} home">
          <span class="brand__name">${escapeHtml(config.site.name)}</span>
          <span class="brand__tag">${escapeHtml(localeNames[locale])} | ${escapeHtml(config.site.tagline)}</span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a href="${hrefFrom(currentSegments, homeSegments, "#about")}">${escapeHtml(t.navAbout)}</a>
          <a href="${hrefFrom(currentSegments, homeSegments, "#guides")}">${escapeHtml(t.navGuides)}</a>
          <a href="${hrefFrom(currentSegments, homeSegments, "#info")}">${escapeHtml(t.navInfo)}</a>
          <a href="${hrefFrom(currentSegments, homeSegments, "#gallery")}">${escapeHtml(t.navGallery)}</a>
          <a href="${hrefFrom(currentSegments, homeSegments, "#contact")}">${escapeHtml(t.navContact)}</a>
        </nav>
        ${renderLanguageSwitcher(locale, currentSegments, slug)}
      </div>
    </header>
  `;
};

const renderFooter = (locale) => `
  <footer class="footer">
    <p>${escapeHtml(ui[locale].footer)} | ${escapeHtml(config.site.name)}</p>
  </footer>
`;

const renderButton = ({ href, label, variant = "solid", iconSvg = "", external = false }) => `
  <a class="button button--${variant}" href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>
    ${iconSvg}<span>${escapeHtml(label)}</span>
  </a>
`;

const renderPicture = (currentSegments, image, className, eager = false) => {
  const prefix = relPrefix(currentSegments);
  return `
    <picture class="${className}">
      <source srcset="${prefix}${image.webp}" type="image/webp" />
      <img src="${prefix}${image.jpeg}" alt="${escapeHtml(image.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} />
    </picture>
  `;
};

const renderHomepage = (locale) => {
  const t = ui[locale];
  const currentSegments = locale === "en" ? [] : [locale];
  const homeSegments = currentSegments;
  const heroImage = imageOutputs[0];
  const supportCards = [
    {
      href: whatsappHref,
      title: t.supportCards.whatsapp.title,
      body: t.supportCards.whatsapp.body,
      theme: "whatsapp",
      iconSvg: icon.whatsapp,
      external: true
    },
    {
      href: config.links.airbnb,
      title: t.supportCards.airbnb.title,
      body: t.supportCards.airbnb.body,
      theme: "airbnb",
      iconSvg: icon.airbnb,
      external: true
    },
    {
      href: hrefFrom(currentSegments, homeSegments, "#guides"),
      title: t.supportCards.guides.title,
      body: t.supportCards.guides.body,
      theme: "guides",
      iconSvg: icon.play,
      external: false
    }
  ];

  const guideCards = config.videos
    .map((video) => {
      const localizedVideo = enrichVideo(video, locale);
      const guideSegments = locale === "en" ? [video.slug] : [locale, video.slug];
      const thumb = `https://i.ytimg.com/vi/${localizedVideo.videoId}/hqdefault.jpg`;
      return `
        <article class="guide-card reveal">
          <a class="guide-card__link" href="${hrefFrom(currentSegments, guideSegments)}">
            <div class="guide-card__thumb">
              <img src="${thumb}" alt="${escapeHtml(localizedVideo.title)}" loading="lazy" referrerpolicy="no-referrer" />
              <span class="guide-card__play">${icon.play}</span>
            </div>
            <div class="guide-card__body">
              <div class="guide-card__eyebrow">${escapeHtml(t.videoLabel)}</div>
              <h3>${escapeHtml(localizedVideo.title)}</h3>
              <p>${escapeHtml(localizedVideo.description)}</p>
              <span class="guide-card__cta">${escapeHtml(t.watchGuide)} ${icon.arrow}</span>
            </div>
          </a>
        </article>
      `;
    })
    .join("");

  const guideBlocks = t.guideSections
    .map(
      (section) => `
        <article class="guide-block reveal">
          <h3>${escapeHtml(section.title)}</h3>
          <ul class="guide-list">
            ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");

  const infoPanels = t.infoPanels
    .map(
      (item) => `
        <article class="panel reveal">
          <h3 class="panel__title">${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `
    )
    .join("");

  const galleryCards = imageOutputs
    .map(
      (image) => `
        <figure class="gallery-card reveal${image.large ? " gallery-card--large" : ""}">
          ${renderPicture(currentSegments, image, "gallery-card__media")}
        </figure>
      `
    )
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(t.htmlLang)}">
  <head>
${pageMeta(locale, currentSegments, `${config.site.name} | ${t.titleSuffix}`, config.site.description, relPrefix(currentSegments))}
  </head>
  <body data-page="home" data-locale="${locale}" data-home-path="${hrefFrom(currentSegments, [])}">
    <div class="site-shell">
      ${renderHeader(locale, currentSegments)}
      <main id="top">
        <section class="hero hero--home">
          <div class="hero__media reveal">
            ${renderPicture(currentSegments, heroImage, "hero__image-wrap", true)}
            <div class="hero__overlay"></div>
            <div class="hero__copy">
              <div class="eyebrow">${escapeHtml(t.supportEyebrow)}</div>
              <h1>${escapeHtml(t.supportTitle)}</h1>
              <p class="hero__lede">${escapeHtml(t.supportBody)}</p>
              <div class="hero__actions">
                ${renderButton({ href: whatsappHref, label: t.heroPrimary, iconSvg: icon.whatsapp, external: true })}
                ${renderButton({
                  href: config.links.airbnb,
                  label: t.heroSecondary,
                  iconSvg: icon.airbnb,
                  variant: "ghost",
                  external: true
                })}
              </div>
            </div>
          </div>
          <aside class="support-panel reveal">
            <div class="section__kicker">${escapeHtml(t.supportHeading)}</div>
            <div class="support-grid">
              ${supportCards
                .map(
                  (card) => `
                    <a class="support-card support-card--${card.theme}" href="${card.href}"${card.external ? ' target="_blank" rel="noreferrer"' : ""}>
                      <span class="support-card__icon">${card.iconSvg}</span>
                      <span class="support-card__text">
                        <strong>${escapeHtml(card.title)}</strong>
                        <span>${escapeHtml(card.body)}</span>
                      </span>
                      <span class="support-card__arrow">${icon.arrow}</span>
                    </a>
                  `
                )
                .join("")}
            </div>
          </aside>
        </section>

        <section class="section section--split" id="about">
          <div class="reveal">
            <div class="section__kicker">${escapeHtml(t.aboutKicker)}</div>
            <h2>${escapeHtml(t.aboutTitle)}</h2>
            <p class="section__intro">${escapeHtml(t.aboutBody)}</p>
          </div>
          <div class="panel reveal">
            <h3 class="panel__title">${escapeHtml(t.aboutPanelTitle)}</h3>
            <ul class="highlight-list">
              ${t.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        </section>

        <section class="section" id="guides">
          <div class="section-heading reveal">
            <div>
              <div class="section__kicker">${escapeHtml(t.guidesKicker)}</div>
              <h2>${escapeHtml(t.guidesTitle)}</h2>
              <p class="section__intro">${escapeHtml(t.guidesIntro)}</p>
            </div>
            ${renderButton({
              href: config.links.youtubeChannel,
              label: t.watchChannel,
              iconSvg: icon.play,
              variant: "soft",
              external: true
            })}
          </div>
          <div class="guide-grid guide-grid--cards">${guideCards}</div>
        </section>

        <section class="section section--split" id="info">
          <div class="reveal">
            <div class="section__kicker">${escapeHtml(t.infoKicker)}</div>
            <h2>${escapeHtml(t.infoTitle)}</h2>
            <p class="section__intro">${escapeHtml(t.infoIntro)}</p>
          </div>
          <div class="panel-grid">${infoPanels}</div>
          <div class="guide-grid" style="grid-column: 1 / -1;">${guideBlocks}</div>
        </section>

        <section class="section" id="gallery">
          <div class="reveal">
            <div class="section__kicker">${escapeHtml(t.galleryKicker)}</div>
            <h2>${escapeHtml(t.galleryTitle)}</h2>
            <p class="section__intro">${escapeHtml(t.galleryIntro)}</p>
          </div>
          <div class="gallery-grid">${galleryCards}</div>
        </section>

        <section class="section" id="contact">
          <div class="contact-card reveal">
            <div>
              <div class="section__kicker">${escapeHtml(t.contactKicker)}</div>
              <h2>${escapeHtml(t.contactTitle)}</h2>
              <p>${escapeHtml(t.contactBody)}</p>
            </div>
            <div class="contact-card__actions">
              ${renderButton({ href: whatsappHref, label: t.contactPrimary, iconSvg: icon.whatsapp, external: true })}
              ${renderButton({
                href: config.links.airbnb,
                label: t.contactSecondary,
                iconSvg: icon.airbnb,
                variant: "soft",
                external: true
              })}
            </div>
          </div>
        </section>
      </main>
      ${renderFooter(locale)}
    </div>
    <script>${appScript}</script>
  </body>
</html>`;
};

const renderGuidePage = (locale, videoIndex) => {
  const video = enrichVideo(config.videos[videoIndex], locale);
  const t = ui[locale];
  const currentSegments = locale === "en" ? [video.slug] : [locale, video.slug];
  const homeSegments = locale === "en" ? [] : [locale];
  const embed = `https://www.youtube-nocookie.com/embed/${video.videoId}`;
  const prefix = relPrefix(currentSegments);
  const related = config.videos
    .filter((entry) => entry.slug !== video.slug)
    .slice(0, 3)
    .map((entry) => {
      const localizedEntry = enrichVideo(entry, locale);
      const href = hrefFrom(currentSegments, locale === "en" ? [entry.slug] : [locale, entry.slug]);
      return `
        <article class="mini-guide-card">
          <a href="${href}">
            <strong>${escapeHtml(localizedEntry.title)}</strong>
            <span>${escapeHtml(localizedEntry.description)}</span>
          </a>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="${escapeHtml(t.htmlLang)}">
  <head>
${pageMeta(locale, currentSegments, `${video.title} | ${config.site.name}`, video.description, prefix)}
  </head>
  <body data-page="guide" data-locale="${locale}" data-home-path="${hrefFrom(currentSegments, homeSegments)}">
    <div class="site-shell">
      ${renderHeader(locale, currentSegments, video.slug)}
      <main>
        <section class="hero hero--guide">
          <div class="guide-hero reveal">
            <div class="guide-hero__copy">
              <a class="back-link" href="${hrefFrom(currentSegments, homeSegments, "#guides")}">${icon.home}<span>${escapeHtml(t.backGuides)}</span></a>
              <div class="eyebrow">${escapeHtml(t.videoLabel)}</div>
              <h1>${escapeHtml(video.title)}</h1>
              <p class="hero__lede">${escapeHtml(video.description)}</p>
              <div class="hero__actions">
                ${renderButton({ href: whatsappHref, label: t.contactPrimary, iconSvg: icon.whatsapp, external: true })}
                ${renderButton({
                  href: config.links.airbnb,
                  label: t.contactSecondary,
                  iconSvg: icon.airbnb,
                  variant: "soft",
                  external: true
                })}
              </div>
            </div>
            <div class="guide-hero__frame">
              <iframe
                class="video-frame"
                src="${embed}"
                title="${escapeHtml(video.title)}"
                loading="eager"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              ></iframe>
            </div>
          </div>
        </section>

        <section class="section section--split section--tight">
          <div class="panel reveal">
            <h3 class="panel__title">${escapeHtml(t.notesTitle)}</h3>
            <p>${escapeHtml(t.notesIntro)}</p>
            <ul class="guide-list">
              ${video.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
            </ul>
          </div>
          <div class="panel panel--accent reveal">
            <h3 class="panel__title">${escapeHtml(t.guideSupportTitle)}</h3>
            <p>${escapeHtml(t.guideSupportBody)}</p>
            <div class="panel__actions">
              ${renderButton({ href: whatsappHref, label: t.contactPrimary, iconSvg: icon.whatsapp, external: true })}
              ${renderButton({
                href: hrefFrom(currentSegments, homeSegments, "#guides"),
                label: t.backHome,
                iconSvg: icon.home,
                variant: "soft"
              })}
            </div>
          </div>
        </section>

        <section class="section section--tight">
          <div class="section-heading reveal">
            <div>
              <div class="section__kicker">${escapeHtml(t.relatedTitle)}</div>
              <h2>${escapeHtml(t.relatedTitle)}</h2>
              <p class="section__intro">${escapeHtml(t.relatedIntro)}</p>
            </div>
          </div>
          <div class="mini-guide-grid">${related}</div>
        </section>
      </main>
      ${renderFooter(locale)}
    </div>
    <script>${appScript}</script>
  </body>
</html>`;
};

const writePage = async (segments, html) => {
  const dir = path.join(distDir, ...segments);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
};

const renderCheckinShell = ({ title, script }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${title} | Villa Laura</title>
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../assets/checkin.css">
  </head>
  <body>
    <main>
      <header class="top">
        <div>
          <h1>${title}</h1>
          <p>Villa Laura secure guest registration</p>
        </div>
        <a class="button secondary" href="/">Villa Laura</a>
      </header>
      <div id="app" class="stack">
        <section class="panel"><p>Loading...</p></section>
      </div>
    </main>
    <script type="module" src="../assets/${script}?v=localized-checkin-whatsapp-20260502"></script>
  </body>
</html>`;

for (const locale of localeOrder) {
  const homeSegments = locale === "en" ? [] : [locale];
  await writePage(homeSegments, renderHomepage(locale));

  for (let index = 0; index < config.videos.length; index += 1) {
    const video = config.videos[index];
    const guideSegments = locale === "en" ? [video.slug] : [locale, video.slug];
    await writePage(guideSegments, renderGuidePage(locale, index));
  }
}

await writePage(["admin"], renderCheckinShell({ title: "Admin", script: "admin.js" }));
await writePage(["checkin"], renderCheckinShell({ title: "Secure Check-In", script: "checkin.js" }));

await cp(distDir, docsDir, { recursive: true });
await writeFile(path.join(docsDir, ".nojekyll"), "");
await cp(sourceDocsDir, docsDir, { recursive: true });
