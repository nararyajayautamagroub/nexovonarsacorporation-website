# Authentication Setup

The website uses Supabase Auth for email/password registration, password login, password reset and Google OAuth.

## 1. Create a Supabase project

Create a Supabase project and copy the project URL plus the publishable browser key.

For local development, put them only in `config.js`:

```js
window.NX_CONFIG.supabase.url = "https://YOUR-PROJECT.supabase.co";
window.NX_CONFIG.supabase.publishableKey = "YOUR_SUPABASE_PUBLISHABLE_KEY";
```

Never put a Supabase `service_role` key in `config.js`, browser JavaScript or GitHub Pages. The browser integration is intentionally limited to the publishable/anon credential. For the GitHub Pages deployment, add repository secrets named `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the deploy workflow injects them only into the generated `gh-pages` artifact.

## 2. Enable email authentication

In Supabase Authentication settings, enable Email.

Users can then register and log in from the account dialog. If email confirmation is enabled, a newly registered user must verify the address before a session is established.

## 3. Enable Google OAuth

In the Google Auth Platform / Google Cloud project, create a Web OAuth client and configure the website origin.

Then enable Google under the Supabase Authentication provider settings and add the application origin/redirect configuration used by the site.

The website sends users through:

```js
supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: window.location.origin + window.location.pathname
  }
});
```

For the GitHub Pages deployment, the redirect URL should point to the deployed project path, for example:

```text
https://USERNAME.github.io/REPOSITORY/
```

Also add the local development origin when testing locally.

## 4. Password reset

The login dialog includes password reset. Supabase sends the reset flow back to the same application origin configured in `config.js`.

## 5. Deployment authentication\n\nThe production deployment reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from GitHub Actions repository secrets when both are present. The generated `gh-pages/config.js` keeps the browser publishable key and dynamic `window.location.origin + window.location.pathname` redirect. If the secrets are not configured, deployment intentionally keeps the safe placeholder and authentication remains disabled.\n\n## 6. Settings

The website stores language, theme, reduced-motion and auto-refresh preferences in browser storage. Authentication state is handled by Supabase Auth.

## Supported languages

1. Indonesia
2. English
3. Melayu
4. Tiếng Việt
5. ไทย
6. 简体中文
7. 日本語
8. 한국어
9. العربية
10. Español
