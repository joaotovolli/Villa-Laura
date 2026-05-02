export const accessLogoutUrl = "https://villa-laura.it/cdn-cgi/access/logout?returnTo=https%3A%2F%2Fvilla-laura.it%2F";
export const accessTeamLogoutUrl = "https://villa-laura.cloudflareaccess.com/cdn-cgi/access/logout";

export const usesCloudflareAccessSession = (session = {}) => session.passwordFallbackEnabled === false;

export const logoutTarget = (session = {}) => (usesCloudflareAccessSession(session) ? accessLogoutUrl : "");
