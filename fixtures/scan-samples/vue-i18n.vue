<template>
  <h1>{{ $t('hero.title') }}</h1>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const label = t('footer.label');
</script>
