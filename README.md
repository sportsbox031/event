# event

## Apps Script Deployment

The optimized backend is split across these root files in this repository:

- `code.gs`
- `config.gs`
- `utils.gs`
- `sheets.gs`
- `cache.gs`
- `repositories.gs`
- `services.gs`

To deploy:

1. Create or update matching `.gs` files in the Google Apps Script project.
2. Paste the contents from the repository files into the Apps Script files with the same names.
3. Save the Apps Script project.
4. Redeploy the web app.
5. After the new deployment URL is live, publish the updated static frontend if the URL changed.

Rollback path:

1. Restore the previous Apps Script file contents.
2. Redeploy the previous web app version.
3. Revert the static frontend only if the URL or response contract changed.
