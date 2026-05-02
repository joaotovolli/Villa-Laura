export const accessLogoutUrl = "/cdn-cgi/access/logout";
export const accessTeamLogoutUrl = "https://villa-laura.cloudflareaccess.com/cdn-cgi/access/logout";

export const usesCloudflareAccessSession = (session = {}) => session.passwordFallbackEnabled === false;

export const logoutTarget = (session = {}) => (usesCloudflareAccessSession(session) ? accessLogoutUrl : "");
