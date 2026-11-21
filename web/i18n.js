let language = 'zh';

export function setLanguage(value) {
  language = value === 'en' ? 'en' : 'zh';
}

export function currentLanguage() {
  return language;
}

export function t(zh, en) {
  return language === 'en' ? en : zh;
}

const TITLES = {
  '自驾游预订': 'Self-drive tour',
  '健身俱乐部': 'Fitness club',
  '伦敦地下铁路的发展': 'The development of the London Underground',
  '体育场的过去、现在与未来': 'Stadiums: past, present and future',
};

export function localizeText(value) {
  if (language !== 'en' || typeof value !== 'string' || !value) return value;
  if (TITLES[value]) return TITLES[value];
  return value.replaceAll('剑雅', 'Cambridge IELTS');
}
