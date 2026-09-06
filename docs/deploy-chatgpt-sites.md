# Deploy with ChatGPT Sites

ChatGPT Sites can create an independent hosted copy from this public repository.
Availability and usage limits depend on the ChatGPT plan and region.

Give ChatGPT the repository URL and use a prompt such as:

> Deploy this GitHub project with ChatGPT Sites. Confirm that it is compatible,
> create a new empty D1 database using the existing `DB` binding, apply the
> migrations in `drizzle/`, let me review the private preview, and publish only
> after I approve it.

Repository URL:

`https://github.com/jtdelosh-ops/Skeet-Tracker`

The `.openai/hosting.json` file declares only the reusable `DB` binding. It does
not contain another person's Site ID or database. Sites provisions resources
owned by the account performing the deployment.

Before publishing, verify that the tracker opens with no shoots and that adding,
editing, and deleting a test shoot works. Delete the test shoot afterward.
