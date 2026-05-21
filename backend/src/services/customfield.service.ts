import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createCustomField(data: {
  name: string;
  fieldType: string;
  entityType: string;
  options?: string[];
  isRequired?: boolean;
  order?: number;
}) {
  return prisma.customField.create({
    data: {
      name: data.name,
      fieldType: data.fieldType as any,
      entityType: data.entityType as any,
      options: data.options || [],
      isRequired: data.isRequired || false,
      order: data.order || 0,
    },
  });
}

export async function getCustomFields(entityType?: string) {
  const where: any = { isActive: true };
  if (entityType) where.entityType = entityType;
  return prisma.customField.findMany({
    where,
    orderBy: { order: "asc" },
    include: { _count: { select: { values: true } } },
  });
}

export async function updateCustomField(id: string, data: Partial<{
  name: string; fieldType: string; entityType: string;
  options: string[]; isRequired: boolean; order: number; isActive: boolean;
}>) {
  const updateData: any = { ...data };
  if (data.fieldType) updateData.fieldType = data.fieldType;
  if (data.entityType) updateData.entityType = data.entityType;
  return prisma.customField.update({ where: { id }, data: updateData });
}

export async function deleteCustomField(id: string) {
  return prisma.customField.update({ where: { id }, data: { isActive: false } });
}

// ─── Values ────────────────────────────────────────

export async function setCustomFieldValue(data: {
  customFieldId: string;
  contactId?: string;
  dealId?: string;
  value: string;
}) {
  // Upsert: delete existing and create new
  const where: any = { customFieldId: data.customFieldId };
  if (data.contactId) where.contactId = data.contactId;
  if (data.dealId) where.dealId = data.dealId;

  await prisma.customFieldValue.deleteMany({ where });

  return prisma.customFieldValue.create({
    data: {
      customFieldId: data.customFieldId,
      contactId: data.contactId || null,
      dealId: data.dealId || null,
      value: data.value,
    },
    include: { customField: true },
  });
}

export async function getContactCustomValues(contactId: string) {
  return prisma.customFieldValue.findMany({
    where: { contactId },
    include: { customField: true },
  });
}
