export function memberRole(member: any) {
  return member.accountType === 'owner' ? 'developer' : member.accountType;
}

export function agencyId(member: any) {
  return member.profile?.agency?.agencyId || member.profile?.agencyId || null;
}
