# i18n Auto-Localizer

Detects in-use i18n translation keys directly in your JS/TS source (react-i18next, vue-i18n, next-intl, raw i18next) and fills in missing or changed translations via an LLM of your choice (any model available through [OpenRouter](https://openrouter.ai)).

Existing translations — including ones added before you adopted this tool — are never overwritten.

## GitHub Action usage

```yaml
name: Update translations
on:
  push:
    branches: [main]
jobs:
  i18n:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: <owner>/i18n-auto-localizer@v1
        with:
          source-lang: en
          target-langs: ja,fr,de
          locales-dir: ./public/locales
          api-key: ${{ secrets.OPENROUTER_API_KEY }}
```

## Local CLI usage

Try it against your own repo before wiring up the Action:

```bash
export OPENROUTER_API_KEY=sk-or-...
npx i18n-auto-localizer run \
  --source-lang en \
  --target-langs ja,fr \
  --locales-dir ./public/locales

# Preview the diff without calling the API or writing files:
npx i18n-auto-localizer run --dry-run \
  --source-lang en --target-langs ja,fr --locales-dir ./public/locales
```
