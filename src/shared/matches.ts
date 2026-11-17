/**
 * Pages VisioFix runs on. Shared by the content script and the manifest's
 * host_permissions so the permission request always matches what the
 * extension actually does.
 */
export const SITE_MATCHES = ['http://*/*', 'https://*/*'];
