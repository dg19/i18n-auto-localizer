import { useTranslation } from 'react-i18next';

export function Hero() {
  const { t } = useTranslation();
  return <h1>{t('hero.title')}</h1>;
}

export function Footer() {
  return <span>{i18n.t('footer.copyright')}</span>;
}

export function Namespaced() {
  const { t } = useTranslation();
  return <p>{t('home:hero.subtitle')}</p>;
}
