import { createI18n, Composer as I18n, useI18n } from 'vue-i18n'
import { nextTick } from 'vue'

let _global: I18n

export async function init (lang: string) {
  const plugin = createI18n<false>({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    fallbackFormat: true,
    fallbackWarn: false,
    missingWarn: false,
    messages: {
      // eslint-disable-next-line @stylistic/quote-props
      'en': await (await fetch(`${import.meta.env.BASE_URL}data/en/app_i18n.json`)).json()
    }
  })
  _global = plugin.global
  await loadLang(lang)
  return plugin
}

export async function loadLang (lang: string): Promise<void> {
  if (lang !== 'en') {
    const messages = await (await fetch(`${import.meta.env.BASE_URL}data/${lang}/app_i18n.json`)).json()
    _global.setLocaleMessage(lang, messages)
  }
  const prevLang = _global.locale.value
  _global.locale.value = lang
  if (prevLang !== 'en') {
    _global.setLocaleMessage(prevLang, {})
  }

  document.documentElement.lang = lang

  await nextTick()
}

export function useI18nNs (name: string) {
  const { t } = useI18n()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const _t = t as Function
  return {
    t: ((path, ...args) => {
      if (typeof path === 'string' && path.startsWith(':')) {
        return _t(path.replace(':', `${name}.`), ...args)
      } else {
        return _t(path, ...args)
      }
    }) as typeof t
  }
}

// Deathloom fork: PoE2 price check (from Exiled Exchange 2) uses some texts our
// list doesn't have. Add only the missing ones, so PoE1 wording never changes.
export async function addMissingMessages (url: string): Promise<void> {
  const extra = await (await fetch(url)).json() as Record<string, unknown>
  // read the current messages only (they may hold compiled functions / proxies that
  // can't be cloned), then merge in just what is missing
  const have = _global.getLocaleMessage('en') as Record<string, unknown>
  _global.mergeLocaleMessage('en', missingMessages(have, extra) as never)
}

export function missingMessages (have: Record<string, unknown>, extra: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(extra)) {
    const current = have?.[key]
    if (current === undefined) {
      out[key] = value
    } else if (current && value && typeof current === 'object' && typeof value === 'object') {
      const nested = missingMessages(current as Record<string, unknown>, value as Record<string, unknown>)
      if (Object.keys(nested).length) out[key] = nested
    }
  }
  return out
}
