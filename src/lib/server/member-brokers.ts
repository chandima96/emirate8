import type { Payload } from 'payload';

function textOr(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function profileData(member: any) {
  const isAgency = member.accountType === 'agency';
  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  const portfolio = profile.portfolio && typeof profile.portfolio === 'object' ? profile.portfolio : {};
  const credentials = profile.credentials && typeof profile.credentials === 'object' ? profile.credentials : {};
  const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
  const name = textOr(portfolio.displayName, textOr(member.name, 'Broker'));
  const specialties = Array.isArray(portfolio.specialties)
    ? portfolio.specialties.map((value: any) => ({ specialty: textOr(value?.specialty ?? value) })).filter((value: any) => value.specialty)
    : [];
  const languages = Array.isArray(portfolio.languages)
    ? portfolio.languages.map((value: any) => ({ language: textOr(value?.language ?? value) })).filter((value: any) => value.language)
    : [];

  return {
    appData: { ...profile, ownerMemberId: Number(member.id) },
    name,
    slug: textOr(portfolio.slug, `member-${member.id}`),
    reraNumber: textOr(credentials.brn) || null,
    agency: profile.agency?.agencyId || portfolio.agency?.id || undefined,
    agencyLabel: textOr(portfolio.agency?.name) || textOr(profile.agency?.name) || null,
    title: textOr(portfolio.title, isAgency ? 'Real Estate Agency' : 'Licensed Real Estate Broker'),
    bio: textOr(portfolio.bio) || null,
    specialties,
    languages,
    location: (portfolio.areas || []).join(', ') || null,
    phone: privacy.showPhone === false ? '' : textOr(portfolio.publicPhone, textOr(member.mobile)),
    whatsapp: privacy.showWhatsapp === false ? '' : textOr(portfolio.whatsapp),
    email: privacy.showEmail === false ? '' : textOr(portfolio.publicEmail, textOr(member.email)),
    social: portfolio.social || undefined,
    stats: { listingCount: 0, soldCount: 0, yearsExperience: 0, rating: 0, reviewCount: 0 },
    verified: member.credentialStatus === 'verified',
    featured: false,
    type: isAgency ? 'agency' : member.accountType === 'buyer' || member.accountType === 'owner' ? 'buyer' : 'broker',
  };
}

/** Mirror a member's public portfolio into Payload's brokers collection. */
export async function syncMemberBroker(payload: Payload, member: any) {
  const profile = member.profile && typeof member.profile === 'object' ? member.profile : {};
  if (member.adminCreated === true && profile.controlRole) return null;
  const data = profileData(member);
  const existing = await payload.find({ collection: 'brokers', limit: 1000, depth: 0, overrideAccess: true });
  const match = (existing.docs as any[]).find((doc) => Number(doc.appData?.ownerMemberId) === Number(member.id));
  if (match) {
    return payload.update({ collection: 'brokers', id: match.id, data: data as any, overrideAccess: true });
  }
  return payload.create({ collection: 'brokers', data: data as any, overrideAccess: true });
}
