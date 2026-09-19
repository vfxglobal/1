# Supabase connection

1. Create a Supabase project.
2. In Supabase **SQL Editor**, run [`supabase-schema.sql`](./supabase-schema.sql).
3. In **Authentication > Providers**, enable Email. Create an agent user with email `agent@gmail.com` and password `26452126` (or choose another email and update `VFX_AGENT_EMAIL`).
4. Copy the project URL and the public anon key from **Project Settings > API** into [`supabase-config.js`](./supabase-config.js). Set `VFX_AGENT_EMAIL` to the exact email of the Supabase agent user. Never put the `service_role` key in this folder.
5. Serve this folder through a local web server (for example, VS Code Live Server). Opening HTML files directly with `file://` can block CDN or Supabase requests.

The app stores:

- `tracking_records`: the generated tracking ID, applicant name, email, phone, passport number, submitted form data, and current stage.
- `stage_submissions`: each submitted customer form, selected payment method, and the Storage path for its payment screenshot. These rows cascade when a tracking ID is deleted.
- `payment_accounts`: the bank account/UPI/PayPal details displayed to customers.
- Storage bucket `payment-screenshots`: private payment screenshot files. The agent delete action removes these files before deleting the linked tracking record.

The `find_or_create_tracking_record` RPC reuses an existing tracking ID when the email, phone, or passport number matches. Agents can delete a tracking record from the dashboard; deleting it removes the linked form rows and payment screenshots. Run the updated SQL file in Supabase before testing these changes.

Payment forms on every customer stage load the configured bank account, UPI, and PayPal options. Fees are displayed in USD and INR without stage-specific wording.

## Important password note

The requested password `26452126` is hardcoded in [`agent.js`](./agent.js), so it is visible to anyone who downloads the website. This is acceptable only for a private demo/test site. For a real service, use a password managed only by Supabase Auth and remove the hardcoded value.

## Publish on GitHub Pages

1. Create a new GitHub repository, for example `vfx-global-portal`.
2. In PowerShell, open this project folder and run:

   ```powershell
   git init
   git add .
   git commit -m "Connect portal to Supabase"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vfx-global-portal.git
   git push -u origin main
   ```

3. In GitHub, open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then click **Save**.
5. Wait for GitHub Pages to publish the site. Test the generated URL, for example:
   `https://YOUR_USERNAME.github.io/vfx-global-portal/`
6. Test `agent.html` with the password `26452126`, then create a test tracking ID and search it from `tracking-id.html`.

Do not commit a Supabase `service_role` key. The public anon key is intended for browser use, and the database policies in `supabase-schema.sql` limit what it can do.
