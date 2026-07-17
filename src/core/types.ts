export interface UsedKey {
  key: string;
  namespace: string | null;
  file: string;
  line: number;
}

export interface DynamicKeyUsage {
  file: string;
  line: number;
  snippet: string;
}

export interface ScanResult {
  usedKeys: UsedKey[];
  dynamicUsages: DynamicKeyUsage[];
}

export type LocaleValueMap = Map<string, string>;

export type NamespaceLocaleData = Record<string, LocaleValueMap>;

export interface LockfileData {
  version: 1;
  namespaces: Record<string, Record<string, string>>;
}

export interface TranslationTarget {
  namespace: string;
  key: string;
  sourceValue: string;
}

export interface DiffResult {
  toTranslate: TranslationTarget[];
  toStamp: TranslationTarget[];
  undefinedKeys: UsedKey[];
  dynamicUsages: DynamicKeyUsage[];
  orphanKeys: { namespace: string; key: string }[];
}

export interface TranslateBatchResult {
  translations: Map<string, string>;
  failedKeys: string[];
}
