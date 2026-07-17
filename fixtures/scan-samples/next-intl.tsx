import { useTranslations } from 'next-intl';

export function Pricing() {
  const t = useTranslations('pricing');
  return <p>{t('plan.title')}</p>;
}
