# FreeAI для Astra

AI-провайдер FreeAI: маршрутизирует запросы к моделям через Router API с автоматическим выбором стабильного маршрута.

## Настройка

1. Создайте `deployment.json` в корне плагина:

       {
         "serverUrl": "https://<хост>/",
         "pluginToken": "<PLUGIN_API_TOKEN>"
       }

   `serverUrl` — публичный HTTPS URL Router API, `pluginToken` — общий токен плагина.
   Файл в git не попадает, значения вшиваются в сборку при `bun run build`.

2. Сборка:

       bun install
       bun run typecheck
       bun run build

3. Проверка и упаковка средствами Astra CLI:

       astra-plugin check --strict .
       astra-plugin build .

   Результат — `dwertyfa-free-ai-<version>-noarch.astraplugin`.
