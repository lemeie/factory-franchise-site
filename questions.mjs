const topics = [
  {
    keywords: ["how long", "first boards", "first orders", "timeline", "duration", "six months", "wie lange", "dauer", "zeitplan", "inbetriebnahme"],
    title: "How long does setup take?",
    text: "The target is first paid orders six months after contract, subject to site readiness and delivery. The planned process covers site checks, equipment sourcing, shipping, installation and on-site training.",
    href: "/how-it-works.html"
  },
  {
    keywords: ["building", "premises", "floor space", "production space", "square metres", "square meters", "three phase", "compressed air", "nitrogen", "drehstrom", "gebaude", "gebaeude", "halle", "flache", "flaeche", "druckluft", "stickstoff"],
    title: "What does the building need?",
    text: "The concept requires production space with three-phase power, compressed air and nitrogen supply, usually a bulk tank outside that needs a permit. Suitability needs a site check; floor area alone does not establish whether a building is suitable.",
    href: "/how-it-works.html"
  },
  {
    keywords: ["lease", "leasing", "leasen", "cost", "costs", "price", "pricing", "fees", "budget", "capital", "financing", "kosten", "preis", "preise", "finanzierung", "kapital"],
    title: "What financing and costs are planned?",
    text: "Leasing is one of the planned financing routes; availability and terms depend on the site and its financing. Costs depend on line financing, fit-out and the starting order book. The concept includes a setup fee, software licence, service contract and system fee on revenue, with written terms before any agreement.",
    href: "/faq.html"
  },
  {
    keywords: ["quality", "standards", "certification", "iso", "ipc", "inspection", "traceability", "qualitat", "qualitaet", "normen", "zertifizierung", "normes", "qualite"],
    title: "What quality standards are planned?",
    text: "The planned shared process is built on ISO 9001 and IPC-A-610, with consistent inspection and traceability. Each site would need its own certification, following documented operation and an independent audit.",
    href: "/how-it-works.html"
  },
  {
    keywords: ["maintenance", "servicing", "service", "repair", "repairs", "spare parts", "remote support", "wartung", "reparatur", "ersatzteile", "manutenzione", "assistenza"],
    title: "Who would service the line?",
    text: "The proposed service contract includes European spare-parts stock, remote support and yearly maintenance. The service arrangements will be defined for the pilot.",
    href: "/faq.html"
  },
  {
    keywords: ["requirements", "what do i need", "getting started", "how to start", "staffing", "hiring", "training", "voraussetzungen", "anforderungen", "was brauche ich", "personalbedarf", "schulung", "wymagania", "czego potrzebuje", "zeby zaczac"],
    title: "What would I need to start?",
    text: "The concept requires a suitable building, an order book, confirmed financing, an owner who runs the site, a process engineer and operators. A limited company would sign the agreement and own the business. The concept uses a five-year term, with full conditions provided before any agreement.",
    href: "/how-it-works.html"
  },
  {
    keywords: ["machine sourcing", "equipment sourcing", "equipment source", "equipment sourced", "machines come from", "machines made", "manufacturers", "china", "asia", "maschinenherkunft", "maschinenhersteller", "kommen die maschinen", "vienen las maquinas", "origen de las maquinas"],
    title: "Where would the machines come from?",
    text: "The plan is to source from established equipment manufacturers in Asia, including China, with import, CE conformity checks and European spare-parts support. Boards would be built in Europe by the local team.",
    href: "/faq.html"
  },
  {
    keywords: ["data", "data ownership", "data export", "daten", "maschinendaten", "produktionsdaten", "maskindatan", "maskindata"],
    title: "Who would own the machine data?",
    text: "The concept gives each site ownership of its machine and production data. Export, including when a site leaves the network, is a requirement of the planned software. The software is not available yet; hosting and data-processing arrangements will be specified before it is offered.",
    href: "/privacy.html"
  },
  {
    keywords: ["pilot", "2027", "software", "available", "launch", "status", "government", "european union", "already running", "verfugbar", "verfuegbar", "regierung", "eu institution"],
    title: "What stage is Factory Franchise at?",
    text: "Factory Franchise is a private initiative, not run, endorsed or funded by the EU or any national government. A first pilot is planned for 2027. The operating software is a concept preview and is not available yet. The plan is to open to further sites after at least twelve months of pilot operation.",
    href: "/faq.html"
  },
  {
    keywords: ["founder", "founders", "who is behind", "who started", "team", "johan", "hans", "leon", "meier", "stam", "grunder", "gruender"],
    title: "Who is behind the initiative?",
    text: "Johan P Stam and Leon Meier started the initiative in Berlin. Johan P Stam (Hans) focuses on hardware, supply chain, supplier relationships and equipment sourcing in China. Leon Meier focuses on the business model and operating software.",
    href: "/about.html"
  },
  {
    keywords: ["contact", "email", "e mail", "press", "feedback", "kontakt", "anschreiben", "presse"],
    title: "How can I contact the operators?",
    text: "You can email Johan P Stam and Leon Meier at hans@supplychat.ai and leon@supplychat.ai. An email link opens a draft in your email application; you choose whether to send it.",
    href: "mailto:leon@supplychat.ai,hans@supplychat.ai"
  },
  {
    keywords: ["customers", "orders", "order book", "earnings", "profit", "revenue", "sales", "kunden", "auftrage", "auftraege", "auftragsbuch", "gewinn", "umsatz"],
    title: "Would you provide customers or guarantee earnings?",
    text: "Not at the start, and there are no promises about orders or earnings. You need your own order book. Central sales for customers who want several sites is planned once several sites are running. Results would depend on each site's orders, prices and team.",
    href: "/faq.html"
  }
];

// shortcut: fixed keyword matches only; expand alongside published FAQs when missed topics recur.
export function getAnswers(question) {
  if (typeof question !== "string") return [];
  const words = ` ${question.normalize("NFKD").toLowerCase()
    .replace(/\p{M}/gu, "").replace(/ß/g, "ss").replace(/ł/g, "l")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  return topics.filter(({keywords}) => keywords.some(keyword => words.includes(` ${keyword} `)))
    .slice(0, 3).map(({title, text, href}) => ({title, text, href}));
}
