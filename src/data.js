// ✏️ Edit everything here — the site and the AI navigator both read from this file.
export const links = {
  email: 'shivambande006@gmail.com',
  github: 'https://github.com/zoro1225',
  linkedin: 'https://www.linkedin.com/in/shivam-bande',
  instagram: 'https://www.instagram.com/shivam_bande07',
};

export const projects = [
  { n: '01', tag: 'COMMERCE / STARTUP', title: 'WHATACOVER', img: '/media/whatacover-frame-0.jpg',
    desc: 'An e-commerce experience for a real startup building a smart vehicle cover — designed to explain, showcase and sell a physical product.', role: 'DESIGN / DEVELOPMENT · 2026' },
  { n: '02', tag: 'AI / CIVIC TECH', title: 'JUDICIALTRIAGE', img: '/media/judicial-0.jpg',
    desc: 'A judicial intelligence workspace for understanding case pendency, predicting resolution timelines and supporting case triage.', role: 'PRODUCT / DEVELOPMENT · 2026' },
];

export const stack = [
  ['React', 'Frontend'], ['JavaScript', 'Core'], ['Python', 'Backend'], ['Node.js', 'Backend'],
  ['NLP / AI', 'ML'], ['MongoDB', 'Database'], ['CSS / HTML', 'Markup'], ['REST APIs', 'Arch'],
  ['Git / GitHub', 'Tools'], ['MySQL', 'Database'], ['Figma', 'Design'], ['Pandas', 'Data'],
  ['Scikit-learn', 'ML'], ['Express', 'Framework'], ['Tailwind', 'CSS'], ['Firebase', 'Cloud'],
];

export const about = {
  bio: [
    'I’m Shivam Bande — a full-stack developer and B.Tech Computer Science student from Nagpur, India. I build web products, AI interfaces and interactive 3D experiences, and I care about making complex ideas feel clear, fast and a little bit magical.',
    'Outside the editor I’m active in university forums and inter-college competitions, and I contribute to WhataCover, a startup building a smart vehicle cover. This site is one of my experiments — an endless ocean you can sail, with an AI navigator that knows my story.',
  ],
  facts: [
    ['BASE', 'Nagpur, India'],
    ['STUDYING', 'B.Tech Computer Science · G.H. Raisoni SkillTech University'],
    ['BUILDING', 'WhataCover · JudicialTriage'],
    ['COMMUNITY', 'University forums · inter-college competitions'],
    ['FOCUS', 'Web products · AI interfaces · interactive 3D'],
    ['THIS SITE', 'React · Three.js · live-generated Web Audio'],
  ],
};

/* The AI assistant is rule-based and runs fully in the browser (topics, follow-ups, "tell me more", site actions).
   To make it truly generative, replace `reply` with a fetch() to your own backend that calls an LLM — never put an API key in front-end code. */
export const prompts = ['Who is Shivam?', 'What has he built?', 'What is his stack?', 'How do I contact him?'];
const T = (id, re, text, extra = {}) => ({ id, re, text, ...extra });
const FALLBACK = { id: 'none', text: 'I’m not sure about that one. I can tell you about Shivam’s projects, skills, background, community work, or how to contact him.', follow: prompts };
const TOPICS = [
  T('greet', /^(hi|hello|hey|ahoy|namaste|yo|good (morning|afternoon|evening))\b/, () => 'Hello! Ask me about Shivam’s projects, skills, background, or how to get in touch.'),
  T('thanks', /thank|thanks|great|awesome|nice|cool|perfect/, 'You’re welcome! Is there anything else you’d like to know about Shivam?'),
  T('joke', /joke|funny|laugh/, 'A programmer’s partner says: “Go to the store and buy a loaf of bread. If they have eggs, buy a dozen.” The programmer comes back with twelve loaves.', { follow: ['What has he built?', 'What is his stack?'] }),
  T('whatacover', /whatacover|vehicle|car cover|smart cover/, 'WhataCover is a real startup building a smart vehicle cover. Shivam designed and built its e-commerce experience to explain, showcase and sell the product.', { nav: 1, follow: ['Tell me more', 'What is JudicialTriage?', 'What is his stack?'] }),
  T('judicial', /judicial|triage|court|pendency|legal/, 'JudicialTriage is an AI interface for understanding case pendency, predicting resolution timelines and supporting case triage.', { nav: 1, follow: ['Tell me more', 'Tell me about WhataCover', 'What is his stack?'] }),
  T('work', /work|project|built|build|made|portfolio|case stud|experience/, 'Two flagship builds: WhataCover, an e-commerce experience for a physical-product startup, and JudicialTriage, an AI workspace for judicial case triage.', { nav: 1, cards: true, follow: ['Tell me about WhataCover', 'What is JudicialTriage?', 'What is his stack?'] }),
  T('stack', /stack|skill|tech|react|python|tool|language|framework|database|frontend|backend/, 'Frontend: React, JavaScript, Tailwind. Backend: Python, Node.js, Express and REST APIs. Data and ML: Pandas, Scikit-learn and NLP. Databases: MongoDB, MySQL and Firebase. Design: Figma.', { nav: 2, chips: true, follow: ['Tell me more', 'What has he built?', 'Tell me about his background'] }),
  T('edu', /study|college|univers|educat|degree|btech|b\.tech|student|raisoni|qualif/, 'Shivam is studying B.Tech Computer Science at G.H. Raisoni SkillTech University in Nagpur.', { nav: 3, follow: ['What is his community work?', 'What has he built?'] }),
  T('community', /achiev|compet|forum|community|award|extracurricular|leadership/, 'Shivam is active in university forums and inter-college competitions, and he contributes to the WhataCover startup.', { nav: 3, follow: ['Tell me more', 'What has he built?'] }),
  T('cert', /cert/, 'No certifications are listed on this site yet. I can tell you about his projects, skills or community work instead.'),
  T('contact', /contact|email|reach|github|linkedin|insta|mail|connect|message|talk to/, `You can email Shivam at ${links.email}. He’s also on GitHub as zoro1225, on LinkedIn, and on Instagram.`, { nav: 4, links: true }),
  T('hire', /hire|available|availability|freelance|intern|job|opportunit|collab|recruit/, `I don’t have details about Shivam’s availability, so the best way to discuss opportunities or collaborations is to email him directly at ${links.email}.`, { nav: 4, links: true }),
  T('arcade', /game|play|arcade|fun|bored/, 'There’s an arcade built into this site with five ocean-themed mini-games: Blade Slice, Quick Draw, Sea Dodger, Cannon Fire and Kraken Smash. Want me to open it?', { action: 'arcade' }),
  T('site', /this site|website|how .*(made|built)|three|3d|ocean|ship|shader|audio|sound/, 'This site is built with React and Three.js. The ocean is a custom water shader, the ships are procedural 3D models, and every sound is generated live with the Web Audio API.', { follow: ['What has he built?', 'What is his stack?'] }),
  T('about', /who|about|shivam|intro|yourself|nagpur|from|bio|tell me/, 'Shivam Bande is a full-stack developer from Nagpur, India, studying B.Tech Computer Science. He builds web products, AI interfaces and interactive 3D experiences, and enjoys turning complex ideas into clear, usable things.', { nav: 3, follow: ['What has he built?', 'What is his stack?', 'How do I contact him?'] }),
];
const MORE = {
  whatacover: 'The product is a smart vehicle cover, and Shivam contributes to the startup’s digital side — the experience that presents and sells it. You can see a preview in the Work section.',
  judicial: 'JudicialTriage focuses on three things: understanding how long cases stay pending, predicting when they might be resolved, and helping prioritise which cases need attention first.',
  work: 'Both projects are 2026 builds that span design and development, from the interface through to the product experience.',
  stack: 'He works across the whole stack — React and Tailwind on the front end, Node/Express or Python on the back end, MongoDB, MySQL or Firebase for data, and NLP with Scikit-learn for AI work.',
  about: 'Beyond coding, he’s active in university forums and inter-college competitions, and contributes to a startup. This portfolio is one of his experiments in 3D, motion and sound.',
  community: 'He takes part in university forums and inter-college competitions alongside his degree, and contributes to the WhataCover startup.',
};
export function reply(q, last) {
  const s = q.toLowerCase().trim(); if (!s) return FALLBACK;
  if (/\b(more|elaborate|details|expand|go on|continue)\b/.test(s) && last && MORE[last]) return { id: last, text: MORE[last], follow: prompts };
  const auto = /\b(show|take|go|open|see|visit|navigate|jump|scroll|play|start)\b/.test(s);
  const t = TOPICS.find((x) => x.re.test(s)); if (!t) return FALLBACK;
  return { id: t.id, text: typeof t.text === 'function' ? t.text() : t.text, nav: t.nav, cards: t.cards, chips: t.chips, links: t.links, action: t.action, follow: t.follow || prompts, auto: auto && (t.nav != null || !!t.action) };
}
