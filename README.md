# i18n Auto-Localizer

**A GitHub Action and CLI that scans your JS/TS source code for in-use i18n translation keys and auto-generates missing translations with any LLM — no manual key extraction, no locked-in translation vendor, and existing translations are never overwritten.**

[![npm version](https://img.shields.io/npm/v/i18n-auto-localizer.svg)](https://www.npmjs.com/package/i18n-auto-localizer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![GitHub Marketplace](https://img.shields.io/badge/marketplace-i18n--auto--localizer-blue?logo=github)](https://github.com/marketplace/actions/i18n-auto-localizer)

Works with **react-i18next**, **vue-i18n**, **next-intl**, and raw **i18next** — translating via any model available on [OpenRouter](https://openrouter.ai) (Claude, GPT, Gemini, Llama, and more, your choice).

---

## Table of contents

- [Why this instead of Crowdin / Lokalise / Phrase?](#why-this-instead-of-crowdin--lokalise--phrase)
- [How it works](#how-it-works)
- [GitHub Action usage](#github-action-usage)
- [Action inputs](#action-inputs)
- [Local CLI usage](#local-cli-usage)
- [Supported frameworks](#supported-frameworks)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Why this instead of Crowdin / Lokalise / Phrase?

Traditional translation-management platforms (Crowdin, Lokalise, Phrase) coordinate *human* translators: a web UI, review stages, assignment workflows — and they require you to first export the keys you want translated. Most GitHub Actions for i18n are thin wrappers around syncing files to and from one of those platforms.

i18n-auto-localizer works differently:

| | i18n-auto-localizer | Typical TMS-sync action |
|---|---|---|
| **Key discovery** | Scans your actual source code for `t('key')` calls — only translates keys you really use | You export/maintain the key list yourself |
| **Translation engine** | Any LLM via OpenRouter, your choice of model | Human translators via a hosted platform |
| **Existing translations** | Never overwritten, even on the very first run — tracked via a committed lockfile | Varies by platform/sync direction |
| **Unused keys** | Reported as warnings, never silently deleted | Not typically detected at all |
| **Undefined keys** | Flags code that references a key missing from your source locale | Not typically detected |
| **Setup** | One `with:` block, an OpenRouter key, done | Account + project setup on a third-party platform |
| **Try before adopting** | Full-featured local CLI, no CI required | Usually platform-only |

If you want human review workflows and translator collaboration tooling, a TMS is still the right call. If you want translations to just stay in sync with your code with zero external accounts, this is built for that.

## How it works

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────┐
│  Scan source │ -> │  Diff against │ -> │  Translate via │ -> │  Open a PR │
│  for t(...)  │    │  locale files │    │  your LLM      │    │  with the  │
│  key usage   │    │  + lockfile   │    │  (OpenRouter)  │    │  result    │
└─────────────┘    └──────────────┘    └───────────────┘    └────────────┘
```

1. **Scan** — walks your source (`src/**/*.{js,jsx,ts,tsx,vue}` by default) with an AST parser, extracting every `t('key')` / `useTranslation('ns')` / `i18n.t('key')` call, including `.vue` script blocks.
2. **Diff** — compares used keys against your `{locales-dir}/{lang}/*.json` files and a `.i18n-localizer-lock.json` hash lockfile. A key with **no lockfile record but an existing value is never touched** — that's how manually-translated strings survive the very first run.
3. **Translate** — batches genuinely new/changed keys to the OpenRouter model you configure, retries on rate limits, and verifies interpolation placeholders (`{{name}}`, `{name}`) survive translation before accepting a result.
4. **Ship** — commits the changed locale files + lockfile to a dedicated branch and opens (or updates) a single pull request, summarizing what was translated, what failed, what's undefined, and what's unused.

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
      - uses: dg19/i18n-auto-localizer@v1
        with:
          source-lang: en
          target-langs: ja,fr,de
          locales-dir: ./public/locales
          api-key: ${{ secrets.OPENROUTER_API_KEY }}
```

> **Note:** your repository must also have "Allow GitHub Actions to create and approve pull requests" enabled under **Settings → Actions → General**, or PR creation will fail with a 403, even with `permissions: pull-requests: write` set above.

**Data flow:** every string value in your source-language locale files is sent to whichever OpenRouter model you configure, in order to translate it. Don't put secrets or personal data in translatable strings — treat the `model` you select as a third party that will see this content, same as any translation service.

## Action inputs

| Input | Required | Default | Description |
|---|:---:|---|---|
| `source-lang` | ✅ | — | Source language code, e.g. `en` |
| `target-langs` | ✅ | — | Comma-separated target language codes, e.g. `ja,fr,de` |
| `locales-dir` | ✅ | — | Root directory of your locale JSON files, e.g. `./public/locales` |
| `api-key` | ✅ | — | Your [OpenRouter](https://openrouter.ai) API key — pass via `secrets.OPENROUTER_API_KEY`, never hardcode it |
| `src` | | `src/**/*.{js,jsx,ts,tsx,vue}` | Comma-separated glob(s) to scan for translation key usage |
| `model` | | `anthropic/claude-sonnet-4.5` | Any [OpenRouter model ID](https://openrouter.ai/models) — `openai/gpt-4o`, `google/gemini-2.5-pro`, etc. |
| `github-token` | | `${{ github.token }}` | Token used to create/update the pull request |

## Local CLI usage

The Action and the CLI share the exact same engine — try real translations against your own repo before wiring up CI, with no GitHub Actions dependency at all:

```bash
npm install -g i18n-auto-localizer
# or: npx i18n-auto-localizer

export OPENROUTER_API_KEY=sk-or-...
i18n-auto-localizer run \
  --source-lang en \
  --target-langs ja,fr \
  --locales-dir ./public/locales

# Preview the diff without calling the API or writing files:
i18n-auto-localizer run --dry-run \
  --source-lang en --target-langs ja,fr --locales-dir ./public/locales
```

| Flag | Default | Description |
|---|---|---|
| `--source-lang <lang>` | — | Required. Source language code |
| `--target-langs <langs>` | — | Required. Comma-separated target language codes |
| `--locales-dir <dir>` | — | Required. Root directory of locale JSON files |
| `--src <globs>` | `src/**/*.{js,jsx,ts,tsx,vue}` | Comma-separated glob(s) to scan |
| `--model <model>` | `anthropic/claude-sonnet-4.5` | OpenRouter model ID |
| `--dry-run` | off | Preview the diff — no API calls, no writes, no key required |

## Supported frameworks

| Framework | Detected patterns |
|---|---|
| [react-i18next](https://react.i18next.com/) | `useTranslation()`, `useTranslation('namespace')`, `t('key')`, `t('namespace:key')` |
| [vue-i18n](https://vue-i18n.intlify.dev/) | `.vue` single-file components (`<script>`/`<script setup>` block) |
| [next-intl](https://next-intl.dev/) | `useTranslations('namespace')`, `t('key')` |
| Raw [i18next](https://www.i18next.com/) | `i18n.t('key')` |

Namespace-split locale directories (`{locales-dir}/{lang}/common.json`, `home.json`, ...) are fully supported — every `.json` file in a language's directory is treated as its own namespace.

## FAQ

**Does this delete keys that are no longer used?**
No. Unused ("orphan") keys are reported in the pull request and CLI summary as a warning, never auto-deleted — that decision stays with you.

**What happens to translations I already wrote by hand before adopting this tool?**
They're protected on the very first run and every run after. A key with an existing value but no tracking record in `.i18n-localizer-lock.json` is left completely untouched — only its hash gets recorded, so future edits to the source string are still detected correctly.

**Which LLM should I use?**
Any model on [OpenRouter](https://openrouter.ai/models) — set the `model` input/flag. There's no vendor lock-in; switch models per run if you want.

**Can I use my own OpenAI/Anthropic API key directly, without OpenRouter?**
Not directly — route it through OpenRouter, which supports bringing your own provider key for most models while giving you one consistent API and the ability to swap models freely.

**Does it work with namespaced keys like `common:hero.title`?**
Yes — explicit namespace prefixes and `useTranslation('namespace')`/`useTranslations('namespace')` hook bindings are both resolved correctly, including when a file has multiple components each bound to a different namespace.

## Contributing

Issues and pull requests are welcome — see the [issue tracker](https://github.com/dg19/i18n-auto-localizer/issues). The test suite (`npm test`) and `npm run build` should stay green for any change.

## License

[MIT](LICENSE) © dg19
