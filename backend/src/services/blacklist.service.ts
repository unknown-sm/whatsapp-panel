import prisma from "../lib/prisma";

export async function isBlacklisted(contactId: string): Promise<boolean> {
  const tag = await prisma.tag.findUnique({ where: { name: "blacklist" } });
  if (!tag) return false;
  const link = await prisma.contactTags.findUnique({ where: { contactId_tagId: { contactId, tagId: tag.id } } });
  return !!link;
}
