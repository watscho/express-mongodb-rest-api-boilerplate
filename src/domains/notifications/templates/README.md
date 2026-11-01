# Email template catalog

Each built-in template has its own folder. Folders use `kebab-case`. The registry maps the camelCase keys in `accountTemplateSchema` to those folders. Account workflows use `notificationService.enqueueAccount(key, options, session)`; generic/custom workflows use `enqueueTemplate`. `GET /notifications/templates` returns the same registered keys.

```text
templates/
  layout.ejs
  partials/
    button.ejs
    action-link.ejs
  sign-up/
    html.ejs
    content.ejs
    text.ejs
  reset-password/
    html.ejs
    content.ejs
    text.ejs
  verification/
    html.ejs
    content.ejs
    text.ejs
  successfully-verified/
    html.ejs
    content.ejs
    text.ejs
  successfully-updated-profile/
    html.ejs
    content.ejs
    text.ejs
  successfully-updated-password/
    html.ejs
    content.ejs
    text.ejs
  successfully-updated-email/
    html.ejs
    content.ejs
    text.ejs
  successfully-deleted/
    html.ejs
    content.ejs
    text.ejs
```

| Folder                          | Template key                  | Purpose                                                        |
| ------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `sign-up`                       | `signUp`                      | Welcome message, verification-email notice, application link   |
| `reset-password`                | `resetPassword`               | Reset button, copyable URL, one-use/24-hour expiry notice      |
| `verification`                  | `verification`                | Verification button, copyable URL, one-use/7-day expiry notice |
| `successfully-verified`         | `successfullyVerified`        | Confirmation and application link                              |
| `successfully-updated-profile`  | `successfullyUpdatedProfile`  | Profile change confirmation and security guidance              |
| `successfully-updated-password` | `successfullyUpdatedPassword` | Password change notification and support guidance              |
| `successfully-updated-email`    | `successfullyUpdatedEmail`    | Notification to the previous address and support guidance      |
| `successfully-deleted`          | `successfullyDeleted`         | Account deletion confirmation and support guidance             |

## Editing a template

`html.ejs` composes the common `layout.ejs` with that folder's `content.ejs` and a translated preheader. Edit `content.ejs` to change a specific email's HTML body. The layout owns the document, title, responsive table frame, and footer. `partials/` contains the reusable button and fallback action link.

`text.ejs` renders the template's `text` translation without HTML escaping, preserving plain URLs and line breaks for the `text/plain` alternative. Keep the HTML and text copies consistent when changing content. The worker sends both parts in one message.

Copy lives in `../translations/en.json` and `../translations/ka.json`, under the corresponding template key. `layout` contains shared footer/link copy and is not a sendable template. Registered dictionaries inherit the supported locale's shared layout strings; unknown locales fall back to the template default's layout strings or English. Override `footerLabel` and `fallbackLinkLabel` in custom dictionaries to translate them for additional languages.

All dynamic HTML text and URLs use escaped `<%=` output. Raw `<%-` output is reserved for server-owned rendered includes. Plain-text templates also use raw output because their result is sent as `text/plain`. The templates use inline styles, presentation tables, system fonts, and no external images, fonts, scripts, or stylesheets.

The `resetPassword` and `verification` templates require `variables.accessToken`; other built-in templates take no variables. Action URLs are constructed by the renderer. Application buttons use the configured client base URL. Token expiry notices are measured from the request, not the eventual delivery time.

## Adding a template

Copy an existing template folder, give the folder a kebab-case name and the template its own key, and register its `htmlFile`, `textFile`, variables schema, and locale dictionaries in `../registry.ts`. The built-in registry is explicit: creating a folder or adding translation data alone does not expose a new template. The common layout expects `title`, `body`, and shared footer copy; the built-in HTML wrapper also expects `preview`. Define any additional keys used by your content and plain-text files.

The build copies this entire directory. A custom `MAIL_TPL_PATH` must contain the common layout, referenced partials, and all registered template folders. Deploy the same files to the API and email workers.

Worker startup checks registered HTML/text entry-file existence, not the complete include tree or rendered output. Restart workers after changes, particularly with production EJS caching. Keep template keys and variable schemas compatible with queued/retrying jobs; renaming a folder does not rename a persisted key automatically.

See the [notification guide](../../../../docs/notifications.md) for registration examples, background delivery, locale selection, translation overrides, and configuration.
