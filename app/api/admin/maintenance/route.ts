export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { z } from 'zod';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  platformRole?: string;
}

const MaintenanceSchema = z.object({
  action: z.enum(['enable', 'disable']),
  message: z.string().max(200).optional(),
  durationMinutes: z
    .number()
    .min(1, 'Minimum 1 minute')
    .max(10080, 'Maximum 1 week (10080 minutes)')
    .optional(),
});

// GET — public, used by middleware.ts to check maintenance status
export async function GET() {
  const maintenance = await prismaClient.maintenanceMode.findUnique({
    where: { id: 'singleton' },
  });

  if (!maintenance || !maintenance.isActive) {
    return NextResponse.json({ isActive: false });
  }

  // Check if maintenance window has expired
  if (maintenance.endsAt && new Date(maintenance.endsAt) < new Date()) {
    // Auto-disable expired maintenance
    await prismaClient.maintenanceMode.update({
      where: { id: 'singleton' },
      data: { isActive: false },
    });
    return NextResponse.json({ isActive: false });
  }

  return NextResponse.json({
    isActive: true,
    message: maintenance.message,
    startedAt: maintenance.startedAt,
    endsAt: maintenance.endsAt,
  });
}

// POST — owner only, enable/disable maintenance
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser)?.platformRole;
  const userId = (session?.user as SessionUser)?.id;

  if (role !== 'OWNER') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { action, message, durationMinutes } = MaintenanceSchema.parse(body);

  if (action === 'enable') {
    const endsAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

    await prismaClient.maintenanceMode.upsert({
      where: { id: 'singleton' },
      update: {
        isActive: true,
        message: message || "EchoDeck is undergoing maintenance. We'll be back shortly.",
        startedAt: new Date(),
        endsAt,
        updatedBy: userId,
      },
      create: {
        id: 'singleton',
        isActive: true,
        message: message || "EchoDeck is undergoing maintenance. We'll be back shortly.",
        startedAt: new Date(),
        endsAt,
        updatedBy: userId,
      },
    });

    return NextResponse.json({ message: 'Maintenance mode enabled' });
  }

  if (action === 'disable') {
    await prismaClient.maintenanceMode.update({
      where: { id: 'singleton' },
      data: { isActive: false, endsAt: null, updatedBy: userId },
    });
    return NextResponse.json({ message: 'Maintenance mode disabled' });
  }

  return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
}
