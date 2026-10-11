# Русская локализация DSH — глоссарий и правила перевода

Целевой стиль: нейтральный технический русский, как в локализациях VS Code и GitHub.
Длина строк близка к английской (интерфейс узкий), без «вы»-обращений, если в оригинале их нет.

## Правила

1. Ключи JSON не менять, не добавлять, не удалять и не переупорядочивать. Значения — только строки
   (исключение: массивы в `settings.agentPreset`, см. ниже).
2. Плейсхолдеры вида `{name}`, `{value}`, `{percent}` сохранять дословно, имена внутри не переводить.
3. Сохранять переводы строк `\n` и многоточие `…` там, где они есть.
4. Не переводить: DSH, DeepSeek, API, JSON, Markdown, MCP, SDK, CLI, URL, Git, GitHub, PTC, ID,
   имена файлов и путей, слэш-команды (`/model`), идентификаторы инструментов, клавиши
   (Cmd, Ctrl, Shift, Alt, Enter, Esc, Tab, Mod).
5. Кнопки и действия — инфинитив с заглавной буквы: «Сохранить», «Отмена», «Удалить».
   Заголовки и подписи — обычное предложение (Sentence case), без КАПСА, без лишних «!».
6. Технические сокращения оставлять латиницей, если так короче и понятнее.

## Глоссарий

| English | Русский |
|---|---|
| session | сеанс |
| workspace | рабочая область |
| agent | агент |
| subagent | субагент |
| tool | инструмент |
| skill | навык |
| plugin | плагин |
| bundle | бандл |
| preset (agent preset) | пресет агента |
| settings | настройки |
| trajectory | траектория |
| sidebar | боковая панель |
| job | задача |
| task | задача |
| goal | цель |
| schedule | расписание |
| approval | подтверждение |
| permission | разрешение |
| model | модель |
| provider | провайдер |
| token | токен |
| prompt | запрос |
| turn | ход |
| diff | дифф |
| stream | поток |
| tool call | вызов инструмента |
| usage | использование |
| feedback | отзыв |
| reference | ссылка / упоминание (по контексту) |
| slash command | слэш-команда |
| onboarding | первый запуск |
| coding view / developer tools | представление кода |
| workflow | сценарий |
| delivery / deliverable | результат |
| attachment | вложение |
| retry | повторить |
| dismiss | скрыть |
| done | готово |
| overview | обзор |

## Массивы

В `settings.agentPreset` значения `guideStandardExplanation`, `guideStandardUsage`,
`guidePtcExplanation`, `guidePtcUsage`, `guideMinimalExplanation`, `guideMinimalUsage`,
`guideCordisExplanation`, `guideCordisUsage` — это массивы строк (Markdown).
Массив нужно сохранить массивом той же длины, переводя каждый элемент; разметку Markdown
(`###`, `>`, `-`, `` ` ``) сохранять.
