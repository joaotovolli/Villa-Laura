export const recyclingTranslations = {
  it: {
    htmlLang: "it",
    intlLocale: "it-IT",
    languageName: "Italiano",
    meta: {
      title: "Calendario raccolta rifiuti {year} | Villa Laura",
      description: "Calendario domestico Zona B per Tresnuraghes, con i prossimi 14 giorni e la guida alla raccolta differenziata."
    },
    header: {
      homeLabel: "Homepage di Villa Laura",
      tagline: "Calendario raccolta rifiuti",
      navigationLabel: "Navigazione principale",
      home: "Home",
      houseGuide: "Guida della casa",
      support: "Contatti",
      language: "Lingua"
    },
    page: {
      kicker: "Informazioni utili per gli ospiti",
      title: "Raccolta rifiuti a Tresnuraghes",
      intro: "Consulta rapidamente cosa viene ritirato oggi e nei prossimi 14 giorni. Le date sono quelle del calendario ufficiale {year} della Zona B.",
      zone: "Zona B · Tresnuraghes, Sagama e Montresta",
      audience: "Utenze domestiche · Villa Laura",
      validPeriod: "Periodo ufficiale disponibile: {validStart} – {validEnd}",
      householdOnly: "Le raccolte aggiuntive indicate esclusivamente per le utenze commerciali non sono mostrate come raccolte domestiche."
    },
    calendar: {
      title: "I prossimi 14 giorni",
      intro: "La vista parte dalla data corrente a Villa Laura (fuso orario Europe/Rome).",
      previousWeek: "Settimana precedente",
      today: "Oggi",
      nextWeek: "Settimana successiva",
      range: "Dal {start} al {end}",
      todayBadge: "Oggi",
      tomorrowBadge: "Domani",
      nextCollectionBadge: "Prossima raccolta",
      holidayBadge: "Variazione festiva",
      collection: "Raccolta prevista",
      noCollection: "Nessuna raccolta domestica",
      unavailable: "Calendario non disponibile per questa data",
      nextCollection: "Prossima raccolta: {date} — {categories}",
      noFutureCollection: "Non risultano altre raccolte nel periodo ufficiale disponibile.",
      outsideCoverage: "Il calendario ufficiale disponibile non copre questa data. Non viene ripetuto automaticamente lo schema del {year}.",
      viewAvailable: "Vedi il calendario {year}",
      availableRange: "Le date ufficiali disponibili vanno dal {start} al {end}.",
      loading: "Individuazione della data locale in corso…"
    },
    guide: {
      kicker: "Guida locale",
      title: "Cosa riciclare",
      intro: "Le indicazioni qui sotto riprendono esclusivamente il materiale fornito nel calendario ufficiale. Apri una categoria per vedere gli esempi.",
      accepted: "Cosa conferire",
      preparation: "Come prepararlo",
      notIncluded: "Da non conferire in questa categoria",
      localRule: "Regola locale"
    },
    sources: {
      kicker: "Documenti di riferimento",
      title: "Calendario ufficiale",
      intro: "La trascrizione delle date è stata verificata sull’originale italiano dell’Unione dei Comuni della Planargia.",
      originalPdf: "Apri il PDF ufficiale italiano completo",
      translatedPdf: "Apri il PDF tradotto ({translatedStart} – {translatedEnd})",
      translatedLimit: "Le versioni tradotte fornite coprono {translatedStart} – {translatedEnd}; l’originale italiano è la fonte autorevole per {validStart} – {validEnd}.",
      pdfFormat: "PDF, si apre in una nuova scheda"
    },
    fullSchedule: {
      kicker: "Consultazione senza JavaScript",
      title: "Tutte le raccolte domestiche del {year}",
      intro: "Sono elencati tutti i giorni con una raccolta domestica. Negli altri giorni compresi nel periodo ufficiale non è prevista alcuna raccolta domestica.",
      noScript: "La selezione automatica dei prossimi 14 giorni richiede JavaScript. Il calendario completo qui sotto rimane disponibile.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Informazioni sulla raccolta rifiuti per gli ospiti di Villa Laura",
    notes: {
      "commercial-summer-extra": "Raccolta aggiuntiva riservata alle utenze commerciali; esclusa dal calendario domestico di Villa Laura.",
      "easter-holiday-change": "Variazione festiva riportata nel calendario ufficiale.",
      "holiday-postponement": "Raccolta posticipata per festività, come indicato nel calendario ufficiale."
    },
    categories: {
      paper: {
        name: "Carta e cartone",
        shortName: "Carta",
        accepted: [
          "Giornali, riviste, dépliant, pieghevoli e altri stampati.",
          "Sacchetti di carta, anche con manici, e pacchetti di sigarette vuoti dopo aver tolto plastica e stagnola.",
          "Brik per succhi e latte, contenitori della pizza vuoti, scatole per scarpe e confezioni in cartone per vino, pasta, riso e detersivi."
        ],
        preparation: ["Svuotare i contenitori della pizza e togliere plastica e stagnola dai pacchetti di sigarette."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Vetro, latta e alluminio",
        shortName: "Vetro",
        accepted: [
          "Bottiglie, vasi, vasetti e altri contenitori in vetro, compresi i cocci di bottiglie e vasetti.",
          "Latte e lattine di olio, bibite e pelati; scatole metalliche di tonno e carne e contenitori in banda stagnata."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plastica",
        shortName: "Plastica",
        accepted: [
          "Bottiglie e flaconi puliti in PET o HDPE per acqua, bibite, olio e succhi.",
          "Flaconi per sciroppi, creme, salse, detersivi, saponi, igiene della casa e della persona e acqua distillata, fino a 5 litri.",
          "Blister, contenitori rigidi per cancelleria, film di imballaggio in polietilene, shopper e imballaggi secondari per bottiglie."
        ],
        preparation: ["Conferire bottiglie e flaconi puliti e senza residui; la capacità massima indicata è 5 litri."],
        notIncluded: ["Giocattoli, bacinelle, tavolini, seggiole e altri oggetti di plastica ingombranti."],
        rule: "Gli oggetti di plastica ingombranti vanno gestiti come ingombranti chiamando il numero verde 800 362662 o portandoli all’ecocentro."
      },
      organic: {
        name: "Umido",
        shortName: "Umido",
        accepted: [
          "Avanzi di cucina, ossa e scarti di carne o pesce, uova e gusci, fondi di caffè.",
          "Pane, pasta, riso e farina avanzati; gusci di cozze, vongole e simili.",
          "Foglie e fiori recisi anche secchi, alimenti deteriorati, erba in piccole quantità e tovaglioli o fazzoletti di carta non stampati."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Secco residuo",
        shortName: "Secco",
        accepted: [
          "Carta e cartone contaminati.",
          "CD, musicassette, videocassette e relative custodie; materiali poliaccoppiati come la carta per salumeria.",
          "Beni durevoli non riciclabili e quanto non può essere riciclato nelle altre categorie."
        ],
        preparation: [],
        notIncluded: [],
        rule: "Il calendario ufficiale indica una raccolta quindicinale a settimane alterne: seguire sempre le date riportate sopra."
      }
    }
  },
  en: {
    htmlLang: "en",
    intlLocale: "en-GB",
    languageName: "English",
    meta: {
      title: "{year} recycling collection calendar | Villa Laura",
      description: "Zone B household collection calendar for Tresnuraghes, with the next 14 days and the local recycling guide."
    },
    header: {
      homeLabel: "Villa Laura homepage",
      tagline: "Recycling collection calendar",
      navigationLabel: "Primary navigation",
      home: "Home",
      houseGuide: "House guide",
      support: "Contact",
      language: "Language"
    },
    page: {
      kicker: "Useful guest information",
      title: "Waste collection in Tresnuraghes",
      intro: "See at a glance what is collected today and over the next 14 days. Dates come from the official {year} Zone B calendar.",
      zone: "Zone B · Tresnuraghes, Sagama and Montresta",
      audience: "Household users · Villa Laura",
      validPeriod: "Official period available: {validStart} – {validEnd}",
      householdOnly: "Additional collections marked exclusively for commercial users are not shown as Villa Laura household collections."
    },
    calendar: {
      title: "The next 14 days",
      intro: "The view starts from the current date at Villa Laura (Europe/Rome time).",
      previousWeek: "Previous week",
      today: "Today",
      nextWeek: "Next week",
      range: "{start} to {end}",
      todayBadge: "Today",
      tomorrowBadge: "Tomorrow",
      nextCollectionBadge: "Next collection",
      holidayBadge: "Holiday change",
      collection: "Scheduled collection",
      noCollection: "No household collection",
      unavailable: "Calendar unavailable for this date",
      nextCollection: "Next collection: {date} — {categories}",
      noFutureCollection: "There are no later collections in the available official period.",
      outsideCoverage: "The available official calendar does not cover this date. The {year} pattern is never repeated automatically.",
      viewAvailable: "View the {year} calendar",
      availableRange: "Official dates are available from {start} to {end}.",
      loading: "Finding the local date…"
    },
    guide: {
      kicker: "Local guide",
      title: "What to recycle",
      intro: "The guidance below comes only from the supplied official calendar. Open a category to see the examples.",
      accepted: "What to include",
      preparation: "How to prepare it",
      notIncluded: "Do not include in this category",
      localRule: "Local rule"
    },
    sources: {
      kicker: "Reference documents",
      title: "Official calendar",
      intro: "Every date was checked against the Italian original issued by the Union of Municipalities of Planargia.",
      originalPdf: "Open the complete official Italian PDF",
      translatedPdf: "Open the translated PDF ({translatedStart} – {translatedEnd})",
      translatedLimit: "The supplied translated editions cover {translatedStart} – {translatedEnd}; the Italian original is authoritative for {validStart} – {validEnd}.",
      pdfFormat: "PDF, opens in a new tab"
    },
    fullSchedule: {
      kicker: "Works without JavaScript",
      title: "All {year} household collections",
      intro: "Every date with a household collection is listed. All other dates within the official period have no household collection.",
      noScript: "Automatic selection of the next 14 days needs JavaScript. The complete schedule below remains available.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Waste collection information for Villa Laura guests",
    notes: {
      "commercial-summer-extra": "Additional collection for commercial users only; excluded from Villa Laura's household calendar.",
      "easter-holiday-change": "Holiday schedule change shown in the official calendar.",
      "holiday-postponement": "Collection postponed for a public holiday, as shown in the official calendar."
    },
    categories: {
      paper: {
        name: "Paper & cardboard",
        shortName: "Paper",
        accepted: [
          "Newspapers, magazines, leaflets, folded brochures and other printed material.",
          "Paper bags, including handled bags, and empty cigarette packets after removing plastic and foil.",
          "Fruit-juice and milk cartons, empty pizza boxes, shoe boxes, and cardboard packaging for wine, pasta, rice and detergents."
        ],
        preparation: ["Empty pizza boxes and remove plastic and foil from cigarette packets."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Glass, cans & aluminium",
        shortName: "Glass",
        accepted: [
          "Glass bottles, jars and containers, including broken glass from bottles and jars.",
          "Oil, drink and peeled-tomato cans; metal tuna and meat tins; tinplate containers."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plastic",
        shortName: "Plastic",
        accepted: [
          "Clean PET and HDPE bottles and containers for water, drinks, oil and juice.",
          "Syrup, cream, sauce, detergent, soap, household-care, personal-care and distilled-water containers up to 5 litres.",
          "Blister packs, rigid stationery containers, polyethylene wrapping film, carrier bags and secondary bottle packaging."
        ],
        preparation: ["Containers must be clean and free of residue; the stated maximum capacity is 5 litres."],
        notIncluded: ["Bulky plastic items such as toys, basins, small tables and chairs."],
        rule: "Treat bulky plastic objects as bulky waste: call the freephone number 800 362662 or take them to the recycling centre."
      },
      organic: {
        name: "Organic waste",
        shortName: "Organic",
        accepted: [
          "Kitchen scraps, bones and meat or fish waste, eggs and shells, and coffee grounds.",
          "Leftover bread, pasta, rice and flour; mussel, clam and similar shells.",
          "Leaves and cut flowers, fresh or dry; spoiled food; small amounts of grass; unprinted paper napkins and tissues."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Non-recyclable waste",
        shortName: "Residual",
        accepted: [
          "Contaminated paper and cardboard.",
          "CDs, audio and video cassettes and their cases; composite materials such as deli paper.",
          "Non-recyclable durable goods and anything that cannot go into the other recycling categories."
        ],
        preparation: [],
        notIncluded: [],
        rule: "The official calendar describes this as a fortnightly, alternate-week collection; always follow the exact dates above."
      }
    }
  },
  es: {
    htmlLang: "es",
    intlLocale: "es-ES",
    languageName: "Español",
    meta: {
      title: "Calendario de recogida {year} | Villa Laura",
      description: "Calendario doméstico de la Zona B para Tresnuraghes, con los próximos 14 días y la guía local de reciclaje."
    },
    header: {
      homeLabel: "Página de inicio de Villa Laura",
      tagline: "Calendario de recogida",
      navigationLabel: "Navegación principal",
      home: "Inicio",
      houseGuide: "Guía de la casa",
      support: "Contacto",
      language: "Idioma"
    },
    page: {
      kicker: "Información útil para huéspedes",
      title: "Recogida de residuos en Tresnuraghes",
      intro: "Consulta rápidamente qué se recoge hoy y durante los próximos 14 días. Las fechas proceden del calendario oficial {year} de la Zona B.",
      zone: "Zona B · Tresnuraghes, Sagama y Montresta",
      audience: "Usuarios domésticos · Villa Laura",
      validPeriod: "Periodo oficial disponible: {validStart} – {validEnd}",
      householdOnly: "Las recogidas adicionales indicadas exclusivamente para comercios no aparecen como recogidas domésticas de Villa Laura."
    },
    calendar: {
      title: "Los próximos 14 días",
      intro: "La vista comienza en la fecha actual de Villa Laura (zona horaria Europe/Rome).",
      previousWeek: "Semana anterior",
      today: "Hoy",
      nextWeek: "Semana siguiente",
      range: "Del {start} al {end}",
      todayBadge: "Hoy",
      tomorrowBadge: "Mañana",
      nextCollectionBadge: "Próxima recogida",
      holidayBadge: "Cambio por festivo",
      collection: "Recogida prevista",
      noCollection: "Sin recogida doméstica",
      unavailable: "Calendario no disponible para esta fecha",
      nextCollection: "Próxima recogida: {date} — {categories}",
      noFutureCollection: "No hay más recogidas en el periodo oficial disponible.",
      outsideCoverage: "El calendario oficial disponible no cubre esta fecha. El patrón de {year} no se repite automáticamente.",
      viewAvailable: "Ver el calendario de {year}",
      availableRange: "Hay fechas oficiales disponibles del {start} al {end}.",
      loading: "Buscando la fecha local…"
    },
    guide: {
      kicker: "Guía local",
      title: "Qué reciclar",
      intro: "Las indicaciones siguientes proceden únicamente del calendario oficial suministrado. Abre una categoría para ver los ejemplos.",
      accepted: "Qué depositar",
      preparation: "Cómo prepararlo",
      notIncluded: "No depositar en esta categoría",
      localRule: "Norma local"
    },
    sources: {
      kicker: "Documentos de referencia",
      title: "Calendario oficial",
      intro: "Todas las fechas se comprobaron con el original italiano de la Unión de Municipios de Planargia.",
      originalPdf: "Abrir el PDF oficial italiano completo",
      translatedPdf: "Abrir el PDF traducido ({translatedStart} – {translatedEnd})",
      translatedLimit: "Las ediciones traducidas suministradas cubren {translatedStart} – {translatedEnd}; el original italiano es la fuente autorizada para {validStart} – {validEnd}.",
      pdfFormat: "PDF, se abre en una pestaña nueva"
    },
    fullSchedule: {
      kicker: "Funciona sin JavaScript",
      title: "Todas las recogidas domésticas de {year}",
      intro: "Se enumeran todos los días con recogida doméstica. En las demás fechas del periodo oficial no hay recogida doméstica.",
      noScript: "La selección automática de los próximos 14 días necesita JavaScript. El calendario completo sigue disponible abajo.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Información sobre residuos para los huéspedes de Villa Laura",
    notes: {
      "commercial-summer-extra": "Recogida adicional solo para comercios; excluida del calendario doméstico de Villa Laura.",
      "easter-holiday-change": "Cambio por festivo indicado en el calendario oficial.",
      "holiday-postponement": "Recogida aplazada por festivo, según el calendario oficial."
    },
    categories: {
      paper: {
        name: "Papel y cartón",
        shortName: "Papel",
        accepted: [
          "Periódicos, revistas, folletos, desplegables y otros impresos.",
          "Bolsas de papel y paquetes de cigarrillos vacíos después de quitar el plástico y el papel de aluminio.",
          "Briks de zumo y leche, cajas de pizza vacías, cajas de zapatos y envases de cartón para vino, pasta, arroz y detergentes."
        ],
        preparation: ["Vacía las cajas de pizza y retira el plástico y el aluminio de los paquetes de cigarrillos."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Vidrio, latas y aluminio",
        shortName: "Vidrio",
        accepted: [
          "Botellas, tarros y recipientes de vidrio, incluidos los fragmentos de botellas y tarros.",
          "Latas de aceite, bebidas y tomate pelado; latas metálicas de atún y carne; recipientes de hojalata."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plástico",
        shortName: "Plástico",
        accepted: [
          "Botellas y envases limpios de PET y HDPE para agua, bebidas, aceite y zumo.",
          "Envases de sirope, crema, salsa, detergente, jabón, higiene doméstica o personal y agua destilada, hasta 5 litros.",
          "Blísteres, recipientes rígidos de papelería, film de polietileno, bolsas y embalajes secundarios para botellas."
        ],
        preparation: ["Los envases deben estar limpios y sin residuos; la capacidad máxima indicada es de 5 litros."],
        notIncluded: ["Objetos voluminosos de plástico como juguetes, barreños, mesas pequeñas y sillas."],
        rule: "Gestiona los objetos voluminosos de plástico como enseres: llama al número gratuito 800 362662 o llévalos al ecocentro."
      },
      organic: {
        name: "Orgánico",
        shortName: "Orgánico",
        accepted: [
          "Restos de cocina, huesos y restos de carne o pescado, huevos y cáscaras, y posos de café.",
          "Sobras de pan, pasta, arroz y harina; conchas de mejillones, almejas y similares.",
          "Hojas y flores cortadas, frescas o secas; alimentos estropeados; pequeñas cantidades de hierba; servilletas y pañuelos de papel sin imprimir."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Resto no reciclable",
        shortName: "Resto",
        accepted: [
          "Papel y cartón contaminados.",
          "CD, casetes de audio y vídeo y sus cajas; materiales compuestos como el papel para charcutería.",
          "Bienes duraderos no reciclables y cualquier objeto que no pueda ir en las demás categorías."
        ],
        preparation: [],
        notIncluded: [],
        rule: "El calendario oficial define esta recogida como quincenal, en semanas alternas; sigue siempre las fechas exactas indicadas arriba."
      }
    }
  },
  fr: {
    htmlLang: "fr",
    intlLocale: "fr-FR",
    languageName: "Français",
    meta: {
      title: "Calendrier de collecte {year} | Villa Laura",
      description: "Calendrier des ménages de la Zone B pour Tresnuraghes, avec les 14 prochains jours et le guide local du tri."
    },
    header: {
      homeLabel: "Accueil de Villa Laura",
      tagline: "Calendrier de collecte",
      navigationLabel: "Navigation principale",
      home: "Accueil",
      houseGuide: "Guide de la maison",
      support: "Contact",
      language: "Langue"
    },
    page: {
      kicker: "Informations utiles aux voyageurs",
      title: "Collecte des déchets à Tresnuraghes",
      intro: "Voyez rapidement ce qui est collecté aujourd’hui et pendant les 14 prochains jours. Les dates proviennent du calendrier officiel {year} de la Zone B.",
      zone: "Zone B · Tresnuraghes, Sagama et Montresta",
      audience: "Usagers domestiques · Villa Laura",
      validPeriod: "Période officielle disponible : {validStart} – {validEnd}",
      householdOnly: "Les collectes supplémentaires réservées aux commerces ne sont pas affichées comme collectes domestiques de Villa Laura."
    },
    calendar: {
      title: "Les 14 prochains jours",
      intro: "L’affichage commence à la date actuelle de Villa Laura (fuseau Europe/Rome).",
      previousWeek: "Semaine précédente",
      today: "Aujourd’hui",
      nextWeek: "Semaine suivante",
      range: "Du {start} au {end}",
      todayBadge: "Aujourd’hui",
      tomorrowBadge: "Demain",
      nextCollectionBadge: "Prochaine collecte",
      holidayBadge: "Changement jour férié",
      collection: "Collecte prévue",
      noCollection: "Aucune collecte domestique",
      unavailable: "Calendrier indisponible pour cette date",
      nextCollection: "Prochaine collecte : {date} — {categories}",
      noFutureCollection: "Il n’y a pas d’autre collecte dans la période officielle disponible.",
      outsideCoverage: "Le calendrier officiel disponible ne couvre pas cette date. Le programme {year} n’est jamais répété automatiquement.",
      viewAvailable: "Voir le calendrier {year}",
      availableRange: "Les dates officielles sont disponibles du {start} au {end}.",
      loading: "Recherche de la date locale…"
    },
    guide: {
      kicker: "Guide local",
      title: "Que recycler",
      intro: "Les consignes ci-dessous proviennent uniquement du calendrier officiel fourni. Ouvrez une catégorie pour voir les exemples.",
      accepted: "À déposer",
      preparation: "Préparation",
      notIncluded: "À ne pas déposer dans cette catégorie",
      localRule: "Règle locale"
    },
    sources: {
      kicker: "Documents de référence",
      title: "Calendrier officiel",
      intro: "Chaque date a été vérifiée sur l’original italien de l’Union des communes de la Planargia.",
      originalPdf: "Ouvrir le PDF officiel italien complet",
      translatedPdf: "Ouvrir le PDF traduit ({translatedStart} – {translatedEnd})",
      translatedLimit: "Les éditions traduites fournies couvrent {translatedStart} – {translatedEnd} ; l’original italien fait foi pour {validStart} – {validEnd}.",
      pdfFormat: "PDF, s’ouvre dans un nouvel onglet"
    },
    fullSchedule: {
      kicker: "Fonctionne sans JavaScript",
      title: "Toutes les collectes domestiques de {year}",
      intro: "Toutes les dates avec une collecte domestique sont indiquées. Les autres jours de la période officielle n’ont aucune collecte domestique.",
      noScript: "La sélection automatique des 14 prochains jours nécessite JavaScript. Le calendrier complet ci-dessous reste disponible.",
      collectionOn: "{date} : {categories}"
    },
    footer: "Informations sur les déchets pour les voyageurs de Villa Laura",
    notes: {
      "commercial-summer-extra": "Collecte supplémentaire réservée aux commerces ; exclue du calendrier domestique de Villa Laura.",
      "easter-holiday-change": "Changement lié à un jour férié indiqué dans le calendrier officiel.",
      "holiday-postponement": "Collecte reportée en raison d’un jour férié, comme indiqué dans le calendrier officiel."
    },
    categories: {
      paper: {
        name: "Papier et carton",
        shortName: "Papier",
        accepted: [
          "Journaux, magazines, dépliants, brochures pliées et autres imprimés.",
          "Sacs en papier et paquets de cigarettes vides après retrait du plastique et de l’aluminium.",
          "Briques de jus et de lait, boîtes à pizza vides, boîtes à chaussures et emballages en carton pour le vin, les pâtes, le riz et les détergents."
        ],
        preparation: ["Videz les boîtes à pizza et retirez le plastique et l’aluminium des paquets de cigarettes."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Verre, boîtes et aluminium",
        shortName: "Verre",
        accepted: [
          "Bouteilles, bocaux et récipients en verre, y compris les morceaux de bouteilles et de bocaux.",
          "Boîtes d’huile, de boissons et de tomates pelées ; boîtes métalliques de thon et de viande ; récipients en fer-blanc."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plastique",
        shortName: "Plastique",
        accepted: [
          "Bouteilles et flacons propres en PET ou HDPE pour l’eau, les boissons, l’huile et les jus.",
          "Flacons de sirop, crème, sauce, détergent, savon, produits d’entretien ou d’hygiène et eau distillée, jusqu’à 5 litres.",
          "Blisters, contenants rigides de papeterie, films d’emballage en polyéthylène, sacs et emballages secondaires de bouteilles."
        ],
        preparation: ["Les contenants doivent être propres et sans résidus ; la capacité maximale indiquée est de 5 litres."],
        notIncluded: ["Objets en plastique encombrants tels que jouets, bassines, petites tables et chaises."],
        rule: "Traitez les objets en plastique encombrants comme des encombrants : appelez le numéro gratuit 800 362662 ou apportez-les à la déchèterie."
      },
      organic: {
        name: "Déchets organiques",
        shortName: "Organique",
        accepted: [
          "Restes de cuisine, os et déchets de viande ou de poisson, œufs et coquilles, marc de café.",
          "Restes de pain, pâtes, riz et farine ; coquilles de moules, palourdes et similaires.",
          "Feuilles et fleurs coupées, fraîches ou sèches ; aliments avariés ; petites quantités d’herbe ; serviettes et mouchoirs en papier non imprimés."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Déchets résiduels",
        shortName: "Résiduel",
        accepted: [
          "Papier et carton souillés.",
          "CD, cassettes audio et vidéo et leurs boîtiers ; matériaux composites comme le papier de charcuterie.",
          "Biens durables non recyclables et tout objet qui ne peut pas aller dans les autres catégories."
        ],
        preparation: [],
        notIncluded: [],
        rule: "Le calendrier officiel décrit une collecte toutes les deux semaines, une semaine sur deux ; suivez toujours les dates exactes ci-dessus."
      }
    }
  },
  nl: {
    htmlLang: "nl",
    intlLocale: "nl-NL",
    languageName: "Nederlands",
    meta: {
      title: "Afvalkalender {year} | Villa Laura",
      description: "Huishoudelijke afvalkalender voor Zone B in Tresnuraghes, met de komende 14 dagen en de lokale afvalscheidingsgids."
    },
    header: {
      homeLabel: "Startpagina van Villa Laura",
      tagline: "Afvalkalender",
      navigationLabel: "Hoofdnavigatie",
      home: "Start",
      houseGuide: "Huisgids",
      support: "Contact",
      language: "Taal"
    },
    page: {
      kicker: "Nuttige informatie voor gasten",
      title: "Afvalinzameling in Tresnuraghes",
      intro: "Bekijk snel wat vandaag en in de komende 14 dagen wordt opgehaald. De datums komen uit de officiële kalender {year} voor Zone B.",
      zone: "Zone B · Tresnuraghes, Sagama en Montresta",
      audience: "Huishoudens · Villa Laura",
      validPeriod: "Beschikbare officiële periode: {validStart} – {validEnd}",
      householdOnly: "Extra inzamelingen die uitsluitend voor bedrijven zijn aangeduid, worden niet als huishoudelijke inzameling van Villa Laura getoond."
    },
    calendar: {
      title: "De komende 14 dagen",
      intro: "De weergave begint op de huidige datum bij Villa Laura (tijdzone Europe/Rome).",
      previousWeek: "Vorige week",
      today: "Vandaag",
      nextWeek: "Volgende week",
      range: "{start} tot en met {end}",
      todayBadge: "Vandaag",
      tomorrowBadge: "Morgen",
      nextCollectionBadge: "Eerstvolgende inzameling",
      holidayBadge: "Wijziging door feestdag",
      collection: "Geplande inzameling",
      noCollection: "Geen huishoudelijke inzameling",
      unavailable: "Geen kalender beschikbaar voor deze datum",
      nextCollection: "Eerstvolgende inzameling: {date} — {categories}",
      noFutureCollection: "Er zijn geen latere inzamelingen in de beschikbare officiële periode.",
      outsideCoverage: "De beschikbare officiële kalender dekt deze datum niet. Het patroon van {year} wordt nooit automatisch herhaald.",
      viewAvailable: "Bekijk de kalender van {year}",
      availableRange: "Officiële datums zijn beschikbaar van {start} tot en met {end}.",
      loading: "Lokale datum bepalen…"
    },
    guide: {
      kicker: "Lokale gids",
      title: "Wat kan worden gerecycled",
      intro: "De onderstaande aanwijzingen komen uitsluitend uit de meegeleverde officiële kalender. Open een categorie voor voorbeelden.",
      accepted: "Wat mag erin",
      preparation: "Voorbereiding",
      notIncluded: "Niet in deze categorie",
      localRule: "Lokale regel"
    },
    sources: {
      kicker: "Brondocumenten",
      title: "Officiële kalender",
      intro: "Elke datum is gecontroleerd aan de hand van het Italiaanse origineel van de Unie van Gemeenten van Planargia.",
      originalPdf: "Open de volledige officiële Italiaanse PDF",
      translatedPdf: "Open de vertaalde PDF ({translatedStart} – {translatedEnd})",
      translatedLimit: "De meegeleverde vertalingen beslaan {translatedStart} – {translatedEnd}; het Italiaanse origineel is leidend voor {validStart} – {validEnd}.",
      pdfFormat: "PDF, opent in een nieuw tabblad"
    },
    fullSchedule: {
      kicker: "Werkt zonder JavaScript",
      title: "Alle huishoudelijke inzamelingen van {year}",
      intro: "Elke datum met huishoudelijke inzameling staat vermeld. Op alle andere dagen binnen de officiële periode is er geen huishoudelijke inzameling.",
      noScript: "Voor de automatische selectie van de komende 14 dagen is JavaScript nodig. De volledige kalender hieronder blijft beschikbaar.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Afvalinformatie voor gasten van Villa Laura",
    notes: {
      "commercial-summer-extra": "Extra inzameling uitsluitend voor bedrijven; niet opgenomen in de huishoudelijke kalender van Villa Laura.",
      "easter-holiday-change": "Wijziging door een feestdag zoals vermeld in de officiële kalender.",
      "holiday-postponement": "Inzameling uitgesteld wegens een feestdag, zoals vermeld in de officiële kalender."
    },
    categories: {
      paper: {
        name: "Papier en karton",
        shortName: "Papier",
        accepted: [
          "Kranten, tijdschriften, folders, vouwbladen en ander drukwerk.",
          "Papieren zakken en lege sigarettenpakjes nadat plastic en folie zijn verwijderd.",
          "Drankkartons voor sap en melk, lege pizzadozen, schoenendozen en kartonnen verpakkingen voor wijn, pasta, rijst en wasmiddelen."
        ],
        preparation: ["Maak pizzadozen leeg en verwijder plastic en folie uit sigarettenpakjes."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Glas, blik en aluminium",
        shortName: "Glas",
        accepted: [
          "Glazen flessen, potten en verpakkingen, inclusief scherven van flessen en potten.",
          "Blikjes voor olie, dranken en gepelde tomaten; metalen blikjes voor tonijn en vlees; verpakkingen van blik."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plastic",
        shortName: "Plastic",
        accepted: [
          "Schone PET- en HDPE-flessen en -verpakkingen voor water, dranken, olie en sap.",
          "Verpakkingen voor siroop, room, saus, wasmiddel, zeep, huishoudelijke of persoonlijke verzorging en gedestilleerd water tot 5 liter.",
          "Blisterverpakkingen, harde kantoorartikelenverpakkingen, polyethyleenfolie, draagtassen en secundaire flesverpakkingen."
        ],
        preparation: ["Verpakkingen moeten schoon en zonder resten zijn; de aangegeven maximale inhoud is 5 liter."],
        notIncluded: ["Grote plastic voorwerpen zoals speelgoed, teilen, kleine tafels en stoelen."],
        rule: "Behandel grote plastic voorwerpen als grofvuil: bel het gratis nummer 800 362662 of breng ze naar de milieustraat."
      },
      organic: {
        name: "GFT / organisch afval",
        shortName: "GFT",
        accepted: [
          "Keukenresten, botten en vlees- of visafval, eieren en schalen, en koffiedik.",
          "Overgebleven brood, pasta, rijst en meel; schelpen van mosselen, venusschelpen en dergelijke.",
          "Bladeren en snijbloemen, vers of droog; bedorven voedsel; kleine hoeveelheden gras; onbedrukte papieren servetten en zakdoekjes."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Restafval",
        shortName: "Rest",
        accepted: [
          "Vervuild papier en karton.",
          "Cd’s, audio- en videocassettes en hun doosjes; samengestelde materialen zoals papier van de vleeswarenafdeling.",
          "Niet-recyclebare duurzame goederen en alles wat niet in de andere categorieën kan."
        ],
        preparation: [],
        notIncluded: [],
        rule: "De officiële kalender beschrijft een tweewekelijkse inzameling in afwisselende weken; volg altijd de exacte datums hierboven."
      }
    }
  },
  de: {
    htmlLang: "de",
    intlLocale: "de-DE",
    languageName: "Deutsch",
    meta: {
      title: "Abfallkalender {year} | Villa Laura",
      description: "Haushaltskalender für Zone B in Tresnuraghes mit den nächsten 14 Tagen und dem örtlichen Trennleitfaden."
    },
    header: {
      homeLabel: "Startseite von Villa Laura",
      tagline: "Abfallkalender",
      navigationLabel: "Hauptnavigation",
      home: "Start",
      houseGuide: "Hausführer",
      support: "Kontakt",
      language: "Sprache"
    },
    page: {
      kicker: "Nützliche Informationen für Gäste",
      title: "Abfallsammlung in Tresnuraghes",
      intro: "Sieh auf einen Blick, was heute und in den nächsten 14 Tagen abgeholt wird. Die Daten stammen aus dem offiziellen Kalender {year} für Zone B.",
      zone: "Zone B · Tresnuraghes, Sagama und Montresta",
      audience: "Privathaushalte · Villa Laura",
      validPeriod: "Verfügbarer offizieller Zeitraum: {validStart} – {validEnd}",
      householdOnly: "Zusätzliche, ausschließlich für Gewerbebetriebe gekennzeichnete Sammlungen werden nicht als Haushaltsabholung von Villa Laura angezeigt."
    },
    calendar: {
      title: "Die nächsten 14 Tage",
      intro: "Die Ansicht beginnt mit dem aktuellen Datum an der Villa Laura (Zeitzone Europe/Rome).",
      previousWeek: "Vorherige Woche",
      today: "Heute",
      nextWeek: "Nächste Woche",
      range: "{start} bis {end}",
      todayBadge: "Heute",
      tomorrowBadge: "Morgen",
      nextCollectionBadge: "Nächste Abholung",
      holidayBadge: "Feiertagsänderung",
      collection: "Geplante Abholung",
      noCollection: "Keine Haushaltsabholung",
      unavailable: "Für dieses Datum ist kein Kalender verfügbar",
      nextCollection: "Nächste Abholung: {date} — {categories}",
      noFutureCollection: "Im verfügbaren offiziellen Zeitraum gibt es keine spätere Abholung.",
      outsideCoverage: "Der verfügbare offizielle Kalender deckt dieses Datum nicht ab. Das Muster von {year} wird nie automatisch wiederholt.",
      viewAvailable: "Kalender {year} anzeigen",
      availableRange: "Offizielle Daten sind vom {start} bis {end} verfügbar.",
      loading: "Lokales Datum wird ermittelt…"
    },
    guide: {
      kicker: "Örtlicher Leitfaden",
      title: "Was wird recycelt",
      intro: "Die folgenden Hinweise stammen ausschließlich aus dem bereitgestellten offiziellen Kalender. Öffne eine Kategorie für Beispiele.",
      accepted: "Was gehört hinein",
      preparation: "Vorbereitung",
      notIncluded: "Nicht in diese Kategorie",
      localRule: "Örtliche Regel"
    },
    sources: {
      kicker: "Referenzdokumente",
      title: "Offizieller Kalender",
      intro: "Jedes Datum wurde mit dem italienischen Original des Gemeindeverbands Planargia abgeglichen.",
      originalPdf: "Vollständige offizielle italienische PDF öffnen",
      translatedPdf: "Übersetzte PDF öffnen ({translatedStart} – {translatedEnd})",
      translatedLimit: "Die bereitgestellten Übersetzungen umfassen {translatedStart} – {translatedEnd}; für {validStart} – {validEnd} ist das italienische Original maßgeblich.",
      pdfFormat: "PDF, öffnet in einem neuen Tab"
    },
    fullSchedule: {
      kicker: "Funktioniert ohne JavaScript",
      title: "Alle Haushaltsabholungen {year}",
      intro: "Jedes Datum mit Haushaltsabholung ist aufgeführt. An allen anderen Tagen des offiziellen Zeitraums gibt es keine Haushaltsabholung.",
      noScript: "Die automatische Auswahl der nächsten 14 Tage benötigt JavaScript. Der vollständige Kalender unten bleibt verfügbar.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Abfallinformationen für Gäste der Villa Laura",
    notes: {
      "commercial-summer-extra": "Zusätzliche Abholung ausschließlich für Gewerbe; nicht im Haushaltskalender von Villa Laura enthalten.",
      "easter-holiday-change": "Feiertagsbedingte Änderung laut offiziellem Kalender.",
      "holiday-postponement": "Wegen eines Feiertags verschobene Abholung laut offiziellem Kalender."
    },
    categories: {
      paper: {
        name: "Papier und Karton",
        shortName: "Papier",
        accepted: [
          "Zeitungen, Zeitschriften, Faltblätter, Broschüren und sonstige Drucksachen.",
          "Papiertüten und leere Zigarettenschachteln nach dem Entfernen von Kunststoff und Folie.",
          "Getränkekartons für Saft und Milch, leere Pizzakartons, Schuhkartons und Kartonverpackungen für Wein, Nudeln, Reis und Waschmittel."
        ],
        preparation: ["Pizzakartons leeren und Kunststoff sowie Folie aus Zigarettenschachteln entfernen."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Glas, Dosen und Aluminium",
        shortName: "Glas",
        accepted: [
          "Glasflaschen, Gläser und Behälter einschließlich Scherben von Flaschen und Gläsern.",
          "Dosen für Öl, Getränke und geschälte Tomaten; Metalldosen für Thunfisch und Fleisch; Weißblechbehälter."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Kunststoff",
        shortName: "Kunststoff",
        accepted: [
          "Saubere PET- und HDPE-Flaschen und -Behälter für Wasser, Getränke, Öl und Saft.",
          "Behälter für Sirup, Creme, Sauce, Waschmittel, Seife, Haushalts- oder Körperpflege und destilliertes Wasser bis 5 Liter.",
          "Blister, feste Schreibwarenbehälter, Polyethylen-Verpackungsfolie, Tragetaschen und Sekundärverpackungen für Flaschen."
        ],
        preparation: ["Behälter müssen sauber und frei von Rückständen sein; das angegebene Höchstvolumen beträgt 5 Liter."],
        notIncluded: ["Sperrige Kunststoffgegenstände wie Spielzeug, Wannen, kleine Tische und Stühle."],
        rule: "Sperrige Kunststoffgegenstände als Sperrmüll behandeln: die gebührenfreie Nummer 800 362662 anrufen oder zum Wertstoffhof bringen."
      },
      organic: {
        name: "Biomüll",
        shortName: "Bio",
        accepted: [
          "Küchenreste, Knochen und Fleisch- oder Fischabfälle, Eier und Schalen sowie Kaffeesatz.",
          "Übrig gebliebenes Brot, Nudeln, Reis und Mehl; Muschel-, Venusmuschel- und ähnliche Schalen.",
          "Blätter und Schnittblumen, frisch oder trocken; verdorbene Lebensmittel; kleine Mengen Gras; unbedruckte Papierservietten und Taschentücher."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Restmüll",
        shortName: "Rest",
        accepted: [
          "Verschmutztes Papier und Karton.",
          "CDs, Audio- und Videokassetten samt Hüllen; Verbundmaterialien wie Metzgerpapier.",
          "Nicht recycelbare langlebige Gegenstände und alles, was nicht in die anderen Kategorien gehört."
        ],
        preparation: [],
        notIncluded: [],
        rule: "Der offizielle Kalender beschreibt eine zweiwöchentliche Abholung in abwechselnden Wochen; immer die genauen Daten oben beachten."
      }
    }
  },
  pt: {
    htmlLang: "pt",
    intlLocale: "pt-BR",
    languageName: "Português",
    meta: {
      title: "Calendário de coleta {year} | Villa Laura",
      description: "Calendário doméstico da Zona B para Tresnuraghes, com os próximos 14 dias e o guia local de reciclagem."
    },
    header: {
      homeLabel: "Página inicial da Villa Laura",
      tagline: "Calendário de coleta",
      navigationLabel: "Navegação principal",
      home: "Início",
      houseGuide: "Guia da casa",
      support: "Contato",
      language: "Idioma"
    },
    page: {
      kicker: "Informações úteis para hóspedes",
      title: "Coleta de resíduos em Tresnuraghes",
      intro: "Veja rapidamente o que é coletado hoje e nos próximos 14 dias. As datas vêm do calendário oficial de {year} da Zona B.",
      zone: "Zona B · Tresnuraghes, Sagama e Montresta",
      audience: "Usuários domésticos · Villa Laura",
      validPeriod: "Período oficial disponível: {validStart} – {validEnd}",
      householdOnly: "As coletas adicionais indicadas exclusivamente para comércios não aparecem como coletas domésticas da Villa Laura."
    },
    calendar: {
      title: "Os próximos 14 dias",
      intro: "A visualização começa na data atual da Villa Laura (fuso Europe/Rome).",
      previousWeek: "Semana anterior",
      today: "Hoje",
      nextWeek: "Próxima semana",
      range: "De {start} a {end}",
      todayBadge: "Hoje",
      tomorrowBadge: "Amanhã",
      nextCollectionBadge: "Próxima coleta",
      holidayBadge: "Alteração por feriado",
      collection: "Coleta programada",
      noCollection: "Sem coleta doméstica",
      unavailable: "Calendário indisponível para esta data",
      nextCollection: "Próxima coleta: {date} — {categories}",
      noFutureCollection: "Não há coletas posteriores no período oficial disponível.",
      outsideCoverage: "O calendário oficial disponível não cobre esta data. O padrão de {year} nunca é repetido automaticamente.",
      viewAvailable: "Ver o calendário de {year}",
      availableRange: "Há datas oficiais disponíveis de {start} a {end}.",
      loading: "Localizando a data local…"
    },
    guide: {
      kicker: "Guia local",
      title: "O que reciclar",
      intro: "As orientações abaixo vêm somente do calendário oficial fornecido. Abra uma categoria para ver os exemplos.",
      accepted: "O que colocar",
      preparation: "Como preparar",
      notIncluded: "Não colocar nesta categoria",
      localRule: "Regra local"
    },
    sources: {
      kicker: "Documentos de referência",
      title: "Calendário oficial",
      intro: "Cada data foi conferida no original italiano da União de Municípios da Planargia.",
      originalPdf: "Abrir o PDF oficial italiano completo",
      translatedPdf: "Abrir o PDF traduzido ({translatedStart} – {translatedEnd})",
      translatedLimit: "As edições traduzidas fornecidas cobrem {translatedStart} – {translatedEnd}; o original italiano é a fonte oficial para {validStart} – {validEnd}.",
      pdfFormat: "PDF, abre em uma nova aba"
    },
    fullSchedule: {
      kicker: "Funciona sem JavaScript",
      title: "Todas as coletas domésticas de {year}",
      intro: "Todas as datas com coleta doméstica estão listadas. Nos demais dias do período oficial não há coleta doméstica.",
      noScript: "A seleção automática dos próximos 14 dias precisa de JavaScript. O calendário completo abaixo continua disponível.",
      collectionOn: "{date}: {categories}"
    },
    footer: "Informações sobre resíduos para hóspedes da Villa Laura",
    notes: {
      "commercial-summer-extra": "Coleta adicional apenas para comércios; excluída do calendário doméstico da Villa Laura.",
      "easter-holiday-change": "Alteração por feriado indicada no calendário oficial.",
      "holiday-postponement": "Coleta adiada por feriado, conforme o calendário oficial."
    },
    categories: {
      paper: {
        name: "Papel e papelão",
        shortName: "Papel",
        accepted: [
          "Jornais, revistas, folhetos, dobráveis e outros materiais impressos.",
          "Sacolas de papel e maços de cigarro vazios depois de retirar o plástico e o papel-alumínio.",
          "Embalagens cartonadas de suco e leite, caixas de pizza vazias, caixas de sapato e embalagens de papelão para vinho, macarrão, arroz e detergentes."
        ],
        preparation: ["Esvazie as caixas de pizza e retire o plástico e o papel-alumínio dos maços de cigarro."],
        notIncluded: [],
        rule: ""
      },
      glass: {
        name: "Vidro, latas e alumínio",
        shortName: "Vidro",
        accepted: [
          "Garrafas, potes e recipientes de vidro, inclusive cacos de garrafas e potes.",
          "Latas de óleo, bebidas e tomate pelado; latas metálicas de atum e carne; recipientes de folha de flandres."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      plastic: {
        name: "Plástico",
        shortName: "Plástico",
        accepted: [
          "Garrafas e recipientes limpos de PET e HDPE para água, bebidas, óleo e suco.",
          "Recipientes de xarope, creme, molho, detergente, sabão, higiene doméstica ou pessoal e água destilada, de até 5 litros.",
          "Blisters, recipientes rígidos de papelaria, filme de polietileno, sacolas e embalagens secundárias para garrafas."
        ],
        preparation: ["Os recipientes devem estar limpos e sem resíduos; a capacidade máxima indicada é de 5 litros."],
        notIncluded: ["Objetos plásticos volumosos como brinquedos, bacias, mesas pequenas e cadeiras."],
        rule: "Trate objetos plásticos volumosos como resíduos volumosos: ligue para o número gratuito 800 362662 ou leve-os ao ecocentro."
      },
      organic: {
        name: "Orgânico",
        shortName: "Orgânico",
        accepted: [
          "Restos de cozinha, ossos e resíduos de carne ou peixe, ovos e cascas e borra de café.",
          "Sobras de pão, macarrão, arroz e farinha; conchas de mexilhão, vôngole e semelhantes.",
          "Folhas e flores cortadas, frescas ou secas; alimentos estragados; pequenas quantidades de grama; guardanapos e lenços de papel sem impressão."
        ],
        preparation: [],
        notIncluded: [],
        rule: ""
      },
      residual: {
        name: "Rejeitos não recicláveis",
        shortName: "Rejeito",
        accepted: [
          "Papel e papelão contaminados.",
          "CDs, fitas de áudio e vídeo e suas caixas; materiais compostos como papel de frios.",
          "Bens duráveis não recicláveis e tudo o que não pode ir nas outras categorias."
        ],
        preparation: [],
        notIncluded: [],
        rule: "O calendário oficial descreve uma coleta quinzenal, em semanas alternadas; siga sempre as datas exatas acima."
      }
    }
  }
};
