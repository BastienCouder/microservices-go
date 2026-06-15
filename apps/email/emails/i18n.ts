export type EmailLocale = "fr" | "en"

export function normalizeLocale(locale?: string): EmailLocale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "fr"
}

export function getLanguageTag(locale?: string): string {
  return normalizeLocale(locale) === "en" ? "en-US" : "fr-FR"
}

export function formatDateByLocale(value: string, locale?: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(getLanguageTag(locale), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function formatRoleByLocale(role: string | undefined, locale?: string): string {
  const normalizedRole = role?.trim().toLowerCase()
  const normalizedLocale = normalizeLocale(locale)

  if (normalizedLocale === "en") {
    switch (normalizedRole) {
      case "editor":
        return "Editor"
      case "viewer":
        return "Viewer"
      case "admin":
        return "Admin"
      case "owner":
        return "Owner"
      default:
        return role?.trim() || "Member"
    }
  }

  switch (normalizedRole) {
    case "editor":
      return "Éditeur"
    case "viewer":
      return "Lecteur"
    case "admin":
      return "Admin"
    case "owner":
      return "Propriétaire"
    default:
      return role?.trim() || "Membre"
  }
}

export function getInvitationCopy(locale?: string) {
  if (normalizeLocale(locale) === "en") {
    return {
      appName: "VISIA",
      defaultOrganization: "your organization",
      preview: (organizationName: string, inviterName?: string) =>
        `${inviterName ? `${inviterName} invited you` : "Invitation"} to join ${organizationName} on VISIA`,
      heading: "You are invited",
      headingHighlightPrefix: "to join",
      invitedBodyWithInviter: "invited you to collaborate in a VISIA workspace",
      invitedBodyWithoutInviter: "You have been invited to collaborate in a VISIA workspace",
      invitedBodySuffix:
        " to track your brand visibility across AI search, prompts, and analysis.",
      acceptButton: "Accept invitation",
      accessDetails: "Access details",
      roleLabel: "Role",
      projectLabel: "Project",
      validityLabel: "Validity",
      allProjects: "All projects",
      validUntil: (expiry: string) => `Until ${expiry}`,
      noExpiry: "No expiration",
      directLink: "Direct link",
      footerTagline:
        "Measure, understand, and improve how AI systems talk about your brand.",
      footerRights: "All rights reserved",
      footerIgnore:
        "If you were not expecting this invitation, you can safely ignore this email.",
    }
  }

  return {
    appName: "VISIA",
    defaultOrganization: "votre organisation",
    preview: (organizationName: string, inviterName?: string) =>
      `${inviterName ? `${inviterName} vous invite` : "Invitation"} à rejoindre ${organizationName} sur VISIA`,
    heading: "Vous êtes invité",
    headingHighlightPrefix: "à rejoindre",
    invitedBodyWithInviter: "vous invite à collaborer sur un espace VISIA",
    invitedBodyWithoutInviter: "Vous avez été invité à collaborer sur un espace VISIA",
    invitedBodySuffix:
      " pour suivre la visibilité de votre marque dans les moteurs IA, les prompts et les analyses.",
    acceptButton: "Accepter l'invitation",
    accessDetails: "Détails de l'accès",
    roleLabel: "Rôle",
    projectLabel: "Projet",
    validityLabel: "Validité",
    allProjects: "Tous les projets",
    validUntil: (expiry: string) => `Jusqu'au ${expiry}`,
    noExpiry: "Sans expiration",
    directLink: "Lien direct",
    footerTagline:
      "Mesurez, comprenez et améliorez la façon dont les systèmes IA parlent de votre marque.",
    footerRights: "Tous droits réservés",
    footerIgnore:
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email en toute sécurité.",
  }
}

export function getOtpCopy(locale?: string) {
  if (normalizeLocale(locale) === "en") {
    return {
      fallbackPurpose: "continue",
      fallbackValidity: "a few minutes",
      preview: (code: string) => `Your VISIA verification code: ${code}`,
      heading: "Your code",
      headingHighlight: "for verification",
      introPrefix: "Use this code to",
      introSuffix: "It confirms your identity on VISIA.",
      monoLabel: "One-time code",
      validityPrefix: "This code is personal, single-use, and expires in",
      safetyLabel: "Security",
      safetyBody:
        "Never share this code. VISIA will never ask for it by email, phone, or message.",
      footerTagline:
        "Measure, understand, and improve how AI systems talk about your brand.",
      footerRights: "All rights reserved",
      footerIgnore:
        "If you did not request this code, you can safely ignore this email.",
    }
  }

  return {
    fallbackPurpose: "continuer",
    fallbackValidity: "quelques minutes",
    preview: (code: string) => `Votre code de vérification VISIA : ${code}`,
    heading: "Votre code",
    headingHighlight: "de vérification",
    introPrefix: "Utilisez ce code pour",
    introSuffix: "Il permet de confirmer votre identité sur VISIA.",
    monoLabel: "Code à usage unique",
    validityPrefix: "Ce code est personnel, à usage unique, et expire dans",
    safetyLabel: "Sécurité",
    safetyBody:
      "Ne partagez jamais ce code. VISIA ne vous le demandera jamais par email, téléphone ou message.",
    footerTagline:
      "Mesurez, comprenez et améliorez la façon dont les systèmes IA parlent de votre marque.",
    footerRights: "Tous droits réservés",
    footerIgnore:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.",
  }
}

export function getWelcomeCopy(locale?: string) {
  if (normalizeLocale(locale) === "en") {
    return {
      preview: "Confirm your account",
      heading: (firstName: string) => `Welcome ${firstName}`,
      body:
        "Confirm your email to activate your account and access every feature.",
      cta: "Confirm my email",
      footer:
        "If you did not request this email, you can safely ignore it.",
    }
  }

  return {
    preview: "Confirme ton compte",
    heading: (firstName: string) => `Bienvenue ${firstName}`,
    body:
      "Confirme ton email pour activer ton compte et accéder à toutes les fonctionnalités.",
    cta: "Confirmer mon email",
    footer:
      "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.",
  }
}
